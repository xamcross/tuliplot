# Logout action — design

**Date:** 2026-08-01
**Status:** Approved

## Problem

A logged-in user has no way to log out. The full pipeline exists — backend
`POST /auth/logout` (`AuthController.java`), `AuthApi.logout()`, and
`AuthStore.logout` (clears the user, sets status `anonymous`, degrades to a
local logout on network error) — but no UI element calls it, and nothing
navigates the user off `/app` afterward.

## Decision

A "Log out" button in the settings page's Account card, using
fire-and-navigate semantics. (Placement chosen over a topbar control — the
topbar has no user element today and the gear already reaches settings in one
click. Fire-and-navigate chosen over effect-based reactive navigation — the
marketing landing shows nothing auth-dependent, so waiting for the store to
report `anonymous` buys no user-visible correctness.)

## Design

### UI

In `settings.component.ts`, the Account card's existing avatar/name/email row
gains a "Log out" button at the row's right edge:

- Markup: `<button type="button" class="logout tl-btn tl-btn--soft tl-btn--sm"
  data-testid="logout-btn" (click)="onLogout()">Log out</button>` appended
  inside the `.account` row; the button takes `margin-left: auto`.
- No changes to the topbar, site header, store, API, or backend.

### Behavior

`onLogout()` calls `authStore.logout()` then `router.navigateByUrl('/')`.
The store is root-scoped, so the logout HTTP request completes in the
background after the settings component is destroyed. A later visit to `/app`
without logging in is redirected to `/login` by the existing `authGuard`.

### Error handling

Nothing new in the pipeline. `AuthStore.logout`'s `catchError` clears the
in-memory user and sets `anonymous` even when the network call fails, so the
UI treats the user as logged out. Caveat, on record: if the `/auth/logout`
request never reaches the server, the httpOnly session cookie survives and a
later reload's `loadMe()` will silently restore the session — the client
cannot clear an httpOnly cookie itself. Retry-on-reconnect is a possible
future hardening item.

### Testing

Settings component spec: clicking `[data-testid="logout-btn"]` calls
`AuthStore.logout` and navigates to `/`. No other surface changes.
