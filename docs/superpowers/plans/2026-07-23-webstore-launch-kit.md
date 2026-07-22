# Chrome Web Store Launch Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TulipLot Companion extension fully Chrome-Web-Store-ready in the repo — store icons, paste-ready listing copy, and a documented submission step — so the owner's post-cutover job is "upload zip and paste".

**Architecture:** Three additive changes, no runtime behavior changes. (1) PNG icons rendered from the existing `frontend/public/favicon.svg` tulip logo via a committed one-off script, wired into `manifest.json` and the build zip. (2) A `store-listing.md` containing every developer-dashboard field paste-ready, including permission justifications for the localhost grant we ship. (3) A new step 6 in the README deployment-cutover checklist covering registration, upload, and the post-approval `EXTENSION_WEBSTORE_URL` swap.

**Tech Stack:** Chrome MV3 extension (plain JS, no bundler), `node --test` (node:test, CommonJS test style), `bestzip` for packaging, `sharp` (new devDependency) for SVG→PNG rendering, Node 22.

## Global Constraints

- The manifest ships **as-is** regarding localhost (explicit owner decision): `http://localhost/*` stays in `host_permissions` and `content_scripts[0].matches`; `localhost` stays in `rules.json` `initiatorDomains`. Do not remove or gate them.
- Extension name stays exactly `TulipLot Companion`; version stays `1.0.0`.
- All extension commands run from `C:\Users\xamcr\DashDash\extension` (git-bash path `/c/Users/xamcr/DashDash/extension`). Test runner is `npm test` (`node --test`).
- New test files/edits follow the existing CommonJS style: `'use strict';` + `require('node:test')` + `assert/strict` (see `extension/test/manifest.test.js`).
- Extension suite baseline is **20 passing**; after Task 1 it must be **exactly 22 passing**. Backend (103) and frontend suites are untouched by this plan.
- **No frontend code changes.** `EXTENSION_WEBSTORE_URL` in `frontend/src/app/core/services/extension-bridge.service.ts:4` keeps its search-placeholder value; the swap to the real listing URL is a documented post-approval step (Task 3), not a code change now.
- `extension/tuliplot-companion.zip` is already in the root `.gitignore` — never commit it.
- No CI or publish automation (no chrome-webstore-upload, no GitHub Actions). Manual upload only.
- `sharp` is a **devDependency** only. The shipped extension has zero JS dependencies.
- The actual Web Store submission is a manual owner step after the tuliplot.com cutover — it is documented by this plan, not executed by it.

---

### Task 1: Store icons — render, wire into manifest, package

**Files:**
- Create: `extension/scripts/render-icons.mjs`
- Create: `extension/icons/icon16.png`, `extension/icons/icon32.png`, `extension/icons/icon48.png`, `extension/icons/icon128.png` (generated, committed)
- Modify: `extension/manifest.json` (add `icons` key)
- Modify: `extension/package.json` (add `sharp` devDependency, `icons` script, extend `build` zip list)
- Test: `extension/test/manifest.test.js` (append 2 tests)

**Interfaces:**
- Consumes: `frontend/public/favicon.svg` (existing 100×100 viewBox tulip logo, four pastel rounded squares — no fonts, no external refs).
- Produces: `icons/icon{16,32,48,128}.png` at exactly their nominal pixel sizes; manifest `icons` key mapping `"16"/"32"/"48"/"128"` → `icons/icon<size>.png`. Task 2's listing references `icons/icon128.png`. The build zip gains the four PNGs under `icons/`.

- [ ] **Step 1: Write the failing tests**

Append to `extension/test/manifest.test.js` (after the last existing test, keeping the file's existing `loadManifest` helper and requires):

```js
test('manifest declares icons at 16, 32, 48 and 128', () => {
  const m = loadManifest();
  assert.deepEqual(Object.keys(m.icons).sort((a, b) => a - b), ['16', '32', '48', '128']);
  for (const size of [16, 32, 48, 128]) {
    assert.equal(m.icons[String(size)], `icons/icon${size}.png`);
  }
});

test('every manifest icon file exists and matches its nominal pixel size', () => {
  const m = loadManifest();
  for (const [size, rel] of Object.entries(m.icons)) {
    const file = path.join(__dirname, '..', rel);
    assert.ok(fs.existsSync(file), `${rel} missing`);
    const buf = fs.readFileSync(file);
    // PNG: 8-byte signature, IHDR at 8; width big-endian at byte 16, height at 20.
    assert.equal(buf.readUInt32BE(16), Number(size), `${rel} width`);
    assert.equal(buf.readUInt32BE(20), Number(size), `${rel} height`);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `extension/`): `npm test`
Expected: `tests 22`, `pass 20`, `fail 2` — both new tests fail with `TypeError`/`AssertionError` because `m.icons` is `undefined`.

- [ ] **Step 3: Install sharp as a devDependency**

Run (from `extension/`): `npm install --save-dev sharp`
Expected: `package.json` gains `"sharp": "^0.34.x"` under `devDependencies`; `package-lock.json` updates; install succeeds with prebuilt win32-x64 binaries (no compiler needed).

- [ ] **Step 4: Create the render script and npm script**

Create `extension/scripts/render-icons.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '..', 'frontend', 'public', 'favicon.svg');
const outDir = path.join(here, '..', 'icons');

fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const out = path.join(outDir, `icon${size}.png`);
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(out);
  console.log(`rendered ${out}`);
}
```

(`density: 300` rasterizes the 100×100 SVG large, then downsamples — keeps the 128px icon crisp instead of upscaling a 100px raster.)

In `extension/package.json`, add to `scripts`:

```json
"icons": "node scripts/render-icons.mjs"
```

- [ ] **Step 5: Render the icons**

Run (from `extension/`): `npm run icons`
Expected: four `rendered ...icon<size>.png` lines; `extension/icons/` now contains `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`.

- [ ] **Step 6: Add the icons key to the manifest**

In `extension/manifest.json`, insert after the `"description"` line:

```json
"icons": {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
},
```

- [ ] **Step 7: Run tests to verify they pass**

Run (from `extension/`): `npm test`
Expected: `tests 22`, `pass 22`, `fail 0`.

- [ ] **Step 8: Include icons in the build zip and verify the package**

In `extension/package.json`, change the `build` script to:

```json
"build": "bestzip tuliplot-companion.zip manifest.json rules.json background.js content.js README.md icons/*.png"
```

Run (from `extension/`): `npm run build`
Then list the archive with Windows bsdtar (git-bash): `/c/Windows/System32/tar.exe -tf tuliplot-companion.zip`
(PowerShell equivalent: `C:\Windows\System32\tar.exe -tf tuliplot-companion.zip`)
Expected: exactly these 9 entries — `manifest.json`, `rules.json`, `background.js`, `content.js`, `README.md`, `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`. Do not commit the zip.

- [ ] **Step 9: Commit**

```bash
cd /c/Users/xamcr/DashDash
git add extension/scripts/render-icons.mjs extension/icons extension/manifest.json extension/package.json extension/package-lock.json extension/test/manifest.test.js
git commit -m "feat(extension): store icons rendered from tulip logo, wired into manifest and build zip"
```

---

### Task 2: Paste-ready Web Store listing document

**Files:**
- Create: `extension/store-listing.md`

**Interfaces:**
- Consumes: `extension/manifest.json` `name` (`TulipLot Companion`) and `description` (becomes the store's short summary — 132-char limit); `icons/icon128.png` from Task 1; the live privacy policy route `https://tuliplot.com/privacy` (already covers the extension).
- Produces: `extension/store-listing.md` — the single source the owner pastes from in Task 3's checklist step. No code consumes it.

- [ ] **Step 1: Create `extension/store-listing.md` with this exact content**

````markdown
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
````

- [ ] **Step 2: Verify the listing stays consistent with the manifest**

Run (from `extension/`):
`node -e "const m=require('./manifest.json'); console.log(m.name, '|', m.description.length)"`
Expected: `TulipLot Companion | 119` (name matches the listing's Item name; description ≤132 chars so the store summary field accepts it).

Run (from `extension/`): `grep -c "TulipLot Companion" store-listing.md`
Expected: a count ≥ 3 (name used consistently; no stale "DashDash" anywhere — also run `grep -i dashdash store-listing.md`, expected: no output).

- [ ] **Step 3: Commit**

```bash
cd /c/Users/xamcr/DashDash
git add extension/store-listing.md
git commit -m "docs(extension): paste-ready Chrome Web Store listing with permission justifications"
```

---

### Task 3: Cutover checklist step 6 — register, upload, swap the placeholder URL

**Files:**
- Modify: `README.md` (append step 6 to the "Deployment cutover (manual, owner-only)" section, currently steps 1–5 ending with the AdSense line)

**Interfaces:**
- Consumes: `extension/store-listing.md` (Task 2), `npm run build` (Task 1), the placeholder constant `EXTENSION_WEBSTORE_URL` at `frontend/src/app/core/services/extension-bridge.service.ts:4` and its test expectation at `frontend/src/app/features/dashboard/cell.states.spec.ts:98`.
- Produces: the owner-facing submission runbook. Nothing in code consumes it.

- [ ] **Step 1: Append the checklist step**

In `README.md`, directly after the existing step 5 line (`5. AdSense (later, at launch): ...`), append:

```markdown
6. Chrome Web Store (after tuliplot.com is live): register a developer account at https://chrome.google.com/webstore/devconsole ($5 one-time). Then `cd extension && npm ci && npm test && npm run build`, upload `tuliplot-companion.zip` as a new item, and fill every dashboard field by pasting from `extension/store-listing.md` (listing copy, single-purpose statement, permission justifications, privacy policy URL, screenshots per its shot list). Submit for review. On approval, copy the live listing URL and replace the placeholder `EXTENSION_WEBSTORE_URL` in `frontend/src/app/core/services/extension-bridge.service.ts` and the matching expectation in `frontend/src/app/features/dashboard/cell.states.spec.ts`, run the frontend tests (`npx vitest run`), commit, and redeploy the frontend so the "Install TulipLot Companion" button opens the real listing.
```

- [ ] **Step 2: Verify the checklist and the full extension suite**

Run: `grep -n "Chrome Web Store" /c/Users/xamcr/DashDash/README.md`
Expected: one hit inside the Deployment cutover section (step 6).

Run (from `extension/`): `npm test`
Expected: `tests 22`, `pass 22`, `fail 0` — the suite is green at plan completion.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/xamcr/DashDash
git add README.md
git commit -m "docs: add Chrome Web Store submission to deployment cutover checklist"
```
