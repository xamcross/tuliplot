# DashDash

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

Domains: UI `https://dashdash.app` · API `https://api.dashdash.app` (one
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
