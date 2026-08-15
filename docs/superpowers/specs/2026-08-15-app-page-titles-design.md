# App page titles — design

Date: 2026-08-15
Status: approved by the owner (this session)

## The problem

The three authenticated pages never set a document title. Every public page
(marketing, `/try`, `/login`, `/register`, `/404`) sets one through
`SeoService`. A user who logs in arrives at `/app` with the login page's
title still in place, so every app tab shows "Log in · TulipLot".

## The change

1. **`TlTitleStrategy`** — a new class in
   `frontend/src/app/core/services/title.strategy.ts` that extends Angular's
   `TitleStrategy`:
   - When the resolved route defines a `title`, set
     `"<title> · TulipLot"`.
   - When it does not, leave the document title unchanged. The `SeoService`
     pages own their titles; the strategy must not touch them.
   - Provide it once in `app.config.ts`:
     `{ provide: TitleStrategy, useClass: TlTitleStrategy }`.
2. **Route titles** — in `frontend/src/app/app.routes.ts`, add:
   - `/app` → `title: 'Dashboard'`
   - `/app/settings` → `title: 'Settings'`
   - `/app/upgrade` → `title: 'Upgrade'`

No component changes. No `SeoService` changes. The suffix format
("· TulipLot") matches the one `SeoService` already uses.

## Why the order is safe in both directions

- `/login` → `/app`: the strategy fires on the navigation and replaces the
  stale "Log in · TulipLot".
- `/app` → a marketing page: the strategy sees no route `title` and does
  nothing; the marketing component's `SeoService` call in its constructor
  sets the title as before.

## Testing

- `title.strategy.spec.ts`: with a routed title the document title becomes
  `"Dashboard · TulipLot"`; without one, a pre-set title survives the
  navigation.
- A route-table test asserts the three `/app` routes declare the titles
  `Dashboard`, `Settings`, `Upgrade`, so a route change cannot silently
  drop them.

## Out of scope

- Titles that reflect state (for example an unread count).
- Any change to the public pages or `SeoService`.
- Meta tags, canonicals, or JSON-LD for `/app` pages — they are behind
  login and excluded by robots.txt.
