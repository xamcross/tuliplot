# Automatic deploys (Cloudflare Pages + Fly.io) — design

**Date:** 2026-08-01
**Status:** Approved

## Problem

Deploys are manual: frontend via `npx wrangler pages deploy dist/frontend/browser
--project-name=tuliplot` from a developer machine, backend via `flyctl deploy`.
A merged PR changes nothing in production until someone remembers to deploy
(this bit us the same day Wave 1 merged). "Automatic DB migrations" was asked
for alongside; investigation shows no migration framework exists — MongoDB is
schemaless and the app self-migrates owned data at boot (CatalogSeeder upserts,
`reconcileForTier`) — so backend deploy automation *is* the migration path
today.

**Blocking constraint:** the backend CI job has never passed on GitHub runners
(Testcontainers' advertised replica-set/container host is unreachable from the
runner JVM — known infra issue; 104 tests pass locally). Deploys gated on tests
therefore require fixing backend CI first. User chose: fix CI first, then gate
both deploys on green; path-filtered triggers; one workflow file.

## Design

### Stage 1 — backend CI goes green (prerequisite)

- `ci.yml` backend job gains a MongoDB **service container**: image `mongo:8.0`,
  port `27017:27017`, health check (`mongosh --eval "db.adminCommand('ping')"`),
  and exports `MONGODB_TEST_URI=mongodb://localhost:27017` to the Gradle step.
- Test support: the existing `MongoTestUri` class gains an env branch. When
  `MONGODB_TEST_URI` is set: return
  `<env-uri>/<per-class-db-name>?directConnection=true` and do not start a
  Testcontainer. When unset: current Testcontainers behavior, unchanged (local
  dev keeps working with Docker Desktop). Per-class database name = the test
  class's simple name — isolation between classes sharing one server; the
  existing `@BeforeEach deleteAll` patterns keep intra-class isolation.
- All 9 Mongo-backed test classes route through this seam (they already route
  through `MongoTestUri` since the `directConnection` fix).
- Acceptance: backend job green on a GitHub runner.

### Stage 2 — deploy jobs in `ci.yml`

- **`changes` job** (dorny/paths-filter@v3), outputs:
  `frontend` = `frontend/**` OR `content/**`; `backend` = `backend/**`.
- **`deploy-frontend`**: `needs: [changes, frontend]`, runs when
  `github.event_name == 'push' && github.ref == 'refs/heads/main'` and the
  frontend filter is true (or `workflow_dispatch` forces it). The frontend test
  job uploads `frontend/dist/frontend/browser` as an artifact on main pushes;
  the deploy job downloads it and deploys via `cloudflare/wrangler-action@v3`
  (`pages deploy <artifact-dir> --project-name=tuliplot`). Build once — the
  deployed artifact is byte-identical to the tested one.
- **`deploy-backend`**: `needs: [changes, backend]`, same trigger condition on
  the backend filter; `superfly/flyctl-actions/setup-flyctl@master` then
  `flyctl deploy --remote-only` with `working-directory: backend` (Fly builds
  the Dockerfile on its remote builders).
- **Concurrency**: each deploy job has its own group (`deploy-frontend` /
  `deploy-backend`, `cancel-in-progress: false`). A shared group was
  originally specified, but GitHub cancels an older *pending* job in a group
  when a newer one arrives — a frontend deploy could silently drop a pending
  backend deploy. Same-target supersession is safe (the newer SHA contains
  the older's changes); cross-target serialization bought nothing.
- **Manual escape hatch**: `workflow_dispatch` with two boolean inputs
  (`deploy_frontend`, `deploy_backend`) forces the respective deploy job,
  replacing the manual wrangler/flyctl commands entirely. Dispatch deploys
  are additionally guarded to `main` — dispatching from another branch runs
  tests but skips the deploy jobs.
- PR builds are unchanged: tests only, no deploy jobs, no artifact upload.

### Secrets (one-time setup)

| Secret | How it's created |
|---|---|
| `FLY_API_TOKEN` | Minted locally: `flyctl tokens create deploy -a api-tuliplot`; stored via `gh secret set` (automated during implementation if flyctl is authenticated). |
| `CLOUDFLARE_API_TOKEN` | Owner creates in the Cloudflare dashboard (custom token, permission **Cloudflare Pages: Edit** on the account); stored via `gh secret set`. The local wrangler OAuth token cannot mint API tokens. |
| `CLOUDFLARE_ACCOUNT_ID` | Read locally from `wrangler whoami`; stored via `gh secret set`. |

Missing secrets fail the deploy job with a clear error; they never fail tests
or block PRs.

### Migrations — deferred, hook documented

No versioned migrations exist and none are needed yet. When the first real
one arrives: add Mongock (or equivalent), and wire Fly's `release_command`
in `fly.toml` so migrations run before traffic switches to the new version.
Until then, startup self-migration (seeder/reconcile) covers schema evolution,
and this pipeline automates exactly that.

### Failure & rollback

- Wrangler Pages deploys are atomic: a failed upload leaves the previous
  deployment serving.
- Fly health-checks the new machine (`/api/v1/health`, 120s grace); a failed
  deploy is marked failed rather than serving a broken app. Single-machine
  free-tier reality: each backend deploy has a brief cold-boot window —
  pre-existing, unchanged by this project.
- Rollback: frontend — `wrangler pages deployment list`, re-promote a previous
  deployment from the dashboard; backend — `flyctl releases -a api-tuliplot`,
  then `flyctl deploy --image <previous>`.

### Verification

1. Stage 1: PR shows the backend job green on the runner.
2. Docs-only merge → no deploy jobs run.
3. This project's own merge (workflow + backend test files) → backend
   auto-deploys; frontend does not.
4. Next frontend-touching merge → frontend auto-deploys; confirmed by the
   live-site checks used for Wave 1.
5. `workflow_dispatch` smoke-run available at any time.
