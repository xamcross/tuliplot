# Frontend deploy — Cloudflare Pages

## Project settings

| Setting                | Value                                   |
|------------------------|-----------------------------------------|
| Framework preset       | Angular                                 |
| Root directory         | `frontend`                              |
| Build command          | `npm ci && npm run build -- --configuration production` |
| Build output directory | `dist/frontend/browser`                 |
| Node version           | `22` (set env var `NODE_VERSION=22`)    |

## SPA routing

SPA routing: `frontend/public/_redirects` rewrites ONLY the client-rendered
routes (`/login`, `/register`, `/app`, `/app/*`, plus trailing-slash twins) to
`/index.html`. Everything else serves prerendered HTML, or `404.html` with a
real 404 status. `404.html` is produced by the `postbuild` npm hook
(`scripts/copy-404.mjs`) — always build with `npm run build`, never bare
`ng build`, or the 404 page is silently missing and Pages falls back to
sitewide soft-404s.

## Custom domain

1. Cloudflare Pages → project → **Custom domains** → add `tuliplot.com`.
2. Add `www.tuliplot.com` and redirect it to the apex.
3. DNS records are created automatically when the domain is on the same
   Cloudflare account (register `tuliplot.com` via Cloudflare Registrar).

## Environment / API base URL

The production bundle uses `src/environments/environment.ts`
(`apiBaseUrl = https://api.tuliplot.com/api/v1`). No build-time env vars are
needed for the API URL. `ng serve` (local dev) uses
`environment.development.ts` (`http://localhost:8080/api/v1`).
