# TulipLot compatibility matrix (living doc)

How each catalog app behaves inside a TulipLot grid cell. Update this table from
the `docs/extension-dnr-verification.md` procedure whenever a new app is tested.

- **frames-clean** — loads in the grid with no extension.
- **needs-ext** — loads only when TulipLot Companion strips headers.
- **samesite-loggedout** — frames, but shows logged-out because the site uses
  `SameSite=Lax/Strict` cookies (cross-site iframe sends no cookie).
- **refuses-frame** — refuses to frame even with headers stripped (major-provider
  login, service-worker/PWA). Must open in a real tab.
- **recommended openMode** — the `Cell.openMode` assigned on add
  (`FRAME` or `WINDOW`).

| domain | frames-clean | needs-ext | samesite-loggedout | refuses-frame | recommended openMode |
|---|---|---|---|---|---|
| mail.google.com (Gmail) | | | | yes | WINDOW |
| calendar.google.com (Google Calendar) | | | | yes | WINDOW |
| keep.google.com (Google Keep) | | yes | | | FRAME |
| trello.com (Trello) | | yes | | | FRAME |
| notion.so (Notion) | | yes | | | FRAME |
| todoist.com (Todoist) | | yes | | | FRAME |
| news.ycombinator.com (Hacker News) | yes | | | | FRAME |
| en.wikipedia.org (Wikipedia) | yes | | | | FRAME |
| weather.com (Weather) | | yes | | | FRAME |
| outlook.office.com (Outlook) | | | | yes | WINDOW |
| web.whatsapp.com (WhatsApp Web) | | | | yes | WINDOW |
| figma.com (Figma) | | yes | | | FRAME |

## Mapping to `Compatibility`

- frames-clean → `FRAMES_CLEAN` → openMode `FRAME`
- needs-ext / samesite-loggedout → `NEEDS_EXTENSION` → openMode `FRAME`
- refuses-frame → `REFUSES_FRAME` → openMode `WINDOW`
- sites that always require an interactive login in their own tab →
  `LOGIN_IN_TAB` → openMode `WINDOW`

The `Compatibility` value seeded per app lives in the backend `CatalogSeeder`
(Plan 03). Keep this table and the seeder in sync.
