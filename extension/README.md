# TulipLot Companion

## Single purpose

TulipLot Companion has one single purpose: it removes the response headers that
prevent websites from being displayed inside a frame (`X-Frame-Options` and
`Content-Security-Policy`) **only** for frames that are embedded by the TulipLot
dashboard at `https://tuliplot.com`. This lets the sites you add to your TulipLot
grid render inside the grid.

## Why each permission is requested

- `declarativeNetRequestWithHostAccess` — apply the static header-stripping rule
  set (`rules.json`) using the host permissions you have granted. The rule only
  matches sub-frame requests whose initiator is `tuliplot.com` (or `localhost`,
  for local development of the open-source dashboard).
- `host_permissions: ["*://tuliplot.com/*", "http://localhost/*"]` — inject the
  tiny handshake content script (`content.js`) so the TulipLot web app — or a
  local development copy of it — can detect that the extension is installed.
- `optional_host_permissions: ["*://*/*"]` — requested **per-site, on demand**
  when you add an app to your grid that needs header stripping. Nothing is
  granted up front; you approve each site. The dashboard can also send a
  read-only `CHECK_HOST` query. The extension answers it from
  `chrome.permissions.contains` and does not show a prompt. The dashboard uses
  the answer to decide when to show the "Enable for this site" button.

## What it does NOT do

- It never reads or modifies page content, cookies, or form data.
- It never touches the advertisement cell (the ad is native DOM, never a frame).
- It only strips headers for frames initiated by `tuliplot.com` (or `localhost`
  during local development of the dashboard); ordinary browsing on other sites
  is unaffected.

## Known limitation

Chrome requires `chrome.permissions.request` to run during a user gesture. The
web app calls `REQUEST_HOST` in response to a click on the "Enable for this site"
button; if Chrome rejects the request for lack of an active gesture, the app
falls back to opening the site in a real tab.
