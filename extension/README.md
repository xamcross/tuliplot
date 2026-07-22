# DashDash Companion

## Single purpose

DashDash Companion has one single purpose: it removes the response headers that
prevent websites from being displayed inside a frame (`X-Frame-Options` and
`Content-Security-Policy`) **only** for frames that are embedded by the DashDash
dashboard at `https://dashdash.app`. This lets the sites you add to your DashDash
grid render inside the grid.

## Why each permission is requested

- `declarativeNetRequestWithHostAccess` — apply the static header-stripping rule
  set (`rules.json`) using the host permissions you have granted. The rule only
  matches sub-frame requests whose initiator is `dashdash.app`.
- `host_permissions: ["*://dashdash.app/*"]` — inject the tiny handshake content
  script (`content.js`) so the DashDash web app can detect that the extension is
  installed.
- `optional_host_permissions: ["*://*/*"]` — requested **per-site, on demand**
  when you add an app to your grid that needs header stripping. Nothing is
  granted up front; you approve each site.

## What it does NOT do

- It never reads or modifies page content, cookies, or form data.
- It never touches the advertisement cell (the ad is native DOM, never a frame).
- It only strips headers for frames initiated by `dashdash.app`; ordinary
  browsing on other sites is unaffected.

## Known limitation

Chrome requires `chrome.permissions.request` to run during a user gesture. The
web app calls `REQUEST_HOST` in response to a click on the "Enable for this site"
button; if Chrome rejects the request for lack of an active gesture, the app
falls back to opening the site in a real tab.
