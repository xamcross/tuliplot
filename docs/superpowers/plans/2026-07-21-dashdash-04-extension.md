# DashDash — Companion Extension Implementation Plan (Plan 04 of 06)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build the Chrome MV3 companion that strips frame-blocking headers for dashboard frames, handshakes with the webapp over `postMessage`, and drives graceful fallback ("open in a real window/tab") for sites that refuse framing.

**Architecture:** A static `declarativeNetRequest` ruleset removes `x-frame-options` + `content-security-policy` on `sub_frame` requests scoped to our origin via `initiatorDomains:["dashdash.app"]`. A service worker answers `PING`/`REQUEST_HOST` messages; a content script (injected only on `dashdash.app`) bridges page `window.postMessage` ↔ `chrome.runtime`. The Angular webapp uses `ExtensionBridgeService` to detect the extension and request per-site host access, and `SafeFrameComponent`/`CellComponent` fall back to open-in-window states when framing fails.

**Tech Stack:** Chrome MV3 (`declarativeNetRequestWithHostAccess`, `optional_host_permissions`, static DNR ruleset) · plain JavaScript · Node.js built-in test runner (`node --test`) with a mocked `chrome` global and `jsdom` · Angular 22 (standalone, zoneless, signals) · Vitest.

**Depends on:** 01 (repo, Angular scaffold, environments), 02 (`User`, models), 03 (`SafeFrameComponent`, `CellComponent`, `CatalogDialogComponent`, `Cell` model, `Compatibility`, catalog UI, `DashboardPageComponent`).

## Global Constraints

See `2026-07-21-dashdash-00-shared-contract.md` (authoritative for names/types/signatures and global constraints). This plan additionally requires:
- Extension manifest is **MV3** (`manifest_version: 3`); permission is exactly `["declarativeNetRequestWithHostAccess"]`; `optional_host_permissions` is `["*://*/*"]`; `host_permissions` is `["*://dashdash.app/*"]`.
- The DNR ruleset is a **single static rule** removing lowercase headers `x-frame-options` and `content-security-policy` on `resourceTypes:["sub_frame"]` with `initiatorDomains:["dashdash.app"]`.
- Message protocol (both sides check `event.source === window`): page→ext `{source:'dashdash',type:'PING'}` / `{source:'dashdash',type:'REQUEST_HOST',origin}`; ext→page `{source:'dashdash-ext',type:'PONG',version}` / `{source:'dashdash-ext',type:'HOST_RESULT',origin,granted}`.
- `ExtensionBridgeService` public API is exactly `installed = signal<boolean>(false)`, `version = signal<string|null>(null)`, `ping(): Promise<boolean>`, `requestHost(origin: string): Promise<boolean>`; `ping()` times out to `false` after **500ms**.
- Cell fallback state names are exactly `'needs-extension'`, `'login-in-tab'`, `'load-failed'` (Plan 03 renders them as static stubs; this plan wires the behavior).
- Open-in-window uses `window.open(url, '_blank')`. The frame load watchdog fires after **~4000ms** with no `load` event.
- The extension **never** touches the ad slot (it only strips headers on `sub_frame` from `dashdash.app`; the ad cell is native DOM and never inside an iframe).
- `extension/` JavaScript is plain CommonJS-compatible scripts (guarded `module.exports` for Node tests; guarded global registration for Chrome). No bundler.

---

### Task 1: Extension scaffold — `manifest.json`, `package.json`, `README.md`

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/package.json`
- Create: `extension/README.md`
- Test: `extension/test/manifest.test.js`

**Interfaces:**
- Consumes: nothing (this task establishes the extension package).
- Produces: `extension/manifest.json` (MV3 manifest with `version` used as the PONG version), the `extension/` package with `npm test` (`node --test`) and `npm run build` (zip) scripts, `extension/test/` directory convention for Node tests.

Steps:

- [ ] **Step 1: Write the failing test** — create `extension/test/manifest.test.js` with the complete contents:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadManifest() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8');
  return JSON.parse(raw);
}

test('manifest.json parses as a JSON object', () => {
  const m = loadManifest();
  assert.equal(typeof m, 'object');
  assert.notEqual(m, null);
});

test('manifest declares required MV3 keys', () => {
  const m = loadManifest();
  assert.equal(m.manifest_version, 3);
  assert.equal(typeof m.name, 'string');
  assert.ok(m.name.length > 0);
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.equal(typeof m.description, 'string');
});

test('manifest requests only the DNR-with-host-access permission', () => {
  const m = loadManifest();
  assert.deepEqual(m.permissions, ['declarativeNetRequestWithHostAccess']);
  assert.deepEqual(m.optional_host_permissions, ['*://*/*']);
  assert.deepEqual(m.host_permissions, ['*://dashdash.app/*']);
});

test('manifest wires the static DNR ruleset', () => {
  const m = loadManifest();
  const resources = m.declarative_net_request.rule_resources;
  assert.equal(resources.length, 1);
  assert.equal(resources[0].id, 'dashdash_frame');
  assert.equal(resources[0].path, 'rules.json');
  assert.equal(resources[0].enabled, true);
});

test('manifest wires background worker and document_start content script', () => {
  const m = loadManifest();
  assert.equal(m.background.service_worker, 'background.js');
  const cs = m.content_scripts[0];
  assert.deepEqual(cs.matches, ['*://dashdash.app/*']);
  assert.deepEqual(cs.js, ['content.js']);
  assert.equal(cs.run_at, 'document_start');
});
```

- [ ] **Step 2: Run test to verify it fails** — from the repo root run:

```
node --test extension/test/manifest.test.js
```

Expected failure: the run reports `ℹ fail 5` (or an aggregate failure) with an `ENOENT: no such file or directory` error pointing at `extension/manifest.json`, because the manifest does not exist yet.

- [ ] **Step 3: Write minimal implementation** — create `extension/manifest.json` with the complete contents:

