# TulipLot Companion

## Single purpose

TulipLot Companion has one single purpose: it removes the response headers that
prevent websites from being displayed inside a frame (`X-Frame-Options` and
`Content-Security-Policy`) **only** for frames that are embedded by the TulipLot
dashboard at `https://tuliplot.com`. This lets the sites you add to your TulipLot
grid render inside the grid.

## Why each permission is requested

- `declarativeNetRequestWithHostAccess` — apply the header-removal rule with
  the host permissions you have granted. The worker keeps one session rule that
  removes the two headers from sub-frame responses. The rule lists the tab ids
  of the open TulipLot dashboard tabs (or a local development copy on
  `localhost`), so it acts only inside those tabs. The API also requires a host
  permission for each response the rule modifies, so it acts only on sites you
  have approved. (A rule scoped by `initiatorDomains` does not match the frame
  navigations that a page creates itself, so tab scoping is used instead.)
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
- It only strips headers inside open TulipLot dashboard tabs (or `localhost`
  tabs during local development of the dashboard); ordinary browsing in other
  tabs is unaffected.

## Known limitation

Chrome requires `chrome.permissions.request` to run during a user gesture. The
web app calls `REQUEST_HOST` in response to a click on the "Enable for this site"
button; if Chrome rejects the request for lack of an active gesture, the app
falls back to opening the site in a real tab.
