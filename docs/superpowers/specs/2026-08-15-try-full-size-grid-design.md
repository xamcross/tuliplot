# /try full-size grid — design

Date: 2026-08-15
Status: approved by the owner (this session)

## The problem

The `/try` page renders its six cells as thin strips. The authenticated `/app`
page renders the same grid at almost the full viewport. The owner wants the
`/try` cells at the same size as the `/app` cells.

The root cause is a CSS height chain. `GridComponent` uses `height: 100%`.
That percentage resolves only against a definite parent height.

- `/app` gives it one: `.page { height: 100vh }` → `.grid-area { flex: 1 }`.
- `/try` does not: the host uses `min-height: 100vh`. A `min-height` does not
  make the element's height definite. The percentage collapses to the content
  height, and the cells shrink to thin strips. The `min-height: 460px` on the
  grid area cannot reach the percentage-height grid inside it.

## What does not change

- The tier: two usable cells (slots 0–1), three signup-locked cells
  (slots 2–4), one ad cell (slot 5).
- `GridComponent`, `CellComponent`, `AnonymousDashboardStore`, the try→account
  migration, and all backend code.
- Published articles and FAQ structured data. They state cell counts, not
  pixel sizes.
- The page's SEO metadata (`SeoService` call) and its prerender status.

## The change — `TryPageComponent` only

Mirror the `/app` sizing frame:

1. **Host**: `height: 100vh` fixed flex column (the same frame as `/app`'s
   `.page`). Replace `min-height: 100vh`.
2. **Intro strip**: the intro block (h1 + pitch + CTA) becomes one compact
   strip above the grid. The `h1` stays an `h1` for SEO, styled smaller. The
   pitch shortens to one sentence. The "Get all five cells free →" button
   keeps its `/register` route. The row wraps on narrow screens.
3. **Grid area**: `flex: 1; min-height: 0; padding: 12px`, full width. Remove
   the `max-width: 1120px` cap and the `min-height: 460px` floor.
4. **Site header**: `tl-site-header` stays; `/try` is a public page and keeps
   the public navigation.

Result: cells match `/app`'s cell width exactly. Cell height is `/app`'s
minus the strip's height. Small screens squeeze the grid the same way `/app`
does; the design adds no mobile-specific branch.

## Copy

Only the on-page pitch sentence shortens. Every count it states stays true:
two cells now, five free on signup, six with Premium. No other file changes.

## Testing

jsdom does not compute real layout, so unit tests pin structure, not pixels:

- The strip renders the `h1` and the `/register` CTA link.
- The grid renders 6 `tl-cell` elements with 3 locked cells (existing test).
- The extension-bridge ping test stays.

Acceptance is a live browser check after deploy: open `/try` and `/app` side
by side; cell widths are equal; `/try` cell height is `/app`'s minus the
strip. Verify one live cell (for example Wikipedia) renders inside a `/try`
cell at the new size.

## Out of scope

- Any change to cell counts, locking, or the ad slot.
- A shared page-shell component for `/app` and `/try` (rejected as a
  premature abstraction for two pages).
- Mobile-specific layout work beyond what the flex frame already gives.