```json
{
  "manifest_version": 3,
  "name": "DashDash Companion",
  "version": "1.0.0",
  "description": "Strips frame-blocking headers for dashboard frames on dashdash.app so your chosen sites load inside your DashDash grid.",
  "permissions": ["declarativeNetRequestWithHostAccess"],
  "optional_host_permissions": ["*://*/*"],
  "host_permissions": ["*://dashdash.app/*"],
  "declarative_net_request": {
    "rule_resources": [
      {
        "id": "dashdash_frame",
        "enabled": true,
        "path": "rules.json"
      }
    ]
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://dashdash.app/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes** — from the repo root run:

```
node --test extension/test/manifest.test.js
```

Expected success: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 5: Add the package manifest** — create `extension/package.json` with the complete contents:

```json
{
  "name": "dashdash-extension",
  "version": "1.0.0",
  "private": true,
  "description": "DashDash Companion — strips frame-blocking headers for dashboard frames on dashdash.app.",
  "scripts": {
    "test": "node --test",
    "build": "bestzip dashdash-companion.zip manifest.json rules.json background.js content.js README.md"
  },
  "devDependencies": {
    "bestzip": "^2.2.1",
    "jsdom": "^24.1.3"
  }
}
```

- [ ] **Step 6: Install dev dependencies** — from the `extension/` directory run:

```
npm install
```

Expected: `node_modules/` is created; `npm ls bestzip jsdom` lists both without `UNMET` markers. (`bestzip` powers the cross-platform `npm run build` zip; `jsdom` is used by the content-bridge test in Task 4.)

- [ ] **Step 7: Add the single-purpose store README** — create `extension/README.md` with the complete contents:

```markdown
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
```

- [ ] **Step 8: Verify the build script and README** — from the `extension/` directory run:

```
npm run build && node -e "const fs=require('fs'); if(!fs.existsSync('dashdash-companion.zip')) process.exit(1); const r=fs.readFileSync('README.md','utf8'); if(!/single purpose/i.test(r)) process.exit(1); console.log('build+readme OK')"
```

Expected: `bestzip` prints that it zipped the files, then `build+readme OK`. (The `dashdash-companion.zip` output is a build artifact — add `extension/dashdash-companion.zip` and `extension/node_modules/` to the repo's `.gitignore` if not already ignored.)

- [ ] **Step 9: Commit** —

```
git add extension/manifest.json extension/package.json extension/package-lock.json extension/README.md extension/test/manifest.test.js .gitignore
git commit -m "feat(ext): scaffold MV3 companion manifest, package, and store README"
```

---

### Task 2: DNR ruleset — `rules.json` + verification harness

**Files:**
- Create: `extension/rules.json`
- Create: `docs/extension-dnr-verification.md`
- Test: `extension/test/rules.test.js`

**Interfaces:**
- Consumes: `extension/manifest.json` `declarative_net_request.rule_resources[0].path === "rules.json"` (Task 1).
- Produces: `extension/rules.json` — the single static DNR rule the extension loads at install time; `docs/extension-dnr-verification.md` — the manual browser verification procedure.

Steps:

- [ ] **Step 1: Write the failing test** — create `extension/test/rules.test.js` with the complete contents:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadRules() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'rules.json'), 'utf8');
  return JSON.parse(raw);
}

test('rules.json is a JSON array with exactly one rule', () => {
  const rules = loadRules();
  assert.ok(Array.isArray(rules));
  assert.equal(rules.length, 1);
});

test('the rule removes both frame-blocking headers via modifyHeaders', () => {
  const [rule] = loadRules();
  assert.equal(rule.id, 1);
  assert.equal(rule.priority, 1);
  assert.equal(rule.action.type, 'modifyHeaders');
  const removed = rule.action.responseHeaders
    .filter((h) => h.operation === 'remove')
    .map((h) => h.header)
    .sort();
  assert.deepEqual(removed, ['content-security-policy', 'x-frame-options']);
});

test('the rule is scoped to sub_frame requests initiated by dashdash.app', () => {
  const [rule] = loadRules();
  assert.deepEqual(rule.condition.resourceTypes, ['sub_frame']);
  assert.deepEqual(rule.condition.initiatorDomains, ['dashdash.app']);
});
```

- [ ] **Step 2: Run test to verify it fails** — from the repo root run:

```
node --test extension/test/rules.test.js
```

Expected failure: `ℹ fail 3` with an `ENOENT` error for `extension/rules.json`.

- [ ] **Step 3: Write minimal implementation** — create `extension/rules.json` with the complete contents:

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        { "header": "x-frame-options", "operation": "remove" },
        { "header": "content-security-policy", "operation": "remove" }
      ]
    },
    "condition": {
      "resourceTypes": ["sub_frame"],
      "initiatorDomains": ["dashdash.app"]
    }
  }
]
```

- [ ] **Step 4: Run test to verify it passes** — from the repo root run:

```
node --test extension/test/rules.test.js
```

Expected success: `ℹ tests 3`, `ℹ pass 3`, `ℹ fail 0`.

- [ ] **Step 5: Write the manual verification harness doc** — create `docs/extension-dnr-verification.md` with the complete contents:

```markdown
# DNR header-strip verification (manual)

Automated tests confirm the *shape* of `rules.json`. This procedure confirms the
rule actually removes `X-Frame-Options` and `Content-Security-Policy` for frames
initiated by `dashdash.app`, and only for those.

## Prerequisites

- Chrome (or Chromium) with Developer Mode enabled at `chrome://extensions`.
- The `extension/` folder loaded via **Load unpacked**.

## Test page

Save this as `dnr-harness.html` and serve it from a host that resolves as
`dashdash.app` (add `127.0.0.1 dashdash.app` to your hosts file and serve over a
local TLS proxy, or run against the deployed `https://dashdash.app`). The frame
target is a site that sends `X-Frame-Options: SAMEORIGIN`.

```html
<!doctype html>
<title>DNR harness</title>
<h1>DNR harness (must be loaded as dashdash.app)</h1>
<iframe src="https://www.github.com/" width="600" height="400"></iframe>
```

## Steps

1. **Baseline (extension disabled).** Disable DashDash Companion at
   `chrome://extensions`, reload the harness. Expected: the iframe is blank / the
   DevTools Console shows `Refused to display 'https://www.github.com/' in a
   frame because it set 'X-Frame-Options' to 'sameorigin'`.
2. **Grant host access.** Enable the extension. In the DashDash app, add GitHub
   and approve the per-site permission prompt (or, for this harness, grant
   `github.com` at `chrome://extensions` → DashDash Companion → *Site access*).
3. **With extension enabled.** Reload the harness. Expected: the iframe renders
   GitHub. In DevTools → Network, select the `github.com` document request; the
   **Response Headers** no longer list `x-frame-options` or
   `content-security-policy`.
4. **Scope check (negative).** Open `https://www.github.com/` in a normal tab
   with an inner iframe of another XFO site (a page NOT on `dashdash.app`).
   Expected: headers are **still present** — the rule only matches sub-frames
   whose `initiatorDomains` is `dashdash.app`, so ordinary browsing is
   unaffected.

## Recording results

