# TulipLot

Turn one browser window into a personal dashboard: a fixed 3×2 grid where each
cell hosts a live web app (Gmail, Trello, a news site — any URL). Free tier
reserves the bottom-right cell for an ad; Premium removes it and unlocks all 6.

## Monorepo layout

| Path         | What                                                            | Hosting             |
|--------------|-----------------------------------------------------------------|---------------------|
| `frontend/`  | Angular 22 app — prerendered public site + CSR dashboard        | Cloudflare Pages    |
| `backend/`   | Spring Boot 4.1 modular monolith — REST/JSON API only (`/api`)  | Fly.io              |
| `extension/` | Chrome MV3 companion (static DNR ruleset + handshake)           | Chrome Web Store    |
| `content/`   | Markdown for guides/blog, compiled into prerendered pages       | (built into `frontend`) |
| `docs/`      | Design spec and implementation plans                            | —                   |

Domains: UI `https://tuliplot.com` · API `https://api.tuliplot.com` (one
registrable domain → same-site session cookie + credentialed CORS).

## Prerequisites

- JDK 25 (or let Gradle's foojay resolver download it)
- Node.js 22 LTS + npm
- Docker (for Testcontainers-backed backend tests)

## Run locally

```bash
# API on http://localhost:8080
cd backend && ./gradlew bootRun

# UI on http://localhost:4200
cd frontend && npx ng serve
```

See `docs/verify-skeleton.md` for the end-to-end credential round-trip check.

## Test

```bash
cd backend && ./gradlew build          # unit + Testcontainers integration tests
cd frontend && npx vitest run          # Vitest unit tests
```

## Deployment cutover (manual, owner-only)

Code targets tuliplot.com; these account-level steps complete the rename:
1. Cloudflare: register tuliplot.com; point the Pages project at it (custom domain), keep `www` redirect.
2. Fly.io: `fly apps create api-tuliplot`; copy secrets from the old app (`MONGODB_URI` — switch the DB name to /tuliplot, `GOOGLE_CLIENT_ID/SECRET`, `STRIPE_*`, `COOKIE_DOMAIN=.tuliplot.com`, `COOKIE_SECURE=true`, `CORS_ALLOWED_ORIGINS=https://tuliplot.com`, `OAUTH2_SUCCESS_URL=https://tuliplot.com/app`); `fly deploy`; add DNS `api.tuliplot.com` → Fly cert.
3. Google OAuth console: add authorized origin `https://api.tuliplot.com` and redirect URI `https://api.tuliplot.com/login/oauth2/code/google`; remove the previous domain's entries once cut over.
4. Stripe dashboard: point the webhook endpoint at `https://api.tuliplot.com/api/v1/billing/webhook` (verify path against BillingController) and keep the same signing secret in `STRIPE_WEBHOOK_SECRET`.
5. AdSense (later, at launch): apply for tuliplot.com per docs/adsense-launch-checklist.md; replace the ads.txt placeholder.
