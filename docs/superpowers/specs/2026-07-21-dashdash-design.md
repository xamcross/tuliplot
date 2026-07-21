# DashDash — Design & Implementation Spec

> Canonical design spec. Implementation plans live in `docs/superpowers/plans/`.
> Cross-cutting interfaces (types, endpoints, store APIs) are pinned in
> `docs/superpowers/plans/2026-07-21-dashdash-00-shared-contract.md` — that
> contract is authoritative for names/signatures; this doc is authoritative for intent.

## Context

DashDash turns one browser window into a personal dashboard: a fixed **3×2 grid** where each cell hosts a live web app (Gmail, Trello, a news site — any URL the user chooses). The **free tier** reserves the bottom-right cell for a Google AdSense ad, leaving 5 usable cells; a paid **Premium** subscription removes the ad and unlocks all 6.

The central technical obstacle: most popular sites forbid being iframed (`X-Frame-Options`, CSP `frame-ancestors`). DashDash solves this with a **hybrid** model — an Angular webapp that works standalone for embed-friendly content, plus an optional **Chrome MV3 companion extension** that strips frame-blocking headers *only for frames inside the dashboard*. A separate **public content site** (marketing + guides + legal) is part of v1 so the project can pass Google AdSense review.

## Locked decisions

| Topic | Decision |
|---|---|
| Delivery model | Hybrid: Angular webapp + optional Chrome MV3 companion extension |
| Grid | Fixed 3×2, exactly one dashboard per user; drag-and-drop **swap** only |
| Free vs Premium | Free: 5 cells + 1 ad cell (fixed bottom-right, slot 5). Premium: 6 cells, no ad |
| Ads | Commit to AdSense + public content site to pass review; certified CMP + ads.txt + privacy policy; ad cell falls back to a house "Upgrade" promo until AdSense is live |
| Payments | Stripe Checkout + Billing Portal; webhooks drive premium state |
| Auth | Spring Security: email/password + Google OIDC; first-party httpOnly session cookie |
| Cell content | Any user-supplied URL + curated catalog; ad cell is the only special cell type |
| Stack | Angular 22 · Spring Boot 4.1 / Java 25 · MongoDB Atlas |
| Hosting | Free-tier first: Cloudflare (domain + Pages) · Fly.io (API) · Atlas M0 · GitHub. UI + API share one registrable domain (`dashdash.app` + `api.dashdash.app`) |
| Browser support | Chrome/Chromium first for v1; other browsers get a compatibility notice |

## Hard truths (load-bearing constraints)

1. **Extension is an optional unlock, not a guarantee.** MV3 `declarativeNetRequest` header-stripping is the only way to composite arbitrary sites into one grid, scoped to our origin via `initiatorDomains`. But it needs broad host access (mitigate with `optional_host_permissions` per-site); major-provider logins (Google/Microsoft/Meta) refuse to iframe even with headers stripped; service-worker/PWA sites bypass DNR; `SameSite=Lax/Strict` cookies show sites logged-out inside a cross-site iframe. → Must design for graceful failure: detect and fall back to "open in a real window/tab," ship a compatibility matrix.
2. **Chrome-only for the full experience.** 3rd-party cookies kept in Chrome (April 2025 reversal); Safari/Firefox partition them and have no header-stripping parity. State Chrome as supported; detect others.
3. **AdSense on the dashboard is policy-risky and needs public content.** The logged-in grid is the page least likely to carry AdSense ("ads on screens without publisher content"). Approval judged on public pages → v1 includes a real public content site; ad cell is native DOM (never inside an iframe); extension never touches the ad slot; certified CMP + ads.txt + privacy policy required. Ship a house promo, switch AdSense on once approved.
4. **Iframe sandboxing is weak containment here.** Logged-in apps need `allow-scripts allow-same-origin`. Real protections: https-only URL validation, omitting `allow-top-navigation`, Permissions-Policy denial of camera/mic/geolocation.
5. **5–6 live cross-origin iframes are a resource hog.** Each is its own renderer; `display:none` does not unload. → Per-cell sleep/wake (DOM unmount + placeholder) and staggered mounting are required.
6. **Cookie auth requires one registrable domain.** UI (`dashdash.app`, Cloudflare Pages) and API (`api.dashdash.app`, Fly.io) share one registrable domain → same-site → session cookie scoped to `.dashdash.app`, `httpOnly`/`Secure`/`SameSite=Lax`, plus credentialed CORS on the API. Split registrable domains (`*.pages.dev` + `*.fly.dev`) is not acceptable.

## Architecture

Monorepo on GitHub, four concerns, two deployments under one registrable domain:

```
dashdash/                                         hosting
├── frontend/    Angular 22 — prerendered public site + CSR dashboard   → Cloudflare Pages  (dashdash.app)
│                also emits /ads.txt as a static asset
├── backend/     Spring Boot 4.1 modular monolith (REST/JSON API only)  → Fly.io           (api.dashdash.app)
├── extension/   Chrome MV3 companion (static DNR ruleset + handshake)   → Chrome Web Store
└── content/     Markdown for guides/blog, compiled into prerendered pages at build
```

