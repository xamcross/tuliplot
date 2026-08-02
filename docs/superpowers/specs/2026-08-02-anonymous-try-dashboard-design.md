# Anonymous try-it dashboard — design

**Date:** 2026-08-02
**Status:** Approved

## Problem

Two problems, one fix.

**AdSense is blocked.** The only ad surface is the free tier's sixth cell inside `/app`, which is behind login *and* `Disallow: /app` in robots.txt. `Mediapartners-Google` cannot fetch the one page that serves ads, and a login wall stops it rendering even if robots allowed it. Waves 3–4 removed thin content as a rejection reason; this is what remains.

**There is no way to try the product.** Every visitor must create an account before seeing a single live cell, against competitors whose free tiers are usable immediately.

A public, crawlable page where a signed-out visitor uses a real (reduced) dashboard alongside a real ad cell solves both.

## Decision

`/try` — a public route rendering the familiar 3×2 grid with **2 usable cells, 3 locked cells that pitch signup, and the ad cell in slot 5**. Chosen over a compact 3×1 strip (which abandons the 3×2 identity all nine published articles describe) and over embedding a demo grid in the homepage (which puts an ad on our strongest marketing page and mixes two jobs on one URL).

The two usable cells get the **genuine product**: add from the catalog or paste any HTTPS URL, edit, remove, drag-to-swap, and the full cell toolbar. A read-only demo was rejected — it is a screenshot with extra steps, and it would read as thin to an AdSense reviewer.

## Design

### 1. One grid, two sources

`GridComponent` and `CellComponent` are already driven by cell data plus an ad config. What binds them to a logged-in user is `DashboardStore` (server-backed) and the slot-5 lock reading `AuthStore`. Rather than forking a second grid — duplicating the three cell states, toolbar gating, and framing fallbacks that Waves 1–2 hardened — introduce a provider seam:

- A `DashboardSource` interface covering exactly what the grid consumes: `cells()`, `setCell(cell)`, `clearCell(slot)`, `swap(a, b)`, and `lockedSlots()`.
- The existing `DashboardStore` implements it for `/app`; its behaviour does not change.
- A new `AnonymousDashboardStore` implements it for `/try`, persisting to `localStorage`.
- Each route provides the appropriate implementation; `GridComponent` injects the interface, not a concrete store.

**Locked cells are a render concern, not a domain concept.** `CellType` is persisted and mirrored by a backend enum; "slots 2–4 are locked" is presentation policy for one page. So no `LOCKED` enum value. `CellComponent` gains a `locked` input that short-circuits to a signup CTA, and `AnonymousDashboardStore.lockedSlots()` returns `[2, 3, 4]` while `DashboardStore`'s returns `[]`.

### 2. The page

`/try`, prerendered like the marketing pages so crawlers receive real HTML — page chrome, headline copy, the locked-cell CTAs — with the interactive grid hydrating client-side (`localStorage` is unavailable during prerender, so the prerendered grid shows empty usable cells). Added to the sitemap. **It also needs its own `_redirects` row**: it is client-interactive, and per the Wave-2 production incident any route without a row 404s on hard navigation. Rewrite destinations must be `/`, never `/index.html`.

Anonymous visitors reaching `/app` are unaffected — `authGuard` still redirects them to `/login`.

### 3. Ad configuration for signed-out visitors

`GET /api/v1/config/ads` currently requires authentication and `AdConfigService.forUser(user)` requires a `User`. It becomes `permitAll`; with no principal it returns `showAd: true` plus the configured client and slot.

No consent work is required. `ConsentService` already sets Consent Mode v2 defaults to denied, loads the CMP, and grants on the TCF signal — including `gdprApplies === false` for non-EEA visitors, which covers crawlers. EEA visitors without consent see the house promo, which remains correct. Until AdSense is approved and `adsenseClient` is configured, every visitor sees the house promo; that is the expected chicken-and-egg state and is not a defect.

### 4. Signup migration — frontend only

When a visitor registers or logs in having configured cells on `/try`, the app reads the two cells from `localStorage`, writes them into the new account's dashboard through the existing cells endpoint, and clears `localStorage`. No new endpoint, no backend change. Losing someone's two configured apps at the moment they commit would be the worst possible first impression.

### 5. Error handling

`localStorage` may be unavailable (private mode, storage disabled). `AnonymousDashboardStore` treats every read as best-effort and every write as fire-and-forget: on failure the grid still works for the session and simply does not persist. No error UI — a visitor trying the product should never see a storage error.

Migration failure after signup is likewise non-fatal: the account exists and the dashboard is empty, which the user can fill normally.

### 6. Testing

- `AnonymousDashboardStore`: seeds six cells with slots 2–4 locked and slot 5 AD; set/clear/swap confined to slots 0–1; round-trips through `localStorage`; survives `localStorage` throwing.
- `CellComponent`: a locked cell renders the signup CTA and none of the app affordances.
- `GridComponent` against the anonymous source: locked slots are not editable and not drag targets.
- Migration: after signup with two stored cells, the dashboard PUT carries them and `localStorage` is cleared.
- `/app` regression: the existing dashboard specs must pass unchanged — that is the signal that the seam did not disturb the revenue path.

## Out of scope (deliberate)

- **Abuse gating / rate limiting.** Two cells and an ad; there is nothing worth abusing.
- **The article copy pass.** All nine published articles describe only the 5-usable / 6-Premium tiers. They become incomplete, not wrong. Update them once this tier is real rather than documenting something that does not exist — a follow-up, recorded in the SEO roadmap.
- **Replacing the `ads.txt` placeholder publisher ID.** Owner action at AdSense registration.
