# Frontend deploy — Cloudflare Pages

## Project settings

| Setting                | Value                                   |
|------------------------|-----------------------------------------|
| Framework preset       | Angular                                 |
| Root directory         | `frontend`                              |
| Build command          | `npm ci && npx ng build --configuration production` |
| Build output directory | `dist/frontend/browser`                 |
| Node version           | `22` (set env var `NODE_VERSION=22`)    |

## SPA routing

`frontend/public/_redirects` contains `/* /index.html 200`. Angular copies
`public/` into the build output, so Cloudflare Pages serves it at the site root
and every client-side route resolves to the SPA shell. Prerendered public pages
(added in Plan 06) are emitted as real files and win over this catch-all.

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