Log each site tested and the before/after outcome into
`docs/compatibility-matrix.md` (maintained in Task 7). Sites that still refuse to
frame after headers are stripped (major-provider logins, service-worker/PWA
sites) belong in the `refuses-frame` / `needs-ext` columns there.
```

- [ ] **Step 6: Verify the doc references both headers** — from the repo root run:

```
node -e "const s=require('fs').readFileSync('docs/extension-dnr-verification.md','utf8'); if(!/x-frame-options/i.test(s)||!/content-security-policy/i.test(s)||!/initiatorDomains|dashdash\.app/.test(s)) process.exit(1); console.log('verification doc OK')"
```

Expected: `verification doc OK`.

- [ ] **Step 7: Commit** —

```
git add extension/rules.json extension/test/rules.test.js docs/extension-dnr-verification.md
git commit -m "feat(ext): add static DNR header-strip ruleset and manual verification harness"
```

---

### Task 3: Background service worker — `PING`/`REQUEST_HOST` handling

**Files:**
- Create: `extension/background.js`
- Test: `extension/test/background.test.js`

**Interfaces:**
- Consumes: `chrome.runtime.onMessage`, `chrome.runtime.getManifest()`, `chrome.permissions.request()` (Chrome APIs, mocked in the test).
- Produces: `handleMessage(message, sender, sendResponse)` (exported for tests) which answers `{type:'PING'}` → `{source:'dashdash-ext',type:'PONG',version}` and `{type:'REQUEST_HOST',origin}` → `{source:'dashdash-ext',type:'HOST_RESULT',origin,granted}`. `version` is the manifest version.

Steps:

- [ ] **Step 1: Write the failing test** — create `extension/test/background.test.js` with the complete contents:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function installChrome(overrides) {
  const opts = overrides || {};
  const registered = [];
  global.chrome = {
    __registered: registered,
    runtime: {
      onMessage: { addListener: (fn) => registered.push(fn) },
      getManifest: () => ({ version: '1.0.0' }),
    },
    permissions: {
      request: (spec, cb) => {
        global.chrome.__lastRequest = spec;
        cb(Object.prototype.hasOwnProperty.call(opts, 'granted') ? opts.granted : true);
      },
    },
  };
}

test('the worker registers a runtime.onMessage listener on load', () => {
  installChrome();
  delete require.cache[require.resolve('../background.js')];
  require('../background.js');
  assert.equal(global.chrome.__registered.length, 1);
});

test('PING responds with PONG carrying the manifest version', () => {
  installChrome();
  const { handleMessage } = require('../background.js');
  let response;
  const ret = handleMessage({ type: 'PING' }, {}, (r) => { response = r; });
  assert.equal(ret, false);
  assert.deepEqual(response, { source: 'dashdash-ext', type: 'PONG', version: '1.0.0' });
});

test('REQUEST_HOST requests the origin wildcard and reports granted=true', () => {
  installChrome({ granted: true });
  const { handleMessage } = require('../background.js');
  let response;
  const ret = handleMessage(
    { type: 'REQUEST_HOST', origin: 'https://mail.google.com' }, {}, (r) => { response = r; },
  );
  assert.equal(ret, true);
  assert.deepEqual(global.chrome.__lastRequest, { origins: ['https://mail.google.com/*'] });
  assert.deepEqual(response, {
    source: 'dashdash-ext', type: 'HOST_RESULT', origin: 'https://mail.google.com', granted: true,
  });
});

test('REQUEST_HOST reports granted=false when the user denies', () => {
  installChrome({ granted: false });
  const { handleMessage } = require('../background.js');
  let response;
  handleMessage({ type: 'REQUEST_HOST', origin: 'https://mail.google.com' }, {}, (r) => { response = r; });
  assert.equal(response.granted, false);
});

test('unknown message types are ignored (no response, returns false)', () => {
  installChrome();
  const { handleMessage } = require('../background.js');
  let called = false;
  const ret = handleMessage({ type: 'NOPE' }, {}, () => { called = true; });
  assert.equal(ret, false);
  assert.equal(called, false);
});
```

- [ ] **Step 2: Run test to verify it fails** — from the repo root run:

```
node --test extension/test/background.test.js
```

Expected failure: `Cannot find module '../background.js'` → the run reports failing tests.

- [ ] **Step 3: Write minimal implementation** — create `extension/background.js` with the complete contents:

```js
'use strict';

// Handles messages forwarded from the dashdash.app content script.
// Returning true keeps the message channel open for an async sendResponse.
function handleMessage(message, sender, sendResponse) {
  if (!message || (message.type !== 'PING' && message.type !== 'REQUEST_HOST')) {
    return false;
  }

  if (message.type === 'PING') {
    const version = chrome.runtime.getManifest().version;
    sendResponse({ source: 'dashdash-ext', type: 'PONG', version: version });
    return false; // synchronous response
  }

  // REQUEST_HOST: ask for the per-site host permission for this origin.
  const origin = message.origin;
  chrome.permissions.request({ origins: [origin + '/*'] }, function (granted) {
    sendResponse({
      source: 'dashdash-ext',
      type: 'HOST_RESULT',
      origin: origin,
      granted: !!granted,
    });
  });
  return true; // async response
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(handleMessage);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleMessage: handleMessage };
}
```

- [ ] **Step 4: Run test to verify it passes** — from the repo root run:

```
node --test extension/test/background.test.js
```

Expected success: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 5: Commit** —

```
git add extension/background.js extension/test/background.test.js
git commit -m "feat(ext): add background worker answering PING and REQUEST_HOST"
```

---

### Task 4: Content bridge — `window.postMessage` ↔ `chrome.runtime`

**Files:**
- Create: `extension/content.js`
- Test: `extension/test/content.test.js`

**Interfaces:**
- Consumes: `handleMessage` behavior via `chrome.runtime.sendMessage` (Task 3), the page message protocol `{source:'dashdash',type:'PING'|'REQUEST_HOST',origin?}` (contract).
- Produces: `handleWindowMessage(event)` and `isPageMessage(event)` (exported for tests). Forwards page `dashdash` messages to the background and posts the `dashdash-ext` response back to the page origin.

Steps:

- [ ] **Step 1: Write the failing test** — create `extension/test/content.test.js` with the complete contents:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function setup() {
  const dom = new JSDOM('', { url: 'https://dashdash.app/' });
  const win = dom.window;
  const posted = [];
  win.postMessage = (msg) => posted.push(msg);
  global.window = win;
  global.chrome = {
    runtime: {
      sendMessage: (msg, cb) => {
        if (msg.type === 'PING') {
          cb({ source: 'dashdash-ext', type: 'PONG', version: '1.0.0' });
        } else if (msg.type === 'REQUEST_HOST') {
          cb({ source: 'dashdash-ext', type: 'HOST_RESULT', origin: msg.origin, granted: true });
        }
      },
    },
  };
  delete require.cache[require.resolve('../content.js')];
  return { win, posted, mod: require('../content.js') };
}

