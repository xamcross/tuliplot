# Automatic Deploys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merges to main auto-deploy the frontend to Cloudflare Pages and the backend to Fly.io, gated on green tests, path-filtered — after first making the backend CI job green on GitHub runners.

**Architecture:** Stage 1 replaces per-test-class Testcontainers with a `MongoTestUri.uriFor(Class)` seam: env `MONGODB_TEST_URI` (CI service container) or a shared singleton Testcontainer (local), always with a per-class database name. Stage 2 extends `ci.yml`: a paths-filter job, an artifact handoff from the frontend test job, and two deploy jobs (`wrangler-action`, `flyctl deploy --remote-only`) that run only on push-to-main (or forced via `workflow_dispatch`) after their test job passes.

**Tech Stack:** GitHub Actions (dorny/paths-filter@v3, cloudflare/wrangler-action@v3, superfly/flyctl-actions), JUnit 5 + Testcontainers 2.x (Boot 4.1 relocations), Gradle 9, flyctl + gh CLIs.

**Spec:** `docs/superpowers/specs/2026-08-01-auto-deploys-design.md`

## Global Constraints

- Backend test commands run from `C:\Users\xamcr\DashDash\backend` in Git Bash: `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon test` (the env var is required for Testcontainers on this box). Full check: `... ./gradlew --no-daemon build`.
- YAML sanity check after every `ci.yml` edit: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo OK` (from repo root).
- The 9 Mongo test classes: `AuthControllerLoginTest`, `AuthControllerPasswordResetTest`, `AuthControllerRegisterTest`, `AuthControllerSessionTest`, `MongoSessionRepositoryTest` (in `auth/session/`), `UserRepositoryTest`, `ProcessedStripeEventRepositoryTest`, `CatalogSeederTest`, `SkeletonContextTest`.
- CI-side URI is exactly `mongodb://localhost:27017`; per-class DB name is the class's simple name; connection flag `directConnection=true`.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t`

---

### Task 1: MongoTestUri env/singleton seam + migrate the 9 test classes

**Files:**
- Modify: `backend/src/test/java/com/tuliplot/testsupport/MongoTestUri.java`
- Create: `backend/src/test/java/com/tuliplot/testsupport/MongoTestUriTest.java`
- Modify: the 9 test classes listed in Global Constraints (same mechanical transformation each)

**Interfaces:**
- Produces: `public static String MongoTestUri.uriFor(Class<?> testClass)` — env `MONGODB_TEST_URI` base or shared-singleton-container base, plus `/<ClassSimpleName>?directConnection=true`. Package-private pure helpers `compose(String base, String dbName)` and `hostPortOnly(String url)` for unit tests. Task 2's CI service container depends on the env branch.

- [ ] **Step 1: Write the failing unit test**

Create `MongoTestUriTest.java`:

```java
package com.tuliplot.testsupport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MongoTestUriTest {

    @Test
    void composeAppendsPerClassDbAndDirectConnection() {
        assertThat(MongoTestUri.compose("mongodb://localhost:27017", "UserRepositoryTest"))
                .isEqualTo("mongodb://localhost:27017/UserRepositoryTest?directConnection=true");
    }

    @Test
    void composeToleratesTrailingSlash() {
        assertThat(MongoTestUri.compose("mongodb://localhost:27017/", "X"))
                .isEqualTo("mongodb://localhost:27017/X?directConnection=true");
    }

    @Test
    void hostPortOnlyStripsDatabaseAndQuery() {
        assertThat(MongoTestUri.hostPortOnly("mongodb://127.0.0.1:54321/test?replicaSet=rs0"))
                .isEqualTo("mongodb://127.0.0.1:54321");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon test --tests "com.tuliplot.testsupport.MongoTestUriTest"`
Expected: compilation FAILURE — `compose`/`hostPortOnly` don't exist.

- [ ] **Step 3: Rewrite MongoTestUri**

Replace the class body (keep package + class-level javadoc, updating it to describe the two branches):

```java
public final class MongoTestUri {

    static final String ENV_VAR = "MONGODB_TEST_URI";

    private static MongoDBContainer shared;

    private MongoTestUri() {
    }

    /**
     * Per-class Mongo URI. With MONGODB_TEST_URI set (CI service container), connects there;
     * otherwise starts one shared local Testcontainer for the whole JVM. Each test class gets
     * its own database (class simple name) so classes sharing a server stay isolated.
     */
    public static String uriFor(Class<?> testClass) {
        String env = System.getenv(ENV_VAR);
        String base = (env != null && !env.isBlank()) ? env : sharedContainerBase();
        return compose(base, testClass.getSimpleName());
    }

    /** Pure: joins a mongodb://host:port base with a per-class database and directConnection flag. */
    static String compose(String base, String dbName) {
        return base.replaceAll("/+$", "") + "/" + dbName + "?directConnection=true";
    }

    /** Pure: strips any path/query from a driver URL down to mongodb://host:port. */
    static String hostPortOnly(String url) {
        return url.replaceAll("^(mongodb://[^/?]+).*$", "$1");
    }

    private static synchronized String sharedContainerBase() {
        if (shared == null) {
            shared = new MongoDBContainer("mongo:8.0");
            shared.start(); // no explicit stop: Ryuk reaps it at JVM exit
        }
        return hostPortOnly(shared.getReplicaSetUrl());
    }
}
```

