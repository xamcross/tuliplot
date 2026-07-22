# TulipLot Companion — Chrome Web Store listing (paste-ready)

Every section below maps to a field in the Chrome Web Store developer
dashboard (https://chrome.google.com/webstore/devconsole). Paste as-is unless
a note says otherwise. Submit only after https://tuliplot.com is live —
reviewers visit the site named in the permission justifications.

## Store listing tab

**Item name** (from the uploaded package; must match `manifest.json` → `name`):
TulipLot Companion

**Summary** (auto-filled from `manifest.json` → `description`, 132-char max —
do not retype, just verify it shows):
> Strips frame-blocking headers for dashboard frames on tuliplot.com so your
> chosen sites load inside your TulipLot grid.

**Description** (paste into the long-description field):

TulipLot (https://tuliplot.com) is a personal dashboard that shows the sites
you choose in a grid of live frames. Many sites send headers
(X-Frame-Options, Content-Security-Policy) that tell the browser not to
display them inside frames, so those cells stay blank.

TulipLot Companion fixes exactly that, and nothing else. It uses Chrome's
declarativeNetRequest API to remove those two response headers — but only for
sub-frame requests embedded by the TulipLot dashboard, and only for sites
where you have explicitly granted access.

HOW IT WORKS
• You add a site to your TulipLot grid.
• If the site refuses to load in a frame, TulipLot shows an "Enable for this
  site" button.
• Clicking it asks Chrome for permission for that one site. Nothing is
  granted up front.
• Once granted, the frame-blocking headers are removed for that site's frames
  inside TulipLot only. Ordinary browsing of the same site in normal tabs is
  completely unaffected.

WHAT IT NEVER DOES
• It never reads or changes page content, cookies, form data, or browsing
  history.
• It never runs on pages other than tuliplot.com (where a tiny script lets
  the dashboard detect that the extension is installed).
• It never strips headers for frames outside the TulipLot dashboard.
• It collects no data at all — nothing is stored, transmitted, or shared.

The extension is open source: https://github.com/xamcross/tuliplot

**Category:** Workflow & Planning (pick Tools if that category is not offered)
**Language:** English

**Graphic assets:**
- Store icon (128×128): `icons/icon128.png` — the dashboard prefills it from
  the uploaded package; upload the file manually only if it asks.
- Screenshots (1–5, 1280×800 preferred, 640×400 accepted) — capture at
  submit time from a locally running app with the extension loaded unpacked:
  1. The dashboard grid with 3–4 sites rendering inside cells. Use neutral
     public sites (e.g. wikipedia.org, developer.mozilla.org) — no personal
     or logged-in content visible.
  2. A fallback cell showing the "Install TulipLot Companion" /
     "Enable for this site" buttons — this demonstrates the per-site opt-in.
  3. (Optional) The Chrome per-site permission prompt mid-flow.
  Capture at 100% zoom and crop out all browser chrome (tabs, URL bar — it
  would show localhost); the final image must be exactly 1280×800 or 640×400.

## Privacy tab

**Single purpose description:**
TulipLot Companion has one purpose: remove the X-Frame-Options and
Content-Security-Policy response headers for sub-frames embedded by the
TulipLot dashboard (tuliplot.com), for sites the user has individually
approved, so those sites can display inside the user's TulipLot grid.

**Permission justifications** (one dashboard field per permission):

- `declarativeNetRequestWithHostAccess` — Applies the static header-removal
  ruleset (rules.json) that strips X-Frame-Options and Content-Security-Policy
  from sub-frame responses. The rule is conditioned on initiatorDomains
  tuliplot.com (plus localhost for development builds), so it only affects
  frames embedded by the TulipLot dashboard, and only on hosts the user has
  granted.

- Host permission `*://tuliplot.com/*` — Injects a tiny handshake content
  script on the TulipLot web app only, so the dashboard can detect that the
  extension is installed and route per-site permission requests through it.
  It reads no page data.

- Host permission `http://localhost/*` — Supports development and pre-release
  testing of the open-source TulipLot dashboard running on the developer's
  own machine (same handshake script and frame-only header rule). It reads no
  page data and has no effect on ordinary localhost pages beyond the inert
  handshake listener.

- Optional host permissions `*://*/*` — Never granted at install. When the
  user adds a site to their grid that blocks framing, the dashboard shows an
  "Enable for this site" button; clicking it triggers
  chrome.permissions.request for that single origin. Users approve sites one
  at a time and can revoke any of them at chrome://extensions → TulipLot
  Companion → Site access. Per-site optional access is the only way to support
  arbitrary user-chosen sites without requesting broad access up front.

- Remote code: **No.** All code ships in the package; no eval, no remote
  scripts.

**Data usage:** the extension collects no user data. Check none of the data
categories, then certify the required disclosure statements.

**Privacy policy URL:** https://tuliplot.com/privacy
(The policy explicitly covers "the optional Chrome companion extension".)

## Distribution tab

- Payments: Free
- Visibility: Public
- Regions: All regions

## If review rejects

- **"Broad host permissions" (`*://*/*`):** reply that all-host access is
  declared under `optional_host_permissions`, is never requested at install,
  is granted per-origin only via an explicit user gesture, and is revocable
  at chrome://extensions. The core function (framing arbitrary user-chosen
  sites) is impossible without per-site optional access. Point to the
  packaged README's permission table.
- **"localhost permission in a production extension":** reply that it enables
  local development of the open-source dashboard
  (https://github.com/xamcross/tuliplot); the rule still applies only to
  sub-frames whose initiator is the dashboard, and the content script is an
  inert handshake listener.
- **Re-submission mechanics:** make the fix, bump `version` in
  `manifest.json` (e.g. 1.0.0 → 1.0.1), run `npm run build`, upload the new
  zip from the item's Package tab.