test('forwards a page PING and posts PONG back to the page', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'dashdash', type: 'PING' } });
  assert.deepEqual(posted, [{ source: 'dashdash-ext', type: 'PONG', version: '1.0.0' }]);
});

test('forwards a page REQUEST_HOST and posts HOST_RESULT back', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({
    source: win,
    data: { source: 'dashdash', type: 'REQUEST_HOST', origin: 'https://mail.google.com' },
  });
  assert.deepEqual(posted, [{
    source: 'dashdash-ext', type: 'HOST_RESULT', origin: 'https://mail.google.com', granted: true,
  }]);
});

test('ignores messages whose source is not this window', () => {
  const { posted, mod } = setup();
  mod.handleWindowMessage({ source: {}, data: { source: 'dashdash', type: 'PING' } });
  assert.equal(posted.length, 0);
});

test('ignores messages with a foreign data.source', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'evil', type: 'PING' } });
  assert.equal(posted.length, 0);
});

test('ignores dashdash messages with an unknown type', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'dashdash', type: 'HACK' } });
  assert.equal(posted.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails** — from the repo root run:

```
node --test extension/test/content.test.js
```

Expected failure: `Cannot find module '../content.js'` → the run reports failing tests.

- [ ] **Step 3: Write minimal implementation** — create `extension/content.js` with the complete contents:

```js
'use strict';

// True only for genuine same-window messages from the DashDash page.
function isPageMessage(event) {
  return (
    event.source === window &&
    !!event.data &&
    event.data.source === 'dashdash' &&
    (event.data.type === 'PING' || event.data.type === 'REQUEST_HOST')
  );
}

function handleWindowMessage(event) {
  if (!isPageMessage(event)) {
    return;
  }
  const outbound =
    event.data.type === 'PING'
      ? { type: 'PING' }
      : { type: 'REQUEST_HOST', origin: event.data.origin };

  chrome.runtime.sendMessage(outbound, function (response) {
    if (response) {
      window.postMessage(response, window.location.origin);
    }
  });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('message', handleWindowMessage);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleWindowMessage: handleWindowMessage, isPageMessage: isPageMessage };
}
```

- [ ] **Step 4: Run test to verify it passes** — from the repo root run:

```
node --test extension/test/content.test.js
```

Expected success: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 5: Run the whole extension suite** — from the `extension/` directory run:

```
npm test
```

Expected: all four test files (`manifest`, `rules`, `background`, `content`) discovered and passing — `ℹ fail 0`.

- [ ] **Step 6: Commit** —

```
git add extension/content.js extension/test/content.test.js
git commit -m "feat(ext): bridge page postMessage handshake to the background worker"
```

---

### Task 5: Frontend bridge service — `ExtensionBridgeService`

**Files:**
- Create: `frontend/src/app/core/services/extension-bridge.service.ts`
- Test: `frontend/src/app/core/services/extension-bridge.service.spec.ts`
- Modify: `frontend/src/app/features/dashboard/dashboard-page.component.ts` (call `ping()` on init)

**Interfaces:**
- Consumes: the page↔ext message protocol (contract); Angular `signal`, `Injectable`.
- Produces:
  - `ExtensionBridgeService` (`providedIn: 'root'`): `readonly installed = signal<boolean>(false)`, `readonly version = signal<string | null>(null)`, `ping(): Promise<boolean>` (500ms timeout → `false`), `requestHost(origin: string): Promise<boolean>` (resolves on `HOST_RESULT`).
  - `export const EXTENSION_WEBSTORE_URL: string` (Chrome Web Store listing URL, consumed by `CellComponent` in Task 6).

Steps:

- [ ] **Step 1: Write the failing test** — create `frontend/src/app/core/services/extension-bridge.service.spec.ts` with the complete contents:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExtensionBridgeService } from './extension-bridge.service';

describe('ExtensionBridgeService', () => {
  let service: ExtensionBridgeService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ExtensionBridgeService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('ping() resolves true and records installed + version on PONG', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      if ((msg as { type: string }).type === 'PING') {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'PONG', version: '1.0.0' },
            source: window,
          }),
        );
      }
    }) as typeof window.postMessage);

    const result = await service.ping();

    expect(result).toBe(true);
    expect(service.installed()).toBe(true);
    expect(service.version()).toBe('1.0.0');
  });

  it('ping() resolves false and clears installed after the 500ms timeout', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((() => {
      /* no PONG ever arrives */
    }) as typeof window.postMessage);

    const pending = service.ping();
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;

    expect(result).toBe(false);
    expect(service.installed()).toBe(false);
  });

  it('ping() ignores the page echo of its own PING message', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      // Echo the page->ext PING back on the bus (source 'dashdash'); must be ignored.
      window.dispatchEvent(new MessageEvent('message', { data: msg, source: window }));
    }) as typeof window.postMessage);

    const pending = service.ping();
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBe(false);
  });

  it('requestHost() resolves with granted from HOST_RESULT', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      const m = msg as { type: string; origin: string };
      if (m.type === 'REQUEST_HOST') {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'HOST_RESULT', origin: m.origin, granted: true },
            source: window,
          }),
        );
      }
    }) as typeof window.postMessage);

    const result = await service.requestHost('https://mail.google.com');
    expect(result).toBe(true);
  });

  it('requestHost() only resolves for its own origin', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      const m = msg as { type: string; origin: string };
      if (m.type === 'REQUEST_HOST') {
        // Response for a DIFFERENT origin must be ignored.
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'HOST_RESULT', origin: 'https://other.example', granted: true },
            source: window,
          }),
        );
        // Then the correct one.
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'HOST_RESULT', origin: m.origin, granted: false },
            source: window,
          }),
        );
      }
    }) as typeof window.postMessage);

    const result = await service.requestHost('https://mail.google.com');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — from the `frontend/` directory run:

```
npx vitest run src/app/core/services/extension-bridge.service.spec.ts
```

Expected failure: Vitest cannot resolve `./extension-bridge.service` → `Failed to load url ./extension-bridge.service` / module-not-found error.

- [ ] **Step 3: Write minimal implementation** — create `frontend/src/app/core/services/extension-bridge.service.ts` with the complete contents:

```ts
import { Injectable, signal } from '@angular/core';

/** Chrome Web Store listing for the DashDash Companion extension. */
export const EXTENSION_WEBSTORE_URL = 'https://chromewebstore.google.com/search/DashDash%20Companion';

interface ExtMessage {
  source?: string;
  type?: string;
  version?: string;
  origin?: string;
  granted?: boolean;
}

const PING_TIMEOUT_MS = 500;

@Injectable({ providedIn: 'root' })
export class ExtensionBridgeService {
  readonly installed = signal<boolean>(false);
  readonly version = signal<string | null>(null);

  /** Posts PING; resolves true on PONG, or false after 500ms with no PONG. */
  ping(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const listener = (event: MessageEvent): void => {
        const data = event.data as ExtMessage;
        if (event.source !== window || !data || data.source !== 'dashdash-ext' || data.type !== 'PONG') {
          return;
        }
        settled = true;
        window.removeEventListener('message', listener);
        clearTimeout(timer);
        this.installed.set(true);
        this.version.set(data.version ?? null);
        resolve(true);
      };

      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        window.removeEventListener('message', listener);
        this.installed.set(false);
        resolve(false);
      }, PING_TIMEOUT_MS);

      window.addEventListener('message', listener);
      window.postMessage({ source: 'dashdash', type: 'PING' }, window.location.origin);
    });
  }

  /** Posts REQUEST_HOST for `origin`; resolves with the granted flag from HOST_RESULT. */
  requestHost(origin: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const listener = (event: MessageEvent): void => {
        const data = event.data as ExtMessage;
        if (
          event.source !== window ||
          !data ||
          data.source !== 'dashdash-ext' ||
          data.type !== 'HOST_RESULT' ||
          data.origin !== origin
        ) {
          return;
        }
        window.removeEventListener('message', listener);
        resolve(!!data.granted);
      };

      window.addEventListener('message', listener);
      window.postMessage({ source: 'dashdash', type: 'REQUEST_HOST', origin }, window.location.origin);
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes** — from the `frontend/` directory run:

```
npx vitest run src/app/core/services/extension-bridge.service.spec.ts
```

Expected success: `Test Files  1 passed (1)`, `Tests  5 passed (5)`.

- [ ] **Step 5: Wire `ping()` into dashboard init** — in `frontend/src/app/features/dashboard/dashboard-page.component.ts`, add the import and inject the service, then call `ping()` after the first render. Add to the imports at the top of the file:

```ts
import { afterNextRender, inject } from '@angular/core';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
```

Inside the `DashboardPageComponent` class body add the field and the init call (place the `afterNextRender` call in the existing constructor; if the class has no constructor, add one):

```ts
  private readonly extensionBridge = inject(ExtensionBridgeService);

  constructor() {
    // ...any existing constructor body from Plan 03 stays above this line...
    afterNextRender(() => {
      void this.extensionBridge.ping();
    });
  }
```

> Note: `afterNextRender` runs in the browser only (never during prerender), so `window` is guaranteed present. `ping()` sets `installed`/`version` signals that `CellComponent` reads in Task 6.

- [ ] **Step 6: Verify the wiring type-checks and the service spec is still green** — from the `frontend/` directory run:

```
npx vitest run src/app/core/services/extension-bridge.service.spec.ts
```

Expected: still `Tests  5 passed (5)`. If Plan 03 shipped a `dashboard-page.component.spec.ts`, also run `npx vitest run src/app/features/dashboard/dashboard-page.component.spec.ts` and confirm it stays green (the service is `providedIn: 'root'`, so no test provider wiring is needed).

- [ ] **Step 7: Commit** —

```
git add frontend/src/app/core/services/extension-bridge.service.ts frontend/src/app/core/services/extension-bridge.service.spec.ts frontend/src/app/features/dashboard/dashboard-page.component.ts
git commit -m "feat(fe): add ExtensionBridgeService and ping the extension on dashboard init"
```

---

### Task 6: Framing-failure detection + fallback states

**Files:**
- Modify: `frontend/src/app/features/dashboard/safe-frame.component.ts` (add load watchdog)
- Modify: `frontend/src/app/features/dashboard/cell.component.ts` (map compatibility/openMode/load-failure → fallback states + actions)
- Test: `frontend/src/app/features/dashboard/safe-frame.watchdog.spec.ts`
- Test: `frontend/src/app/features/dashboard/cell.states.spec.ts`

**Interfaces:**
- Consumes: `SafeFrameComponent` (`url = input.required<string>()`, `asleep = input<boolean>(false)`, `loadFailed = output<void>()`) and `CellComponent` (`cell = input.required<Cell>()`) from Plan 03; `Cell`, `Compatibility` models; `ExtensionBridgeService` + `EXTENSION_WEBSTORE_URL` (Task 5).
- Produces:
  - On `SafeFrameComponent`: `onFrameLoad(): void`, `startLoadWatchdog(timeoutMs?: number): void`, and an auto-managed watchdog that emits `loadFailed` after ~4000ms when no `load` event arrives.
  - On `CellComponent`: `compatibility = input<Compatibility | null>(null)`, `frameState: Signal<'frame' | 'needs-extension' | 'login-in-tab' | 'load-failed'>`, `onFrameLoadFailed(): void`, `openInWindow(): void`, `retry(): void`, `onInstallExtension(): void`, `onEnableForThisApp(): Promise<void>`.

Steps:

- [ ] **Step 1: Write the failing watchdog test** — create `frontend/src/app/features/dashboard/safe-frame.watchdog.spec.ts` with the complete contents:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SafeFrameComponent } from './safe-frame.component';

describe('SafeFrameComponent load watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits loadFailed when no load event arrives within 4s', () => {
    const fixture = TestBed.createComponent(SafeFrameComponent);
    fixture.componentRef.setInput('url', 'https://example.com');
    fixture.componentRef.setInput('asleep', false);
    let failed = 0;
    fixture.componentInstance.loadFailed.subscribe(() => (failed += 1));

    fixture.detectChanges(); // runs the constructor effect → starts the watchdog
    vi.advanceTimersByTime(4000);

    expect(failed).toBe(1);
  });

  it('does not emit loadFailed when the frame reports load in time', () => {
    const fixture = TestBed.createComponent(SafeFrameComponent);
    fixture.componentRef.setInput('url', 'https://example.com');
    fixture.componentRef.setInput('asleep', false);
    let failed = 0;
    fixture.componentInstance.loadFailed.subscribe(() => (failed += 1));

    fixture.detectChanges();
    fixture.componentInstance.onFrameLoad();
    vi.advanceTimersByTime(4000);

    expect(failed).toBe(0);
  });

  it('does not start a watchdog while asleep', () => {
    const fixture = TestBed.createComponent(SafeFrameComponent);
    fixture.componentRef.setInput('url', 'https://example.com');
    fixture.componentRef.setInput('asleep', true);
    let failed = 0;
    fixture.componentInstance.loadFailed.subscribe(() => (failed += 1));

    fixture.detectChanges();
    vi.advanceTimersByTime(4000);

    expect(failed).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — from the `frontend/` directory run:

```
npx vitest run src/app/features/dashboard/safe-frame.watchdog.spec.ts
```

Expected failure: `fixture.componentInstance.onFrameLoad is not a function` (the method does not exist yet), and the 4s test fails because no `loadFailed` is emitted.

- [ ] **Step 3: Add the watchdog to `SafeFrameComponent`** — edit `frontend/src/app/features/dashboard/safe-frame.component.ts`.

First, ensure these symbols are imported from `@angular/core` (merge into the existing import — Plan 03 already imports several of them):

```ts
import { effect, inject, DestroyRef } from '@angular/core';
```

Add these members inside the `SafeFrameComponent` class body (private fields + the effect field + public methods):

```ts
  private loadWatchdogId: ReturnType<typeof setTimeout> | null = null;
  private didLoad = false;

  private readonly loadWatchdog = effect(() => {
    const active = !this.asleep() && !!this.url();
    if (active) {
      this.startLoadWatchdog();
    } else {
      this.cancelLoadWatchdog();
    }
  });

  private readonly frameDestroyRef = inject(DestroyRef);

  /** Bound to the iframe (load) event; cancels the watchdog. */
  onFrameLoad(): void {
    this.didLoad = true;
    this.cancelLoadWatchdog();
  }

  /** (Re)arms the 4s watchdog; emits loadFailed if no load event arrives. */
  startLoadWatchdog(timeoutMs = 4000): void {
    this.cancelLoadWatchdog();
    this.didLoad = false;
    this.loadWatchdogId = setTimeout(() => {
      if (!this.didLoad) {
        this.loadFailed.emit();
      }
    }, timeoutMs);
  }

  private cancelLoadWatchdog(): void {
    if (this.loadWatchdogId !== null) {
      clearTimeout(this.loadWatchdogId);
      this.loadWatchdogId = null;
    }
  }