The old `directConnection(MongoDBContainer)` method is deleted in Step 5 (after no caller remains).

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon test --tests "com.tuliplot.testsupport.MongoTestUriTest"`
Expected: PASS (3 tests).

- [ ] **Step 5: Migrate the 9 test classes**

Apply the identical transformation to each class (canonical before/after, from `UserRepositoryTest`):

Remove (per class):
```java
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
...
@Testcontainers            // annotation on the class
...
    @Container
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");
```

Change (per class, substituting that class's own name):
```java
        registry.add("spring.mongodb.uri", () -> MongoTestUri.directConnection(mongo));
```
becomes
```java
        registry.add("spring.mongodb.uri", () -> MongoTestUri.uriFor(UserRepositoryTest.class));
```

Everything else in each file stays untouched. If any of the 9 deviates structurally from this pattern (different annotations, no `@DynamicPropertySource`), stop and report DONE_WITH_CONCERNS describing the deviation rather than improvising. After all 9 are migrated, delete the now-unused `directConnection` method from `MongoTestUri` (the `MongoDBContainer` import stays — the singleton uses it).

- [ ] **Step 6: Run the full backend suite (default Testcontainers branch)**

Run: `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon build`
Expected: BUILD SUCCESSFUL, 107 tests (104 + 3 new). This exercises the singleton-container branch — one container now serves all classes.

- [ ] **Step 7: Run the suite through the env branch**

Run: `MONGODB_TEST_URI=mongodb://localhost:27017 DOCKER_API_VERSION=1.44 ./gradlew --no-daemon test`
(The local mongod on 27017 stands in for CI's service container.) Expected: BUILD SUCCESSFUL with no Testcontainer started. If a test fails here but passed in Step 6, suspect stale data in the local mongod's per-class DBs — drop those databases and re-run once; if it still fails, report BLOCKED with the failure.

- [ ] **Step 8: Commit**

```bash
git add backend/src/test/java/com/tuliplot/testsupport/ backend/src/test/java/com/tuliplot/auth/ backend/src/test/java/com/tuliplot/billing/ProcessedStripeEventRepositoryTest.java backend/src/test/java/com/tuliplot/catalog/CatalogSeederTest.java backend/src/test/java/com/tuliplot/SkeletonContextTest.java
git commit -m "test(backend): MongoTestUri env/singleton seam — CI service container or shared local Testcontainer, per-class dbs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```

---

### Task 2: Mongo service container in the CI backend job

**Files:**
- Modify: `.github/workflows/ci.yml` (backend job only)

**Interfaces:**
- Consumes: Task 1's env branch (`MONGODB_TEST_URI`).
- Produces: a backend job that can pass on GitHub runners. Verified for real on this branch's PR.

- [ ] **Step 1: Add the service container and env**

In the `backend` job, after `runs-on: ubuntu-latest`, add:

```yaml
    services:
      mongo:
        image: mongo:8.0
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --quiet --eval 'db.adminCommand({ping: 1})'"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 12
```

And extend the "Build and test" step with the env:

```yaml
      - name: Build and test
        run: ./gradlew --no-daemon build
        env:
          MONGODB_TEST_URI: mongodb://localhost:27017
```

- [ ] **Step 2: Validate YAML**

Run (repo root): `npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: mongo service container for the backend job — tests hit it via MONGODB_TEST_URI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```

Real verification happens when this branch's PR runs (executor watches for the backend job's first-ever green).

---

### Task 3: changes job, frontend artifact handoff, deploy-frontend job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `changes` job outputs `frontend`/`backend` booleans (Task 4 reuses both); artifact `frontend-dist`; `deploy-frontend` job. `workflow_dispatch` inputs `deploy_frontend`/`deploy_backend` (Task 4 uses the latter).

- [ ] **Step 1: Extend the `on:` block**

Replace the current `on:` block with:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      deploy_frontend:
        type: boolean
        default: false
        description: Force a frontend deploy
      deploy_backend:
        type: boolean
        default: false
        description: Force a backend deploy
