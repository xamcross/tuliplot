# Cell toolbar in all APP states — design

**Date:** 2026-08-01
**Status:** Approved

## Problem

Every APP cell should let the user remove or replace its website, except the ad
cell (which only Premium users are rid of). Remove (🗑) and edit (✎) exist in
the cell toolbar, but the toolbar only renders when `frameState() === 'frame'`.
Cells in the `needs-extension`, `login-in-tab`, or `load-failed` states show a
fallback panel that replaces the whole cell content, toolbar included — so an
app that can't frame (e.g. one that needs the Companion extension, or one that
opens in its own tab) is stuck in its slot with no way to remove or replace it.

## Decision

Render the toolbar for every APP cell regardless of frame state, with the
iframe-only actions hidden when the cell isn't actually framed. (Chosen over
adding remove/replace buttons to each fallback panel — which duplicates actions
across three panels and makes cell management look different per state — and
over showing the full toolbar always, which leaves reload/sleep/pop-out doing
nothing on an unframed cell.)

## Design

### 1. Cell template restructure (`cell.component.ts`)

The `<tl-cell-toolbar>` moves out of the `@case ('frame')` branch so it renders
once for every APP cell, above whichever content the state switch picks
(`tl-safe-frame` or one of the three fallback panels). The AD and EMPTY
branches are untouched — the ad cell still never gets a toolbar. The host
becomes a flex column so the fallback panel fills the remaining space under the
toolbar instead of overflowing by its height.

### 2. Reduced toolbar (`cell-toolbar.component.ts`)

New `framed` input, default `true`. When `framed` is false, the actions that
only make sense for a live iframe are hidden: reload, expand (focus), pop out,
sleep. What remains: accent dot, title, open-in-tab (↗), edit (✎), remove (🗑).
The cell passes `[framed]="frameState() === 'frame'"`.

### 3. Open-in-tab fix

The toolbar's open-in-tab button emits `openInTab`, which the grid never wired
— it silently does nothing today in any state. Since the reduced toolbar keeps
this button, the cell now handles it internally via its existing
`openInWindow()` method (the same one the fallback panels use). The `openInTab`
output is dropped from the cell's public API rather than left dead. The pop-out
button is out of scope and remains as-is (hidden when unframed).

### 4. Gating — unchanged

Edit still routes through the dashboard page's slot-5 guard; remove still
routes to `DashboardStore.clearCell`. The AD cell renders no toolbar, so free
users still cannot touch slot 5, and the backend invariants (free ⇒ slot 5 is
AD, premium ⇒ no AD cell) continue to enforce this server-side. No backend
changes.

### 5. Error handling

Nothing new. Remove/edit reuse the existing store persistence path and its
error handling; open-in-tab is a plain `window.open`.

### 6. Testing

- `cell.component` specs: toolbar renders in `needs-extension`,
  `login-in-tab`, and `load-failed` states; remove and edit events emit from
  those states; open-in-tab opens the cell URL (spy on `window.open`).
- `cell-toolbar` specs: `framed=false` hides reload/expand/pop-out/sleep and
  keeps open-in-tab/edit/remove; default `framed=true` shows all buttons.
- Existing `cell.states` and AD-cell specs updated for the new structure; the
  AD-cell spec keeps asserting no toolbar is rendered.