```

Add the destroy cleanup — put this line inside the class constructor (create one if Plan 03's component has none):

```ts
    this.frameDestroyRef.onDestroy(() => this.cancelLoadWatchdog());
```

Finally, bind the iframe `load` event in the component template. In the `<iframe ...>` tag in the `template` string add the handler attribute:

```html
(load)="onFrameLoad()"
```

- [ ] **Step 4: Run test to verify it passes** — from the `frontend/` directory run:

```
npx vitest run src/app/features/dashboard/safe-frame.watchdog.spec.ts
```

Expected success: `Test Files  1 passed (1)`, `Tests  3 passed (3)`.

- [ ] **Step 5: Write the failing cell-states test** — create `frontend/src/app/features/dashboard/cell.states.spec.ts` with the complete contents:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CellComponent } from './cell.component';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import type { Cell } from '../../core/models/dashboard.model';

function makeCell(overrides: Partial<Cell> = {}): Cell {
  return {
    slot: 0,
    type: 'APP',
    url: 'https://mail.google.com',
    title: 'Gmail',
    catalogAppId: 'gmail',
    iconUrl: '',
    openMode: 'FRAME',
    ...overrides,
  };
}

describe('CellComponent fallback states', () => {
  let bridge: ExtensionBridgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ExtensionBridgeService],
    });
    bridge = TestBed.inject(ExtensionBridgeService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function create(cell: Cell, compatibility: string | null) {
    const fixture = TestBed.createComponent(CellComponent);
    fixture.componentRef.setInput('cell', cell);
    fixture.componentRef.setInput('compatibility', compatibility);
    return fixture;
  }

  it('needs-extension when NEEDS_EXTENSION and the extension is not installed', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    expect(fixture.componentInstance.frameState()).toBe('needs-extension');
  });

  it('frame when NEEDS_EXTENSION but the extension is installed', () => {
    bridge.installed.set(true);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    expect(fixture.componentInstance.frameState()).toBe('frame');
  });

  it('login-in-tab when openMode is WINDOW', () => {
    const fixture = create(makeCell({ openMode: 'WINDOW' }), 'REFUSES_FRAME');
    expect(fixture.componentInstance.frameState()).toBe('login-in-tab');
  });

  it('login-in-tab when compatibility is LOGIN_IN_TAB', () => {
    const fixture = create(makeCell({ openMode: 'FRAME' }), 'LOGIN_IN_TAB');
    expect(fixture.componentInstance.frameState()).toBe('login-in-tab');
  });

  it('load-failed after the frame reports a load failure', () => {
    const fixture = create(makeCell(), 'FRAMES_CLEAN');
    expect(fixture.componentInstance.frameState()).toBe('frame');
    fixture.componentInstance.onFrameLoadFailed();
    expect(fixture.componentInstance.frameState()).toBe('load-failed');
  });

  it('retry() clears the load-failure flag', () => {
    const fixture = create(makeCell(), 'FRAMES_CLEAN');
    fixture.componentInstance.onFrameLoadFailed();
    expect(fixture.componentInstance.frameState()).toBe('load-failed');
    fixture.componentInstance.retry();
    expect(fixture.componentInstance.frameState()).toBe('frame');
  });

  it('openInWindow() opens the cell url in a new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const fixture = create(makeCell(), 'LOGIN_IN_TAB');
    fixture.componentInstance.openInWindow();
    expect(openSpy).toHaveBeenCalledWith('https://mail.google.com', '_blank');
  });

  it('onEnableForThisApp() requests host permission for the cell origin', async () => {
    const reqSpy = vi.spyOn(bridge, 'requestHost').mockResolvedValue(true);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    await fixture.componentInstance.onEnableForThisApp();
    expect(reqSpy).toHaveBeenCalledWith('https://mail.google.com');
  });

  it('onInstallExtension() opens the web store listing', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.componentInstance.onInstallExtension();
    expect(openSpy).toHaveBeenCalledWith(
      'https://chromewebstore.google.com/search/DashDash%20Companion',
      '_blank',
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails** — from the `frontend/` directory run:

```
npx vitest run src/app/features/dashboard/cell.states.spec.ts
```

Expected failure: `fixture.componentInstance.frameState is not a function` / `setInput('compatibility', ...)` fails because the `compatibility` input does not exist yet.

- [ ] **Step 7: Wire the states into `CellComponent`** — edit `frontend/src/app/features/dashboard/cell.component.ts`. The blocks below are the exact, final state of every `CellComponent` member and template region Plan 04 touches; apply them verbatim so the result is deterministic (no reconciling against a hypothetical Plan-03 variant).

Plan 03's `cell.component.ts` already imports `Component`, `input`, and `output` from `@angular/core`. Extend that same `@angular/core` import so it also includes `computed`, `signal`, and `inject`:

```ts
import { input, computed, signal, inject } from '@angular/core';
```

Add these two imports at the top of the file (`Cell` is already imported by Plan 03 for the `cell` input — do not add a second `Cell` import; `Compatibility` correctly comes from `enums.ts`):

```ts
import { ExtensionBridgeService, EXTENSION_WEBSTORE_URL } from '../../core/services/extension-bridge.service';
import type { Compatibility } from '../../core/models/enums';
```

Add these members inside the `CellComponent` class body exactly as written — the `ExtensionBridgeService` is obtained via `inject()`, `frameState` is the single source of truth for which panel renders, and the action methods drive the fallback buttons (input, injected service, load-failure flag, `frameState` computed, and action methods):

```ts
  readonly compatibility = input<Compatibility | null>(null);

  private readonly bridge = inject(ExtensionBridgeService);
  private readonly loadFailedFlag = signal(false);

  readonly frameState = computed<'frame' | 'needs-extension' | 'login-in-tab' | 'load-failed'>(() => {
    const cell = this.cell();
    if (cell.type !== 'APP') {
      return 'frame';
    }
    if (this.loadFailedFlag()) {
      return 'load-failed';
    }
    const compat = this.compatibility();
    if (compat === 'NEEDS_EXTENSION' && !this.bridge.installed()) {
      return 'needs-extension';
    }
    if (compat === 'LOGIN_IN_TAB' || cell.openMode === 'WINDOW') {
      return 'login-in-tab';
    }
    return 'frame';
  });

  /** Called from SafeFrameComponent (loadFailed) output. */
  onFrameLoadFailed(): void {
    this.loadFailedFlag.set(true);
  }

  /** Re-attempt framing after a load failure. */
  retry(): void {
    this.loadFailedFlag.set(false);
  }

  /** Fallback: open the app in a real browser tab. */
  openInWindow(): void {
    const url = this.cell().url;
    if (url) {
      window.open(url, '_blank');
    }
  }

  /** needs-extension CTA: open the Chrome Web Store listing. */
  onInstallExtension(): void {
    window.open(EXTENSION_WEBSTORE_URL, '_blank');
  }

  /** needs-extension CTA: grant this app's origin to the extension, then retry. */
  async onEnableForThisApp(): Promise<void> {
    const url = this.cell().url;
    if (!url) {
      return;
    }
    const origin = new URL(url).origin;
    const granted = await this.bridge.requestHost(origin);
    if (granted) {
      this.loadFailedFlag.set(false);
    }
  }