```

- [ ] **Step 2: Add the `changes` job** (first job under `jobs:`):

```yaml
  changes:
    name: Detect changed paths
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          base: ${{ github.ref_name }}
          filters: |
            frontend:
              - 'frontend/**'
              - 'content/**'
            backend:
              - 'backend/**'
```

- [ ] **Step 3: Artifact upload in the frontend job**

Append to the `frontend` job's steps (after "Production build"):

```yaml
      - name: Upload build artifact (deploy handoff)
        if: github.event_name != 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist/frontend/browser
          retention-days: 3
```

- [ ] **Step 4: Add the `deploy-frontend` job**

```yaml
  deploy-frontend:
    name: Deploy frontend (Cloudflare Pages)
    needs: [changes, frontend]
    if: >-
      (github.event_name == 'workflow_dispatch' && inputs.deploy_frontend) ||
      (github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.changes.outputs.frontend == 'true')
    runs-on: ubuntu-latest
    concurrency:
      group: deploy
      cancel-in-progress: false
    steps:
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: dist
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=tuliplot --branch=main --commit-hash=${{ github.sha }}
```

- [ ] **Step 5: Validate YAML + commit**

Run: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo OK` → `OK`.

```bash
git add .github/workflows/ci.yml
git commit -m "ci: path-filtered auto-deploy of the frontend to Cloudflare Pages, gated on the tested artifact

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```

---

### Task 4: deploy-backend job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `changes` outputs and `workflow_dispatch` inputs from Task 3.
- Produces: `deploy-backend` job; the pipeline is complete.

- [ ] **Step 1: Add the job**

```yaml
  deploy-backend:
    name: Deploy backend (Fly.io)
    needs: [changes, backend]
    if: >-
      (github.event_name == 'workflow_dispatch' && inputs.deploy_backend) ||
      (github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.changes.outputs.backend == 'true')
    runs-on: ubuntu-latest
    concurrency:
      group: deploy
      cancel-in-progress: false
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 2: Validate YAML + commit**

Run: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo OK` → `OK`.

```bash
git add .github/workflows/ci.yml
git commit -m "ci: path-filtered auto-deploy of the backend to Fly.io, gated on green backend tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```

---

### Task 5: Repository secrets

**Files:** none (GitHub repo state via `gh`). Run from the repo root.

**Interfaces:**
- Produces: secrets `FLY_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and (owner-dependent) `CLOUDFLARE_API_TOKEN`.

- [ ] **Step 1: Fly deploy token** (never print the token; keep it in a shell variable):

```bash
TOK=$(flyctl tokens create deploy -a api-tuliplot 2>/dev/null || fly tokens create deploy -a api-tuliplot)
[ -n "$TOK" ] && printf '%s' "$TOK" | gh secret set FLY_API_TOKEN && echo "FLY_API_TOKEN set"
```

If flyctl is missing or unauthenticated, report BLOCKED for this secret with the exact command the owner should run.

- [ ] **Step 2: Cloudflare account id**

```bash
ACCT=$(npx wrangler whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1)
[ -n "$ACCT" ] && printf '%s' "$ACCT" | gh secret set CLOUDFLARE_ACCOUNT_ID && echo "CLOUDFLARE_ACCOUNT_ID set"
```

- [ ] **Step 3: Cloudflare API token — owner step**

Check `gh secret list`. If `CLOUDFLARE_API_TOKEN` is absent, report it as the one remaining owner action: Cloudflare dashboard → My Profile → API Tokens → Create Custom Token → permission **Account · Cloudflare Pages · Edit** → then `gh secret set CLOUDFLARE_API_TOKEN` (paste value). Do not invent or placeholder a value.

- [ ] **Step 4: Verify and report**

`gh secret list` — report which of the three exist. No commit (no repo files changed).

---

### Post-plan verification (executor, on the PR and after merge)

1. PR opened → the **backend job goes green on the runner for the first time** (stage-1 acceptance). If it fails, debug via the job log (service-container health, env propagation) before anything merges.
2. On the PR, deploy jobs must show as **skipped** (not failed).
3. After merge (touches `backend/**` + workflow): `deploy-backend` runs; `deploy-frontend` does not (no frontend/content changes). If `CLOUDFLARE_API_TOKEN` is still missing that's fine — it isn't exercised by this merge.
4. Confirm the backend deploy: `flyctl releases -a api-tuliplot` shows a new release; `curl -s https://api.tuliplot.com/api/v1/health` returns healthy (allow the ~3min cold boot).
5. The next frontend-touching merge (or a `workflow_dispatch` with `deploy_frontend`) exercises the Pages path end-to-end; verify with the Wave-1 live checks.