Backend = modular monolith, packages `auth` · `dashboard` · `catalog` · `billing` · `ads` (+ `config`, `common`). API serves only `/api/**` + the Stripe webhook — not the frontend.

## Data model (MongoDB Atlas)

Embed over reference — a dashboard is small and always loaded whole with the user.

```
users {
  _id, email (unique idx), passwordHash?, googleSub? (sparse-unique idx), displayName,
  emailVerified, createdAt,
  dashboard: { cells: [ {slot:0..5, type: APP|AD|EMPTY, url?, title?, catalogAppId?, iconUrl?, openMode: FRAME|WINDOW}, ...×6 ] },
  subscription: { tier: FREE|PREMIUM, stripeCustomerId? (sparse-unique), stripeSubscriptionId? (sparse-unique),
                  status: NONE|ACTIVE|TRIALING|PAST_DUE|CANCELED, priceId?, currentPeriodEnd?, cancelAtPeriodEnd? }
}
catalog_apps { _id, name, url, iconUrl, category, order, compatibility: FRAMES_CLEAN|NEEDS_EXTENSION|LOGIN_IN_TAB|REFUSES_FRAME }
stripe_events { _id (= Stripe event id), type, processedAt }   // TTL index — webhook idempotency
// Spring Session collection (created by spring-session-data-mongodb, its own TTL index)
```

Indexes created explicitly at startup. Server-enforced invariant: premium derived from `subscription.status` (`ACTIVE`/`TRIALING` ⇒ premium), never a client flag. For FREE users slot 5 is always `AD`. On downgrade, an app in slot 5 moves to the first EMPTY slot; if none, the user is prompted to drop one app.

## API surface (`/api/v1`)

- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /oauth2/authorization/google`, password reset.
- Dashboard: `GET /dashboard`, `PUT /dashboard/cells`.
- Catalog: `GET /catalog`.
- Billing: `POST /billing/checkout-session`, `POST /billing/portal-session`, `POST /billing/webhook`.
- Config: `GET /config/ads`.

## Frontend (Angular 22)

Standalone components, zoneless (default v21), OnPush default (v22), signals, Signal Forms, Vitest. Public routes prerendered (SSG); dashboard is CSR behind an auth guard. Grid = CSS Grid + CDK drag-drop **swap** pattern (six single-item `cdkDropList`s in one `cdkDropListGroup`, sorting disabled). `SafeFrameComponent` owns each iframe (validate https-only, `bypassSecurityTrustResourceUrl` at render, sandbox minus `allow-top-navigation`, sleep/wake, staggered mount, pointer-events shield during drag). Ad cell is native DOM. State via `@ngrx/signals` SignalStore.

## Companion extension (Chrome MV3)

Single static `declarativeNetRequest` ruleset removing `x-frame-options` + `content-security-policy` on `sub_frame` scoped by `initiatorDomains`. `declarativeNetRequestWithHostAccess` + `optional_host_permissions` requested per-site. `postMessage` handshake so the webapp knows the extension is active. Never touches the ad slot.

## Public content + AdSense + consent

Prerendered landing + ~15–25 guides/blog + about + contact + privacy + terms. `ads.txt` at Cloudflare Pages root. Google "Privacy & messaging" CMP (TCF v2.2, Consent Mode v2), gate ad loading on consent. House "Upgrade" promo until AdSense approved.

## Billing (Stripe)

`stripe-java` 33.x pinned to a fixed API version. Checkout Session (`mode=subscription`, `client_reference_id=userId`) + Billing Portal. Webhook: verify signature on raw body, dedupe by event id, re-fetch subscription, recompute `premium = status ∈ {ACTIVE, TRIALING}`. Handle `charge.dispute.created`. Premium changes only via verified webhooks.

## Auth & security

One `SecurityFilterChain`: JSON `/auth/login` (`AuthenticationManager` + bcrypt) + `oauth2Login()` Google OIDC. Session via `spring-session-data-mongodb`, httpOnly/Secure/SameSite=Lax cookie. CSRF via `CookieCsrfTokenRepository.withHttpOnlyFalse()` + SPA handler. Credentialed CORS to `https://dashdash.app`. Iframe URLs validated https-only client + server.

## Implementation phases → plans

1. Walking skeleton → `01-walking-skeleton`
2. Auth → `02-auth`
3. Dashboard core → `03-dashboard-core`
4. Extension → `04-extension`
5. Billing → `05-billing`
6. Public content + ads → `06-content-and-ads`

## Out of scope (v1)

Multiple dashboards/workspaces; cell spanning & free resize; first-party widgets; real-window "power mode" tiling; Safari/Firefox parity; mobile-native app; non-AdSense ad networks (documented fallback ladder only).