```

Now set the template. This block is the final `@if (cell().type === 'APP')` branch of `CellComponent`'s `template`: paste it in place of Plan 03's APP branch and its three static `needs-extension` / `login-in-tab` / `load-failed` stubs. It selects the frame vs. fallback panel from `frameState()`, and its `<dd-safe-frame>` element uses the shared-contract selector:

```html
@if (cell().type === 'APP') {
  @switch (frameState()) {
    @case ('frame') {
      <dd-safe-frame
        [url]="cell().url!"
        [title]="cell().title ?? ''"
        [asleep]="dragging()"
        (loadFailed)="onFrameLoadFailed()" />
    }
    @case ('needs-extension') {
      <div class="cell-fallback" data-state="needs-extension">
        <p>This app needs the DashDash Companion extension to load in the grid.</p>
        <button type="button" (click)="onInstallExtension()">Install DashDash Companion</button>
        <button type="button" (click)="onEnableForThisApp()">Enable for this site</button>
        <button type="button" (click)="openInWindow()">Open in a tab instead</button>
      </div>
    }
    @case ('login-in-tab') {
      <div class="cell-fallback" data-state="login-in-tab">
        <p>{{ cell().title }} opens in its own browser tab.</p>
        <button type="button" (click)="openInWindow()">Open in a tab</button>
      </div>
    }
    @case ('load-failed') {
      <div class="cell-fallback" data-state="load-failed">
        <p>{{ cell().title }} didn't load in the grid.</p>
        <button type="button" (click)="retry()">Retry</button>
        <button type="button" (click)="openInWindow()">Open in a tab</button>
      </div>
    }
  }
}
```

> Binding notes (deterministic — this is the final wiring, not one of several options): `[asleep]="dragging()"` freezes the frame while the cell is being dragged, reusing Plan 03's `dragging` input — the only sleep-related state `CellComponent` owns per the shared contract (`CellComponent` has just the `cell` and `dragging` inputs; sleep/wake is ephemeral UI state, not a `CellComponent` input). `SafeFrameComponent`'s `asleep` input keeps the shared-contract `SafeFrameComponent` API unchanged. `(loadFailed)="onFrameLoadFailed()"` routes the watchdog's `loadFailed` output into `onFrameLoadFailed()`, which sets `loadFailedFlag` so `frameState()` becomes `'load-failed'`.

- [ ] **Step 8: Run test to verify it passes** — from the `frontend/` directory run:

```
npx vitest run src/app/features/dashboard/cell.states.spec.ts
```

Expected success: `Test Files  1 passed (1)`, `Tests  9 passed (9)`.

- [ ] **Step 9: Run both new dashboard specs together** — from the `frontend/` directory run:

```
npx vitest run src/app/features/dashboard/safe-frame.watchdog.spec.ts src/app/features/dashboard/cell.states.spec.ts
```

Expected: `Test Files  2 passed (2)`, `Tests  12 passed (12)`.

- [ ] **Step 10: Commit** —

```
git add frontend/src/app/features/dashboard/safe-frame.component.ts frontend/src/app/features/dashboard/cell.component.ts frontend/src/app/features/dashboard/safe-frame.watchdog.spec.ts frontend/src/app/features/dashboard/cell.states.spec.ts
git commit -m "feat(fe): detect framing failure and fall back to open-in-window states"
```

---

### Task 7: Compatibility wiring + matrix

**Files:**
- Create: `frontend/src/app/core/services/compatibility.util.ts`
- Test: `frontend/src/app/core/services/compatibility.util.spec.ts`
- Modify: `frontend/src/app/features/dashboard/catalog-dialog.component.ts` (badges + openMode on add)
- Create: `docs/compatibility-matrix.md`

**Interfaces:**
- Consumes: `Compatibility`, `OpenMode`, `Cell`, `CatalogApp` models (contract); `CatalogDialogComponent` (Plan 03), `DashboardStore.setCell` (`setCell(cell: Cell): void`, contract).
- Produces:
  - `export function compatibilityBadge(c: Compatibility): string` — badge label per compatibility.
  - `export function openModeFor(c: Compatibility): OpenMode` — the `openMode` to assign when adding a catalog app.
  - `docs/compatibility-matrix.md` — the living compatibility doc seeded with the catalog apps.

Steps:

- [ ] **Step 1: Write the failing test** — create `frontend/src/app/core/services/compatibility.util.spec.ts` with the complete contents:

```ts
import { describe, it, expect } from 'vitest';
import { compatibilityBadge, openModeFor } from './compatibility.util';

describe('compatibilityBadge', () => {
  it('labels FRAMES_CLEAN as works without extension', () => {
    expect(compatibilityBadge('FRAMES_CLEAN')).toBe('works without extension');
  });

  it('labels NEEDS_EXTENSION as needs extension', () => {
    expect(compatibilityBadge('NEEDS_EXTENSION')).toBe('needs extension');
  });

  it('labels LOGIN_IN_TAB as opens in tab', () => {
    expect(compatibilityBadge('LOGIN_IN_TAB')).toBe('opens in tab');
  });

  it('labels REFUSES_FRAME as opens in tab', () => {
    expect(compatibilityBadge('REFUSES_FRAME')).toBe('opens in tab');
  });
});

describe('openModeFor', () => {
  it('uses WINDOW for REFUSES_FRAME', () => {
    expect(openModeFor('REFUSES_FRAME')).toBe('WINDOW');
  });

  it('uses WINDOW for LOGIN_IN_TAB', () => {
    expect(openModeFor('LOGIN_IN_TAB')).toBe('WINDOW');
  });

  it('uses FRAME for FRAMES_CLEAN', () => {
    expect(openModeFor('FRAMES_CLEAN')).toBe('FRAME');
  });

  it('uses FRAME for NEEDS_EXTENSION', () => {
    expect(openModeFor('NEEDS_EXTENSION')).toBe('FRAME');
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — from the `frontend/` directory run:

```
npx vitest run src/app/core/services/compatibility.util.spec.ts
```

Expected failure: cannot resolve `./compatibility.util` → module-not-found error.

- [ ] **Step 3: Write minimal implementation** — create `frontend/src/app/core/services/compatibility.util.ts` with the complete contents:

```ts
import type { Compatibility, OpenMode } from '../models/enums';

/** Human-readable badge shown in the catalog for each compatibility class. */
export function compatibilityBadge(c: Compatibility): string {
  switch (c) {
    case 'FRAMES_CLEAN':
      return 'works without extension';
    case 'NEEDS_EXTENSION':
      return 'needs extension';
    case 'LOGIN_IN_TAB':
    case 'REFUSES_FRAME':
      return 'opens in tab';
  }
}

/** The openMode a new cell should get when adding a catalog app. */
export function openModeFor(c: Compatibility): OpenMode {
  return c === 'REFUSES_FRAME' || c === 'LOGIN_IN_TAB' ? 'WINDOW' : 'FRAME';
}
```

- [ ] **Step 4: Run test to verify it passes** — from the `frontend/` directory run:

```
npx vitest run src/app/core/services/compatibility.util.spec.ts
```

Expected success: `Test Files  1 passed (1)`, `Tests  8 passed (8)`.

- [ ] **Step 5: Render badges and set openMode in the catalog dialog** — edit `frontend/src/app/features/dashboard/catalog-dialog.component.ts`.

Add the import:

```ts
import { compatibilityBadge, openModeFor } from '../../core/services/compatibility.util';
```

Expose the badge helper as a class method so the template can call it (add inside `CatalogDialogComponent`):

```ts
  badgeFor(app: CatalogApp): string {
    return compatibilityBadge(app.compatibility);
  }
```

In the catalog list template, add a badge next to each app entry (place inside the per-app `@for` row):

```html
<span class="compat-badge" [attr.data-compat]="app.compatibility">{{ badgeFor(app) }}</span>
```

In the "add app" handler that builds the `Cell` and calls `DashboardStore.setCell(...)`, set `openMode` from the app's compatibility. Replace the `openMode` assignment in the constructed cell so the added `Cell` looks like:

```ts
    const cell: Cell = {
      slot: targetSlot,
      type: 'APP',
      url: app.url,
      title: app.name,
      catalogAppId: app.id,
      iconUrl: app.iconUrl,
      openMode: openModeFor(app.compatibility),
    };
    this.dashboardStore.setCell(cell);
```

> `targetSlot` and `this.dashboardStore` are the existing Plan-03 members of `CatalogDialogComponent`; only the `openMode` source changes (from a hard-coded `'FRAME'` to `openModeFor(app.compatibility)`).

- [ ] **Step 6: Verify the catalog dialog still compiles and its util is used** — from the `frontend/` directory run:

```
npx vitest run src/app/core/services/compatibility.util.spec.ts
```

Expected: still `Tests  8 passed (8)`. If Plan 03 shipped `catalog-dialog.component.spec.ts`, also run `npx vitest run src/app/features/dashboard/catalog-dialog.component.spec.ts` and confirm it stays green.

- [ ] **Step 7: Create the living compatibility matrix** — create `docs/compatibility-matrix.md` with the complete contents:

```markdown
# DashDash compatibility matrix (living doc)

How each catalog app behaves inside a DashDash grid cell. Update this table from
the `docs/extension-dnr-verification.md` procedure whenever a new app is tested.

- **frames-clean** — loads in the grid with no extension.
- **needs-ext** — loads only when DashDash Companion strips headers.
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
```

- [ ] **Step 8: Verify the matrix has the required columns** — from the repo root run:

```
node -e "const s=require('fs').readFileSync('docs/compatibility-matrix.md','utf8'); for (const c of ['frames-clean','needs-ext','samesite-loggedout','refuses-frame','recommended openMode']) { if(!s.includes(c)) { console.error('missing column: '+c); process.exit(1); } } console.log('matrix columns OK')"
```

Expected: `matrix columns OK`.

- [ ] **Step 9: Commit** —

```
git add frontend/src/app/core/services/compatibility.util.ts frontend/src/app/core/services/compatibility.util.spec.ts frontend/src/app/features/dashboard/catalog-dialog.component.ts docs/compatibility-matrix.md
git commit -m "feat(fe): show compatibility badges and choose openMode on add; seed compatibility matrix"
```

---

## Done criteria (whole plan)

- `cd extension && npm test` → all four Node test files pass (`ℹ fail 0`).
- `cd extension && npm run build` → produces `dashdash-companion.zip`.
- Loading `extension/` unpacked in Chrome: the DNR rule strips `x-frame-options` + `content-security-policy` on `sub_frame` from `dashdash.app` only (verified via `docs/extension-dnr-verification.md`).
- `cd frontend && npx vitest run src/app/core/services/extension-bridge.service.spec.ts src/app/features/dashboard/safe-frame.watchdog.spec.ts src/app/features/dashboard/cell.states.spec.ts src/app/core/services/compatibility.util.spec.ts` → all pass.
- The dashboard pings the extension on init; `CellComponent` renders `needs-extension` / `login-in-tab` / `load-failed` fallbacks with working install/enable/open-in-tab/retry actions; catalog apps get the correct `openMode` on add and show a compatibility badge.
