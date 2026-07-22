# TulipLot Rename & Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product from DashDash (working title) to **TulipLot** (domain **tuliplot.com**) at every depth — branding, domains, infra names, code internals — then apply the Soft Pastel visual design from `design_mocks/` to every page and surface of the app.

**Architecture:** Two strictly sequential phases. **Phase 1 (Tasks 1–6)** is the mechanical rename, verified green by the existing 217-test suite with zero visual change. **Phase 2 (Tasks 7–17)** builds a global SCSS design-token layer plus shared shell components, then restyles each page against its mock. Restyle edits happen on final (renamed) names; any regression bisects cleanly to one phase.

**Tech Stack:** Angular 22 (standalone, signals, inline templates/styles), plain SCSS with CSS custom properties, `@fontsource` self-hosted fonts, Spring Boot 4.1 / Java 25, MV3 extension, Vitest / JUnit / node:test.

## Global Constraints

- **"dashboard" is a generic word and is NEVER renamed** — `DashboardService`, `dashboard.store.ts`, `/app` routes, `docs/…dashboard-core` etc. all keep their names. Only brand tokens change: `DashDash`, `dashdash`, `Dashdash`, the `dd-`/`app-` selector prefixes, and the `dashdash.app` domain.
- **Canonical new names (use these exact values everywhere):** product **TulipLot**; domain **tuliplot.com**; API host **api.tuliplot.com**; cookie domain **.tuliplot.com**; Java package **com.tuliplot**; Gradle group **com.tuliplot**; Gradle root project **tuliplot-backend**; Spring app name **tuliplot-backend**; config key prefix **tuliplot.** ; session cookie **TULIPSESSION**; Mongo DB **tuliplot**; Fly app **api-tuliplot**; Angular selector prefix **tl-**; extension name **TulipLot Companion**; DNR rule resource id **tuliplot_frame**; page↔extension message sources **'tuliplot'** (page→ext) and **'tuliplot-ext'** (ext→page); contact emails **hello@ / support@ / privacy@ tuliplot.com** (mocks say `@tuliplot.app` — the mocks are wrong, the domain decision is `.com`).
- **Historical artifacts stay untouched:** everything under `docs/superpowers/specs/2026-07-21-*` and `docs/superpowers/plans/2026-07-21-*` (filenames AND content), git history, and `DashDash-Task:` commit trailers. They are the record of the DashDash era.
- **Phase 2 must not change behavior:** never remove or rename a `data-testid`, `role`, or `aria-*` attribute; keep every component's inputs/outputs, events, and public methods; all existing specs stay green (the only allowed spec edits are selector strings updated in Task 4 and brand-copy string expectations updated in Task 5).
- **Design authority:** the per-page files in `design_mocks/*.dc.html` (Soft Pastel direction). `design_mocks/DashDash Landing.dc.html` is a three-direction exploration doc — only its direction **1c Soft Pastel** matters, and the individual page mocks supersede it. Mocks are desktop-only: apply the responsive rules in the Design System Contract below.
- **Frontend commands** need Node v22: prepend `C:\Users\xamcr\.dashdash-tooling\node-v22.22.3-win-x64` to PATH (`export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"` in Git Bash). (This tooling path keeps its old name — it is outside the repo.)
- **Backend test runs** need Docker Desktop running and `DOCKER_API_VERSION=1.44` exported. All Gradle commands: `cd backend && ./gradlew --no-daemon build`.
- **Git:** sequential execution only — one worker commits at a time (see memory: parallel agents racing on `git add -A` corrupted history once). Work on `main`. Every commit message ends with trailers:
  ```
  TulipLot-Task: T<n>
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- **Known-red baseline:** the GitHub Actions backend job fails on runner-side Testcontainers networking (pre-existing infra issue, documented in memory). Local backend build green = pass. Do not try to fix CI in this plan.
- Baseline test counts to preserve: **backend 103, frontend 97, extension 20**.

---

## Design System Contract (authoritative for Phase 2)

All values extracted from the mocks. Token names are defined once in `styles.scss` (Task 7); every later task uses tokens/classes, never raw hex (raw hex allowed only for values used exactly once, e.g. a thumbnail tint).

### Fonts (self-hosted via @fontsource)

| Role | Family | Weights | Token |
|---|---|---|---|
| Display / headings / logo | Space Grotesk | 400,500,600,700 | `--tl-font-display` |
| Body / UI | DM Sans | 400,500,600,700 | `--tl-font-body` |
| Eyebrows, field labels, meta, badges | Space Mono | 400,700 | `--tl-font-mono` |

### Color tokens

| Token | Value | Usage |
|---|---|---|
| `--tl-ink` | `#33304a` | primary text, headings |
| `--tl-ink-soft` | `#605c78` | muted text, nav links |
| `--tl-ink-faint` | `#9c98ad` | faint meta, footer © |
| `--tl-ink-label` | `#7a7690` | field labels, "Last updated" |
| `--tl-prose` | `#4a4663` | article body text |
| `--tl-prose-lead` | `#3f3b56` | lead paragraphs |
| `--tl-primary` | `#4D96FF` | brand blue: CTAs, links, active nav |
| `--tl-primary-hover` | `#2f7ae5` | link hover |
| `--tl-primary-tint` | `#EAF2FF` | eyebrow bg, premium card bg |
| `--tl-pink` / `--tl-pink-ink` | `#FFB1B1` / `#7a3838` | pastel 1 (logo sq 1) |
| `--tl-peach` / `--tl-peach-ink` / `--tl-peach-tint` | `#FFD8A8` / `#8a5a1f` / `#FFF1E0` | pastel 2 (logo sq 2); Free-plan badge; Tips/Basics pill |
| `--tl-sky` / `--tl-sky-ink` / `--tl-sky-tint` | `#A5D8FF` / `#1f5a8a` / `#DCEEFF` | pastel 3 (logo sq 3); Advanced pill |
| `--tl-mint` / `--tl-mint-ink` / `--tl-mint-tint` | `#B2F2BB` / `#2b6b39` / `#DBF5E1` | pastel 4 (logo sq 4); Billing pill; Premium badge |
| `--tl-lilac` / `--tl-lilac-ink` / `--tl-lilac-tint` | `#D0BFFF` / `#54398a` / `#EEE6FF` | pastel 5; Product pill; code chip text |
| `--tl-surface` | `#FBFAFE` | card-on-white surface, inputs bg, cell headers |
| `--tl-surface-2` | `#F7F6FB` | landing grid-preview bg |
| `--tl-surface-3` | `#F2F0F7` | secondary buttons, code chip bg |
| `--tl-app-bg` | `#F0EEF7` | dashboard/app page bg, header hairline, skeleton bars |
| `--tl-border` | `#ECE9F4` | default card/footer border |
| `--tl-border-strong` | `#E2DFF0` | input borders, secondary button border |
| `--tl-border-cell` | `#E7E3F2` | dashboard cell border |
| `--tl-border-dashed` | `#cfc9e0` | ad-slot / empty-cell dashed border |
| `--tl-grad` | `linear-gradient(135deg,#EAF2FF,#F3EEFF)` | auth page bg, marketing hero bands |
| `--tl-shadow-card` | `0 20px 50px rgba(120,110,160,0.14)` | floating cards (auth, upgrade, dialogs) |
| `--tl-shadow-btn` | `0 8px 20px rgba(77,150,255,0.3)` | primary CTA glow |

### Shape & type vocabulary

- Radii: pills/buttons `999px`; floating cards `24px`; cards `20px`; small cards `16px`; blog thumbs `14px`; cells/inputs `12px`; contact swatches `11px`; code chip `5px`; logo squares `3px` (2px in compact app top bar).
- H1 sizes: landing 60px; list pages 48px; legal 44px; article detail 42px; auth/app cards 28–32px. All Space Grotesk 700, `letter-spacing:-0.02em`, ink.
- Content max-widths: landing sections 1120px; blog list 900px; prose pages 760px; articles 720px; settings 600px; upgrade card 460px; auth card 400px.
- Prose specs: marketing prose 17px/1.65 `--tl-ink-soft` with 18px lead in `--tl-prose-lead`, H2 24px; article prose 17px/1.7 `--tl-prose`, H2 23px; legal prose 16px/1.65 `--tl-ink-soft`, H2 22px.
- Category pill map (`.tl-pill--amber|lilac|sky|mint|neutral`): Tips/Basics→amber (`--tl-peach-ink` on `--tl-peach-tint`); Product→lilac; Advanced→sky; Billing→mint; unknown categories→neutral (`--tl-ink-soft` on `--tl-surface-3`).
- Responsive rules (mocks are desktop-only): at `≤960px` all multi-column marketing grids collapse to 1 column (pricing 2→1, features/steps 3→1, contact cards 3→1, guides/blog cards → 1); at `≤720px` the 56px page paddings become 24px and H1s scale down one step (60→42, 48→34, 44→32, 42→30); header nav text links (`Guides/Blog/About`) hide at `≤640px` leaving logo + Log in + Get started. The dashboard grid stays 3×2 at all sizes (Chrome-first desktop product).
- Cell accent colors: pastel per slot, cycling `[--tl-pink, --tl-sky, --tl-mint, --tl-peach, --tl-lilac]` by `slot % 5`.

### Shared shell components (built in Tasks 8 & 13, consumed everywhere after)

- `<tl-logo [link]="'/'" [compact]="false" />` — 2×2 pastel squares + "TulipLot" wordmark.
- `<tl-site-header />` — sticky translucent marketing header; active link via `routerLinkActive`.
- `<tl-site-footer />` — marketing footer (About/Contact/Privacy/Terms + ©).
- `<tl-app-topbar [mode]="'dashboard' | 'back'" />` — white app top bar; `dashboard` mode shows plan badge + Go Premium + settings gear; `back` mode shows "← Back to dashboard".

---

# Phase 1 — Rename (Tasks 1–6, zero visual change)

### Task 1: Backend Java package + brand-class rename

**Files:**
- Move: `backend/src/main/java/com/dashdash/**` → `backend/src/main/java/com/tuliplot/**`
- Move: `backend/src/test/java/com/dashdash/**` → `backend/src/test/java/com/tuliplot/**`
- Modify: `backend/settings.gradle` (rootProject.name), `backend/build.gradle` (group)
- Rename classes: `DashdashApplication`→`TuliplotApplication`, `DashOidcUser`→`TulipOidcUser`, `DashOidcUserService`→`TulipOidcUserService`, `DashUserDetails`→`TulipUserDetails`, `DashUserDetailsService`→`TulipUserDetailsService`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: package `com.tuliplot` with classes `TuliplotApplication`, `TulipOidcUser(Service)`, `TulipUserDetails(Service)` — Task 2 edits files under these new paths.

- [ ] **Step 1: Baseline build (must be green before touching anything)**

Run (Git Bash):
```bash
cd /c/Users/xamcr/DashDash/backend && export DOCKER_API_VERSION=1.44 && ./gradlew --no-daemon build
```
Expected: `BUILD SUCCESSFUL`, 103 tests. If red, STOP — fix the environment (Docker Desktop running?) before proceeding.

- [ ] **Step 2: Move the package directories**

```bash
cd /c/Users/xamcr/DashDash
git mv backend/src/main/java/com/dashdash backend/src/main/java/com/tuliplot
git mv backend/src/test/java/com/dashdash backend/src/test/java/com/tuliplot
```

- [ ] **Step 3: Sweep `com.dashdash` → `com.tuliplot` in all backend text files**

```bash
cd /c/Users/xamcr/DashDash
grep -rl "com\.dashdash" backend --include="*.java" --include="*.gradle" --include="*.kts" | xargs sed -i 's/com\.dashdash/com.tuliplot/g'
```
Then edit by hand:
- `backend/settings.gradle`: `rootProject.name = "tuliplot-backend"`
- `backend/build.gradle`: `group = "com.tuliplot"` (already covered by the sed if written as `com.dashdash`; verify).

- [ ] **Step 4: Rename the five brand classes (longest names first, then `git mv` the files)**

```bash
cd /c/Users/xamcr/DashDash
grep -rlE "DashdashApplication|DashOidcUser|DashUserDetails" backend/src | xargs sed -i \
  -e 's/DashdashApplication/TuliplotApplication/g' \
  -e 's/DashOidcUserService/TulipOidcUserService/g' \
  -e 's/DashOidcUser/TulipOidcUser/g' \
  -e 's/DashUserDetailsService/TulipUserDetailsService/g' \
  -e 's/DashUserDetails/TulipUserDetails/g'
git mv backend/src/main/java/com/tuliplot/DashdashApplication.java backend/src/main/java/com/tuliplot/TuliplotApplication.java
git mv backend/src/main/java/com/tuliplot/auth/DashOidcUser.java backend/src/main/java/com/tuliplot/auth/TulipOidcUser.java
git mv backend/src/main/java/com/tuliplot/auth/DashOidcUserService.java backend/src/main/java/com/tuliplot/auth/TulipOidcUserService.java
git mv backend/src/main/java/com/tuliplot/auth/DashUserDetails.java backend/src/main/java/com/tuliplot/auth/TulipUserDetails.java
git mv backend/src/main/java/com/tuliplot/auth/DashUserDetailsService.java backend/src/main/java/com/tuliplot/auth/TulipUserDetailsService.java
```
Note the sed order: `DashOidcUserService` before `DashOidcUser`, `DashUserDetailsService` before `DashUserDetails` — otherwise the shorter pattern mangles the longer name. Test classes under `backend/src/test/**` referencing these (e.g. `@MockitoBean TulipOidcUserService` in `HealthControllerTest`) are covered by the same sed; there are no test *files* named after these classes to `git mv` (verify with `ls backend/src/test/java/com/tuliplot/auth/`; if any `Dash*Test.java` exists, `git mv` it to the `Tulip*` name too).

- [ ] **Step 5: Guard greps**

```bash
cd /c/Users/xamcr/DashDash
grep -rnE "com\.dashdash|DashdashApplication|DashOidcUser|DashUserDetails" backend/src backend/build.gradle backend/settings.gradle
```
Expected: no output. Then confirm generic names survived:
```bash
grep -rl "DashboardService" backend/src | head -3
```
Expected: files still found (Dashboard* untouched).

- [ ] **Step 6: Build green**

```bash
cd /c/Users/xamcr/DashDash/backend && export DOCKER_API_VERSION=1.44 && ./gradlew --no-daemon build
```
Expected: `BUILD SUCCESSFUL`, 103 tests.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/xamcr/DashDash && git add -A backend && git commit -m "refactor(backend): rename package com.dashdash to com.tuliplot and brand classes

TulipLot-Task: T1
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend config keys, domains, cookie, DB name, Fly app

**Files:**
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/com/tuliplot/config/SecurityConfig.java` (3 `@Value` keys), `config/SessionConfig.java` (4 `@Value` keys), `config/CorsConfig.java` (1), `billing/StripeConfig.java` (`@ConfigurationProperties` prefix), `auth/PasswordResetService.java` (1)
- Modify: `backend/src/test/java/com/tuliplot/**` — every test referencing `DASHSESSION`, `dashdash.*` property keys, or `dashdash.app` URLs (known: `auth/AuthControllerLoginTest.java`, `auth/AuthControllerSessionTest.java`, `billing/StripeConfigTest.java`, `billing/StripeServiceCheckoutTest.java`, `billing/StripeServicePortalTest.java`, `ads/AdConfigControllerTest.java` — find the full set with the Step 1 grep)
- Modify: `backend/fly.toml`

**Interfaces:**
- Consumes: package `com.tuliplot` from Task 1.
- Produces: config keys `tuliplot.session.*`, `tuliplot.cors.allowed-origins`, `tuliplot.oauth2.success-url`, `tuliplot.stripe.*`, `tuliplot.ui.base-url`; cookie `TULIPSESSION`; default DB `tuliplot`. Nothing after Task 2 touches these again.

- [ ] **Step 1: Tests first — flip every test expectation to the new names, watch them fail**

```bash
cd /c/Users/xamcr/DashDash
grep -rln "DASHSESSION\|dashdash" backend/src/test | xargs sed -i \
  -e 's/DASHSESSION/TULIPSESSION/g' \
  -e 's/dashdash\.app/tuliplot.com/g' \
  -e 's/dashdash\./tuliplot./g' \
  -e 's/dashdash/tuliplot/g'
cd backend && export DOCKER_API_VERSION=1.44 && ./gradlew --no-daemon test
```
Expected: FAILURES (tests now expect `TULIPSESSION` / `tuliplot.*` while main code still serves the old names). If everything passes, the sweep missed the tests — investigate before continuing.

- [ ] **Step 2: Update main sources**

Apply the same token swaps to main config code and yml:
```bash
cd /c/Users/xamcr/DashDash
grep -rln "DASHSESSION\|dashdash" backend/src/main | xargs sed -i \
  -e 's/DASHSESSION/TULIPSESSION/g' \
  -e 's/dashdash\.app/tuliplot.com/g' \
  -e 's/dashdash\./tuliplot./g' \
  -e 's/dashdash/tuliplot/g'
```
Then open `backend/src/main/resources/application.yml` and verify the result reads exactly:
- `spring.application.name: tuliplot-backend`
- Mongo URIs (both default and dev profile): `mongodb://localhost:27017/tuliplot?maxPoolSize=50&minPoolSize=5`
- Top-level key `tuliplot:` with `session.cookie-name: TULIPSESSION`, `cors.allowed-origins: ${CORS_ALLOWED_ORIGINS:https://tuliplot.com,http://localhost:4200}`, `oauth2.success-url: ${OAUTH2_SUCCESS_URL:https://tuliplot.com/app}`, `stripe.checkout-success-url: ${STRIPE_CHECKOUT_SUCCESS_URL:https://tuliplot.com/app?checkout=success}`, `stripe.checkout-cancel-url: ${STRIPE_CHECKOUT_CANCEL_URL:https://tuliplot.com/app/upgrade?checkout=cancel}`, `stripe.portal-return-url: ${STRIPE_PORTAL_RETURN_URL:https://tuliplot.com/app/settings}`
- Comments updated too (`COOKIE_DOMAIN=.tuliplot.com`).

And verify the five Java files bind the new keys: `SecurityConfig` (`tuliplot.session.cookie-domain`, `tuliplot.session.cookie-secure`, `tuliplot.oauth2.success-url`), `SessionConfig` (`tuliplot.session.*`, default `TULIPSESSION`), `CorsConfig` (`tuliplot.cors.allowed-origins`), `StripeConfig` (`@ConfigurationProperties(prefix = "tuliplot.stripe")`), `PasswordResetService` (`@Value("${tuliplot.ui.base-url:https://tuliplot.com}")`).

- [ ] **Step 3: Build green**

```bash
cd /c/Users/xamcr/DashDash/backend && export DOCKER_API_VERSION=1.44 && ./gradlew --no-daemon build
```
Expected: `BUILD SUCCESSFUL`, 103 tests.

- [ ] **Step 4: fly.toml + guard grep**

Edit `backend/fly.toml`: `app = "api-tuliplot"`. Then:
```bash
cd /c/Users/xamcr/DashDash && grep -rin "dashdash" backend
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/xamcr/DashDash && git add -A backend && git commit -m "refactor(backend): rename config keys, cookie, DB, domains and Fly app to TulipLot

TulipLot-Task: T2
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Extension + page↔extension protocol rename

The message protocol (`source: 'dashdash'` / `'dashdash-ext'`) spans the extension AND `frontend/src/app/core/services/extension-bridge.service.ts` — both sides change in this one task so no intermediate commit has a split protocol.

**Files:**
- Modify: `extension/manifest.json`, `extension/rules.json`, `extension/background.js`, `extension/content.js`, `extension/README.md`, `extension/package.json` (name field, if `dashdash` appears)
- Modify: `extension/test/manifest.test.js`, `test/rules.test.js`, `test/background.test.js`, `test/content.test.js`
- Modify: `frontend/src/app/core/services/extension-bridge.service.ts`, `extension-bridge.service.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (frontend/extension only).
- Produces: protocol constants `'tuliplot'` / `'tuliplot-ext'`; manifest name `TulipLot Companion`; DNR `initiatorDomains: ["tuliplot.com", "localhost"]`. Nothing later touches the extension.

- [ ] **Step 1: Tests first — update expectations in all 4 extension test files + the bridge spec**

```bash
cd /c/Users/xamcr/DashDash
sed -i -e "s/dashdash-ext/tuliplot-ext/g" -e "s/dashdash\.app/tuliplot.com/g" -e "s/dashdash_frame/tuliplot_frame/g" -e "s/DashDash Companion/TulipLot Companion/g" -e "s/DashDash/TulipLot/g" -e "s/Dashdash/Tuliplot/g" -e "s/dashdash/tuliplot/g" extension/test/*.test.js frontend/src/app/core/services/extension-bridge.service.spec.ts
```

- [ ] **Step 2: Run both suites — expect failures**

```bash
cd /c/Users/xamcr/DashDash/extension && npm test
cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" && npx vitest run src/app/core/services/extension-bridge.service.spec.ts
```
Expected: FAIL (tests expect `tuliplot*`, implementation still says `dashdash*`).

- [ ] **Step 3: Update implementations**

```bash
cd /c/Users/xamcr/DashDash
sed -i -e "s/dashdash-ext/tuliplot-ext/g" -e "s/dashdash\.app/tuliplot.com/g" -e "s/dashdash_frame/tuliplot_frame/g" -e "s/DashDash Companion/TulipLot Companion/g" -e "s/DashDash/TulipLot/g" -e "s/Dashdash/Tuliplot/g" -e "s/dashdash/tuliplot/g" extension/manifest.json extension/rules.json extension/background.js extension/content.js extension/README.md extension/package.json frontend/src/app/core/services/extension-bridge.service.ts
```
Then verify `extension/manifest.json` reads exactly:
```json
{
  "manifest_version": 3,
  "name": "TulipLot Companion",
  "version": "1.0.0",
  "description": "Strips frame-blocking headers for dashboard frames on tuliplot.com so your chosen sites load inside your TulipLot grid.",
  "permissions": ["declarativeNetRequestWithHostAccess"],
  "optional_host_permissions": ["*://*/*"],
  "host_permissions": ["*://tuliplot.com/*", "http://localhost/*"],
  "declarative_net_request": {
    "rule_resources": [
      { "id": "tuliplot_frame", "enabled": true, "path": "rules.json" }
    ]
  },
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    {
      "matches": ["*://tuliplot.com/*", "http://localhost/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ]
}
```
and `extension/rules.json` has `"initiatorDomains": ["tuliplot.com", "localhost"]`. `EXTENSION_WEBSTORE_URL` in the bridge service keeps its placeholder value (real listing URL is a launch-time concern).

- [ ] **Step 4: Both suites green**

Same two commands as Step 2. Expected: extension 20/20 PASS; bridge spec PASS. Then run the full frontend suite to catch strays: `npx vitest run` → 97 pass.

- [ ] **Step 5: Guard grep + commit**

```bash
cd /c/Users/xamcr/DashDash && grep -rin "dashdash" extension --exclude-dir=node_modules
```
Expected: no output.
```bash
git add -A extension frontend/src/app/core/services && git commit -m "refactor(extension): rename to TulipLot Companion, target tuliplot.com, new message protocol

TulipLot-Task: T3
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend selector prefix `tl-` + env/config

**Files:**
- Modify: `frontend/angular.json` (`"prefix": "tl"`)
- Modify: `frontend/src/index.html` (`<tl-root>`, `<title>TulipLot</title>`)
- Modify: `frontend/src/environments/environment.prod.ts` (or the prod block in `environment.ts` — whichever file holds `apiBaseUrl: 'https://api.dashdash.app/api/v1'`) → `https://api.tuliplot.com/api/v1`
- Modify: every `*.component.ts` selector + every template/spec referencing them (sweep below)

**Interfaces:**
- Consumes: `'tuliplot'` protocol from Task 3 (already in the bridge service — untouched here).
- Produces: the complete selector map used by ALL Phase 2 tasks:
  `tl-root, tl-landing, tl-about, tl-contact, tl-privacy, tl-terms, tl-guides-list, tl-guide-detail, tl-blog-list, tl-blog-detail, tl-login, tl-register, tl-dashboard-page, tl-grid, tl-cell, tl-cell-toolbar, tl-safe-frame, tl-catalog-dialog, tl-add-url-dialog, tl-ad-cell, tl-settings, tl-upgrade`

- [ ] **Step 1: Sweep `dd-` → `tl-` with a word boundary (protects `add-btn`, `add-url` is renamed intentionally? NO —)**

Careful: `\bdd-` does NOT match inside `add-btn`/`add-url` (both preceded by a word character), but DOES match every real selector token. Run:
```bash
cd /c/Users/xamcr/DashDash/frontend/src
grep -rlE "\bdd-" . | xargs sed -i -E 's/\bdd-/tl-/g'
```
Note `dd-add-url-dialog` → `tl-add-url-dialog` (the `add-url` part is untouched — only the leading `dd-` matches).

- [ ] **Step 2: Replace the eleven `app-*` selectors explicitly (never a bare `app-` sweep)**

```bash
cd /c/Users/xamcr/DashDash/frontend/src
grep -rlE "\bapp-(root|login|register|about|contact|privacy|terms|landing|blog-detail|blog-list|guide-detail|guides-list)\b" . | xargs sed -i -E 's/\bapp-(root|login|register|about|contact|privacy|terms|landing|blog-detail|blog-list|guide-detail|guides-list)\b/tl-\1/g'
```
(Covers component decorators, `index.html`'s `<app-root>`, and any spec `querySelector` strings.)

- [ ] **Step 3: angular.json prefix, index title, prod API URL**

- `frontend/angular.json`: `"prefix": "tl"`.
- `frontend/src/index.html`: `<title>TulipLot</title>` (body tag already swept to `<tl-root>`).
- Prod environment file: `apiBaseUrl: 'https://api.tuliplot.com/api/v1'` (find it: `grep -rn "api.dashdash.app" frontend/src/environments/`).

- [ ] **Step 4: Verify — suite + build + guard**

```bash
cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"
npx vitest run          # expected: 97 pass
npx ng build            # expected: success, 12 prerendered routes
grep -rnE "\bdd-|api\.dashdash\.app" src && echo LEFTOVERS || echo CLEAN   # expected: CLEAN
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "refactor(frontend): unify selector prefix on tl-, point prod API at api.tuliplot.com

TulipLot-Task: T4
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend brand copy, SEO, content markdown, sitemap

Mechanical brand swap ONLY — page copy is reworded to match the mocks in Phase 2, not here.

**Files:**
- Modify: `frontend/src/app/core/services/seo.service.ts` (`· TulipLot` title suffix, `https://tuliplot.com` canonical base)
- Modify: brand strings in `app.component.ts` (browser notice), `features/auth/login.component.ts`, `register.component.ts`, `features/marketing/*.ts` (landing, about, contact, privacy, terms + list/detail components), `features/dashboard/cell.component.ts` ("DashDash Companion" fallback copy → "TulipLot Companion")
- Modify: `content/guides/*.md` (3 files), `content/blog/dashboard-productivity-tips.md`, `content/README.md`
- Move: `content/blog/why-we-built-dashdash.md` → `content/blog/why-we-built-tuliplot.md`
- Regenerate: `frontend/src/app/features/marketing/content.generated.ts` (via `npm run generate:content` — never hand-edit)
- Modify: `frontend/public/sitemap.xml` (12 URLs → `https://tuliplot.com/...`, blog slug updated), `frontend/public/robots.txt` (sitemap URL, if present)

**Interfaces:**
- Consumes: `tl-` selectors from Task 4.
- Produces: blog slug `why-we-built-tuliplot` (route `/blog/why-we-built-tuliplot`); emails `hello@tuliplot.com` etc. Phase 2 keeps this copy where the mocks don't dictate otherwise.

- [ ] **Step 1: Sweep brand tokens in frontend source + content**

```bash
cd /c/Users/xamcr/DashDash
git mv content/blog/why-we-built-dashdash.md content/blog/why-we-built-tuliplot.md
grep -rli "dashdash" frontend/src/app content frontend/public --include="*.ts" --include="*.md" --include="*.xml" --include="*.txt" | grep -v content.generated.ts | xargs sed -i -e 's/dashdash\.app/tuliplot.com/g' -e 's/DashDash/TulipLot/g' -e 's/Dashdash/Tuliplot/g' -e 's/why-we-built-dashdash/why-we-built-tuliplot/g' -e 's/dashdash/tuliplot/g'
```
Then check for the old slug anywhere else (prerender route lists, spec expectations):
```bash
grep -rn "why-we-built" frontend/src frontend/public frontend/scripts frontend/angular.json | grep -v generated
```
Update any hit to the new slug.

- [ ] **Step 2: Regenerate content + fix string-assertion specs**

```bash
cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"
npm run generate:content
npx vitest run
```
Expected: content.generated.ts now says TulipLot / new slug. If any spec fails on a copy assertion (e.g. a heading string), update the expected string to the TulipLot wording — assertions must not be weakened, only re-pointed.

- [ ] **Step 3: Build + guard**

```bash
npx ng build    # 12 prerendered routes, now including /blog/why-we-built-tuliplot
grep -rin "dashdash" src public ../content && echo LEFTOVERS || echo CLEAN   # expected: CLEAN
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/xamcr/DashDash && git add -A frontend content && git commit -m "refactor(frontend): TulipLot branding in copy, SEO, content and sitemap

TulipLot-Task: T5
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Docs, design-mocks housekeeping, repo rename, final sweep

**Files:**
- Modify: `README.md`, `docs/verify-skeleton.md`, `docs/extension-dnr-verification.md`, `docs/adsense-launch-checklist.md`
- Move: `design_mocks/DashDash Landing.dc.html` → `design_mocks/Landing-directions.dc.html`
- Add (currently untracked): `design_mocks/` — the authoritative design source, referenced by Phase 2
- External: GitHub repo rename `xamcross/dashdash` → `xamcross/tuliplot`

**Interfaces:**
- Consumes: everything renamed in T1–T5.
- Produces: committed `design_mocks/` for Phase 2 tasks to read; README "Deployment cutover" checklist for the user.

- [ ] **Step 1: Update operational docs**

In `README.md` and the three `docs/*.md` files: `DashDash`→`TulipLot`, `dashdash.app`→`tuliplot.com`, repo URL → `https://github.com/xamcross/tuliplot`, Fly app → `api-tuliplot`, DB → `tuliplot`, cookie → `TULIPSESSION`, extension name → `TulipLot Companion`. Use the Task 5 sed pattern scoped to these four files.

- [ ] **Step 2: Add a "Deployment cutover (manual, owner-only)" section to README.md**

```markdown
## Deployment cutover (manual, owner-only)

Code targets tuliplot.com; these account-level steps complete the rename:
1. Cloudflare: register tuliplot.com; point the Pages project at it (custom domain), keep `www` redirect.
2. Fly.io: `fly apps create api-tuliplot`; copy secrets from the old app (`MONGODB_URI` — switch the DB name to /tuliplot, `GOOGLE_CLIENT_ID/SECRET`, `STRIPE_*`, `COOKIE_DOMAIN=.tuliplot.com`, `COOKIE_SECURE=true`, `CORS_ALLOWED_ORIGINS=https://tuliplot.com`, `OAUTH2_SUCCESS_URL=https://tuliplot.com/app`); `fly deploy`; add DNS `api.tuliplot.com` → Fly cert.
3. Google OAuth console: add authorized origin `https://api.tuliplot.com` and redirect URI `https://api.tuliplot.com/login/oauth2/code/google`; remove the dashdash.app entries once cut over.
4. Stripe dashboard: point the webhook endpoint at `https://api.tuliplot.com/api/v1/billing/webhook` (verify path against BillingController) and keep the same signing secret in `STRIPE_WEBHOOK_SECRET`.
5. AdSense (later, at launch): apply for tuliplot.com per docs/adsense-launch-checklist.md; replace the ads.txt placeholder.
```
(Verify the webhook path against `BillingController` before writing it — use the actual mapping.)

- [ ] **Step 3: Design mocks housekeeping**

```bash
cd /c/Users/xamcr/DashDash
mv "design_mocks/DashDash Landing.dc.html" design_mocks/Landing-directions.dc.html
git add design_mocks
```

- [ ] **Step 4: Final repo-wide sweep**

```bash
cd /c/Users/xamcr/DashDash
grep -ril "dashdash" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.gradle --exclude-dir=.angular | grep -v "docs/superpowers/plans/2026-07-21" | grep -v "docs/superpowers/specs/2026-07-21"
```
Expected: no output (the dated 2026-07-21 specs/plans are the only remaining mentions, by design). `design_mocks/support.js` and the mock pages already say TulipLot.

- [ ] **Step 5: Commit, rename the GitHub repo, push**

```bash
cd /c/Users/xamcr/DashDash
git add -A && git commit -m "docs: TulipLot branding in docs, commit design mocks, deployment cutover checklist

TulipLot-Task: T6
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
gh repo rename tuliplot --yes
git remote -v    # expected: origin now points at xamcross/tuliplot (gh rewrites it)
git push origin main
```
GitHub redirects the old URL, so nothing breaks for existing clones. CI: frontend job should stay green; backend job stays red on the known Testcontainers infra issue (not a regression).

**Phase 1 exit criteria:** backend 103 / frontend 97 / extension 20 all green locally; `grep -ri dashdash` clean outside the 2026-07-21 historical docs; repo is `xamcross/tuliplot`; UI looks byte-for-byte identical to before.

---

# Phase 2 — Soft Pastel restyle (Tasks 7–17)

Every task: keep behavior, inputs/outputs, `data-testid`s and ARIA exactly as-is; change markup classes/structure and styles only (plus the explicitly listed additions, e.g. the app top bar). After each task run the frontend suite + build:
```bash
cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" && npx vitest run && npx ng build
```

### Task 7: Design tokens, fonts, global styles

**Files:**
- Modify: `frontend/package.json` (+3 deps), `frontend/src/styles.scss` (replace the empty file), `frontend/angular.json` (budgets)

**Interfaces:**
- Consumes: nothing.
- Produces: every CSS custom property in the Design System Contract, plus global classes `tl-btn tl-btn--primary tl-btn--soft tl-btn--sm`, `tl-eyebrow`, `tl-field-label`, `tl-mono-note`, `tl-pill tl-pill--amber|lilac|sky|mint|neutral`, `tl-card tl-card--float`, `tl-input`, `tl-form-error`, `tl-hero-band tl-hero-band--tight tl-hero-band__inner`, `tl-back`, `tl-updated`, `tl-prose tl-prose--legal tl-lead`, `tl-article`. ALL later tasks depend on these exact names.

- [ ] **Step 1: Install self-hosted fonts**

```bash
cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"
npm install @fontsource/dm-sans @fontsource/space-grotesk @fontsource/space-mono
```

- [ ] **Step 2: Replace `frontend/src/styles.scss` with the design system**

```scss
/* TulipLot global design system — Soft Pastel.
   Source of truth: design_mocks/*.dc.html + the Design System Contract in
   docs/superpowers/plans/2026-07-22-tuliplot-rename-and-redesign.md */

@import '@fontsource/dm-sans/400.css';
@import '@fontsource/dm-sans/500.css';
@import '@fontsource/dm-sans/600.css';
@import '@fontsource/dm-sans/700.css';
@import '@fontsource/space-grotesk/400.css';
@import '@fontsource/space-grotesk/500.css';
@import '@fontsource/space-grotesk/600.css';
@import '@fontsource/space-grotesk/700.css';
@import '@fontsource/space-mono/400.css';
@import '@fontsource/space-mono/700.css';

:root {
  --tl-ink: #33304a;
  --tl-ink-soft: #605c78;
  --tl-ink-faint: #9c98ad;
  --tl-ink-label: #7a7690;
  --tl-prose: #4a4663;
  --tl-prose-lead: #3f3b56;
  --tl-primary: #4D96FF;
  --tl-primary-hover: #2f7ae5;
  --tl-primary-tint: #EAF2FF;
  --tl-pink: #FFB1B1;  --tl-pink-ink: #7a3838;
  --tl-peach: #FFD8A8; --tl-peach-ink: #8a5a1f; --tl-peach-tint: #FFF1E0;
  --tl-sky: #A5D8FF;   --tl-sky-ink: #1f5a8a;   --tl-sky-tint: #DCEEFF;
  --tl-mint: #B2F2BB;  --tl-mint-ink: #2b6b39;  --tl-mint-tint: #DBF5E1;
  --tl-lilac: #D0BFFF; --tl-lilac-ink: #54398a; --tl-lilac-tint: #EEE6FF;
  --tl-surface: #FBFAFE;
  --tl-surface-2: #F7F6FB;
  --tl-surface-3: #F2F0F7;
  --tl-app-bg: #F0EEF7;
  --tl-border: #ECE9F4;
  --tl-border-strong: #E2DFF0;
  --tl-border-cell: #E7E3F2;
  --tl-border-dashed: #cfc9e0;
  --tl-grad: linear-gradient(135deg, #EAF2FF, #F3EEFF);
  --tl-shadow-card: 0 20px 50px rgba(120, 110, 160, 0.14);
  --tl-shadow-btn: 0 8px 20px rgba(77, 150, 255, 0.3);
  --tl-font-display: 'Space Grotesk', sans-serif;
  --tl-font-body: 'DM Sans', sans-serif;
  --tl-font-mono: 'Space Mono', monospace;
  --tl-page-pad: 56px;
}
@media (max-width: 720px) {
  :root { --tl-page-pad: 24px; }
}

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: var(--tl-font-body); color: var(--tl-ink); background: #fff; }
a { color: var(--tl-primary); }
a:hover { color: var(--tl-primary-hover); }
details > summary { list-style: none; cursor: pointer; }
details > summary::-webkit-details-marker { display: none; }

/* --- buttons (pill) --- */
.tl-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-family: var(--tl-font-body); font-weight: 600; font-size: 16px;
  text-decoration: none; border: none; border-radius: 999px;
  padding: 14px 28px; cursor: pointer; line-height: 1.2;
}
.tl-btn--primary { color: #fff; background: var(--tl-primary); box-shadow: var(--tl-shadow-btn); }
.tl-btn--primary:hover { background: var(--tl-primary-hover); color: #fff; }
.tl-btn--soft { color: var(--tl-ink); background: var(--tl-surface-3); }
.tl-btn--soft:hover { color: var(--tl-ink); }
.tl-btn--sm { font-size: 14px; padding: 9px 18px; box-shadow: none; }
.tl-btn:disabled { opacity: 0.6; cursor: default; box-shadow: none; }

/* --- mono labels --- */
.tl-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--tl-font-mono); font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--tl-primary); background: var(--tl-primary-tint);
  border-radius: 999px; padding: 7px 16px;
}
.tl-field-label {
  display: block; font-family: var(--tl-font-mono); font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--tl-ink-label); margin-bottom: 7px;
}
.tl-mono-note { font-family: var(--tl-font-mono); font-size: 13px; color: var(--tl-ink-faint); }

/* --- category pills --- */
.tl-pill {
  display: inline-flex; align-self: flex-start;
  font-family: var(--tl-font-mono); font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em; border-radius: 999px; padding: 4px 11px;
}
.tl-pill--amber   { color: var(--tl-peach-ink); background: var(--tl-peach-tint); }
.tl-pill--lilac   { color: var(--tl-lilac-ink); background: var(--tl-lilac-tint); }
.tl-pill--sky     { color: var(--tl-sky-ink);   background: var(--tl-sky-tint); }
.tl-pill--mint    { color: var(--tl-mint-ink);  background: var(--tl-mint-tint); }
.tl-pill--neutral { color: var(--tl-ink-soft);  background: var(--tl-surface-3); }

/* --- cards + inputs --- */
.tl-card { background: #fff; border: 1px solid var(--tl-border); border-radius: 20px; }
.tl-card--float { border-radius: 24px; box-shadow: var(--tl-shadow-card); }
.tl-input {
  width: 100%; font-family: var(--tl-font-body); font-size: 15px; color: var(--tl-ink);
  padding: 13px 15px; border: 1.5px solid var(--tl-border-strong); border-radius: 12px;
  background: var(--tl-surface); outline: none;
}
.tl-input:focus { border-color: var(--tl-primary); }
.tl-form-error { color: #c0392b; font-size: 14px; margin: 0 0 12px; }

/* --- marketing hero band + back link --- */
.tl-hero-band { background: var(--tl-grad); padding: 64px var(--tl-page-pad) 52px; }
.tl-hero-band--tight { padding: 56px var(--tl-page-pad) 44px; }
.tl-hero-band__inner { max-width: 760px; margin: 0 auto; }
.tl-back { text-decoration: none; font-family: var(--tl-font-mono); font-size: 13px; color: var(--tl-primary); }
.tl-hero-band h1 {
  margin: 16px 0 0; font-family: var(--tl-font-display); font-weight: 700;
  font-size: 48px; line-height: 1.08; letter-spacing: -0.02em; color: var(--tl-ink);
}
.tl-hero-band p { margin: 8px 0 0; font-size: 18px; color: var(--tl-ink-soft); }
.tl-updated { display: block; margin-top: 6px; font-family: var(--tl-font-mono); font-size: 13px; color: var(--tl-ink-label); }
@media (max-width: 720px) { .tl-hero-band h1 { font-size: 34px; } }

/* --- prose (about/contact/legal) --- */
.tl-prose { max-width: 760px; margin: 0 auto; padding: 52px var(--tl-page-pad); width: 100%;
  font-size: 17px; line-height: 1.65; color: var(--tl-ink-soft); }
.tl-prose h2 { margin: 36px 0 12px; font-family: var(--tl-font-display); font-weight: 700; font-size: 24px; color: var(--tl-ink); }
.tl-prose p { margin: 0 0 16px; }
.tl-lead { font-size: 18px; color: var(--tl-prose-lead); margin: 0 0 28px; }
.tl-prose--legal { font-size: 16px; padding: 48px var(--tl-page-pad); }
.tl-prose--legal h2 { font-size: 22px; margin: 32px 0 10px; }

/* --- article prose (guide/blog detail; targets [innerHTML] so it must be global) --- */
.tl-article { max-width: 720px; margin: 0 auto; padding: 48px var(--tl-page-pad); width: 100%;
  font-size: 17px; line-height: 1.7; color: var(--tl-prose); }
.tl-article > h1:first-child, .tl-article h1 { display: none; } /* generated html repeats the title */
.tl-article h2 { margin: 34px 0 12px; font-family: var(--tl-font-display); font-weight: 700; font-size: 23px; color: var(--tl-ink); }
.tl-article p { margin: 0 0 22px; }
.tl-article code {
  font-family: var(--tl-font-mono); font-size: 0.88em; background: var(--tl-surface-3);
  padding: 2px 6px; border-radius: 5px; color: var(--tl-lilac-ink);
}
.tl-article strong { color: var(--tl-ink); }
.tl-prose ul, .tl-prose ol { margin: 0 0 16px; padding-left: 22px; }
.tl-prose li { margin-bottom: 8px; }
.tl-article ul, .tl-article ol { margin: 0 0 22px; padding-left: 24px; }
.tl-article li { margin-bottom: 8px; }

/* --- CDK dialog overlay --- */
.cdk-overlay-backdrop.cdk-overlay-dark-backdrop { background: rgba(51, 48, 74, 0.4); }
```

If the sass build rejects the `@fontsource` CSS `@import`s (deprecation error rather than warning), move those ten font CSS file paths into the `angular.json` `styles` array (before `src/styles.scss`) and delete the imports — same effect.

- [ ] **Step 3: Raise the component-style budget**

In `frontend/angular.json`, find the `anyComponentStyle` budget and set `"maximumWarning": "12kB", "maximumError": "20kB"` (the landing component's styles will exceed the default). If no `anyComponentStyle` entry exists, add it to the budgets array.

- [ ] **Step 4: Verify + commit**

Run the suite + build (top of Phase 2). Expected: 97 pass, build succeeds (pages now render with DM Sans defaults — fonts load, no layout yet).
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): TulipLot design tokens, self-hosted fonts, global styles

TulipLot-Task: T7
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Logo, marketing header/footer, favicon

**Files:**
- Create: `frontend/src/app/shared/logo.component.ts`
- Create: `frontend/src/app/features/marketing/site-header.component.ts`
- Create: `frontend/src/app/features/marketing/site-footer.component.ts`
- Create: `frontend/src/app/features/marketing/site-header.spec.ts`
- Create: `frontend/public/favicon.svg`
- Modify: `frontend/src/index.html` (favicon link)

**Interfaces:**
- Consumes: global classes/tokens from Task 7.
- Produces: `<tl-logo [link] [compact] />` (`link: string = '/'`, `compact: boolean = false`); `<tl-site-header />`; `<tl-site-footer />`. Consumed by Tasks 9–12 (marketing/auth) and 13/16 (top bar uses `tl-logo`).

- [ ] **Step 1: Write the failing header spec**

`frontend/src/app/features/marketing/site-header.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent', () => {
  it('renders the marketing nav with a register CTA', async () => {
    TestBed.configureTestingModule({
      imports: [SiteHeaderComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/guides');
    expect(hrefs).toContain('/blog');
    expect(hrefs).toContain('/login');
    expect(hrefs).toContain('/register');
    expect(el.textContent).toContain('TulipLot');
  });
});
```

- [ ] **Step 2: Run it — expect failure** (`npx vitest run src/app/features/marketing/site-header.spec.ts` → FAIL: cannot resolve `./site-header.component`)

- [ ] **Step 3: Implement the three components**

`frontend/src/app/shared/logo.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'tl-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a [routerLink]="link()" class="logo" [class.logo--compact]="compact()">
      <span class="squares" aria-hidden="true">
        <span class="sq sq--pink"></span><span class="sq sq--peach"></span>
        <span class="sq sq--sky"></span><span class="sq sq--mint"></span>
      </span>
      TulipLot
    </a>
  `,
  styles: [`
    .logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none;
      font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; color: var(--tl-ink); }
    .logo:hover { color: var(--tl-ink); }
    .logo--compact { font-size: 19px; gap: 9px; }
    .squares { display: inline-grid; grid-template-columns: 1fr 1fr; gap: 3px; }
    .sq { width: 9px; height: 9px; border-radius: 3px; }
    .logo--compact .sq { width: 8px; height: 8px; border-radius: 2px; }
    .sq--pink { background: var(--tl-pink); }
    .sq--peach { background: var(--tl-peach); }
    .sq--sky { background: var(--tl-sky); }
    .sq--mint { background: var(--tl-mint); }
  `],
})
export class LogoComponent {
  readonly link = input<string>('/');
  readonly compact = input<boolean>(false);
}
```

`frontend/src/app/features/marketing/site-header.component.ts`:
```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoComponent } from '../../shared/logo.component';

@Component({
  selector: 'tl-site-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  template: `
    <header class="hdr">
      <tl-logo />
      <nav class="nav">
        <a class="site" routerLink="/guides" routerLinkActive="active">Guides</a>
        <a class="site" routerLink="/blog" routerLinkActive="active">Blog</a>
        <a class="site" routerLink="/about" routerLinkActive="active">About</a>
        <a routerLink="/login">Log in</a>
        <a routerLink="/register" class="cta">Get started</a>
      </nav>
    </header>
  `,
  styles: [`
    .hdr { position: sticky; top: 0; z-index: 10; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; padding: 18px var(--tl-page-pad);
      background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--tl-app-bg); }
    .nav { display: flex; align-items: center; gap: 26px; font-weight: 500; font-size: 15px; }
    .nav a { text-decoration: none; color: var(--tl-ink-soft); }
    .nav a:hover { color: var(--tl-primary-hover); }
    .nav a.active { color: var(--tl-primary); font-weight: 600; }
    .nav .cta { font-weight: 600; color: #fff; background: var(--tl-primary);
      border-radius: 999px; padding: 9px 18px; }
    .nav .cta:hover { background: var(--tl-primary-hover); color: #fff; }
    @media (max-width: 640px) { .nav .site { display: none; } }
  `],
})
export class SiteHeaderComponent {}
```

`frontend/src/app/features/marketing/site-footer.component.ts`:
```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'tl-site-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <footer class="ftr">
      <a routerLink="/" class="brand">TulipLot</a>
      <nav class="links">
        <a routerLink="/about" routerLinkActive="active">About</a>
        <a routerLink="/contact" routerLinkActive="active">Contact</a>
        <a routerLink="/privacy" routerLinkActive="active">Privacy</a>
        <a routerLink="/terms" routerLinkActive="active">Terms</a>
      </nav>
      <span class="copy">© 2026 TulipLot</span>
    </footer>
  `,
  styles: [`
    .ftr { display: flex; align-items: center; justify-content: space-between; gap: 16px;
      flex-wrap: wrap; padding: 36px var(--tl-page-pad); border-top: 1px solid var(--tl-border);
      font-size: 14px; color: var(--tl-ink-soft); }
    .brand { text-decoration: none; font-family: var(--tl-font-display); font-weight: 700;
      font-size: 18px; color: var(--tl-ink); }
    .links { display: flex; gap: 22px; }
    .links a { text-decoration: none; color: var(--tl-ink-soft); }
    .links a:hover, .links a.active { color: var(--tl-primary); }
    .copy { font-family: var(--tl-font-mono); color: var(--tl-ink-faint); }
  `],
})
export class SiteFooterComponent {}
```

- [ ] **Step 4: Favicon**

Create `frontend/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="8" y="8" width="38" height="38" rx="11" fill="#FFB1B1"/><rect x="54" y="8" width="38" height="38" rx="11" fill="#FFD8A8"/><rect x="8" y="54" width="38" height="38" rx="11" fill="#A5D8FF"/><rect x="54" y="54" width="38" height="38" rx="11" fill="#B2F2BB"/></svg>
```
In `frontend/src/index.html`, replace the `favicon.ico` link with:
```html
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="icon" type="image/x-icon" href="favicon.ico" sizes="any">
```

- [ ] **Step 5: Spec passes + suite green + commit**

`npx vitest run` → 98 pass (97 + new header spec). `npx ng build` → success.
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): TulipLot logo, marketing site header/footer, SVG favicon

TulipLot-Task: T8
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Landing page

**Files:**
- Modify: `frontend/src/app/features/marketing/landing.component.ts` (full template + styles replacement)
- Mock: `design_mocks/Landing.dc.html` (open side-by-side while working)

**Interfaces:**
- Consumes: `tl-site-header`, `tl-site-footer` (Task 8); global classes (Task 7).
- Produces: nothing consumed later.

- [ ] **Step 1: Replace the component's template and styles**

Keep the class shell (SeoService call, imports list gains `SiteHeaderComponent, SiteFooterComponent`; `RouterLink` stays). New template (a faithful port of the mock — six sections):

```ts
  template: `
    <tl-site-header />

    <main>
      <section class="hero">
        <span class="tl-eyebrow">One window · six apps</span>
        <h1>Everything you check all day, on <span class="hl">one calm screen</span></h1>
        <p class="sub">
          A fixed 3×2 grid where every cell hosts a live web app — Gmail, Trello,
          your news, any URL you choose.
        </p>
        <div class="cta-row">
          <a routerLink="/register" class="tl-btn tl-btn--primary">Get started free →</a>
          <a routerLink="/guides" class="tl-btn tl-btn--soft">Read the guides</a>
        </div>
        <p class="tl-mono-note">Free forever · 5 cells + 1 ad slot · Premium = 6 cells, no ads</p>
      </section>

      <section class="preview">
        <div class="preview-grid" aria-hidden="true">
          <div class="tile tile--pink">Mail</div>
          <div class="tile tile--peach">Boards</div>
          <div class="tile tile--sky">Calendar</div>
          <div class="tile tile--mint">News</div>
          <div class="tile tile--lilac">Music</div>
          <div class="tile tile--ad">AD SLOT<br>(free)</div>
        </div>
      </section>

      <section class="features">
        <h2>Why it clicks</h2>
        <div class="cards">
          <article class="tl-card"><div class="swatch swatch--peach"></div>
            <h3>Six apps, one glance</h3>
            <p>A stable 3×2 grid you arrange once. Drag any two cells to swap them.</p>
          </article>
          <article class="tl-card"><div class="swatch swatch--sky"></div>
            <h3>Any site, framed safely</h3>
            <p>Every URL is validated as HTTPS and sandboxed. The Chrome companion unlocks stubborn sites.</p>
          </article>
          <article class="tl-card"><div class="swatch swatch--mint"></div>
            <h3>Yours, private, portable</h3>
            <p>One dashboard per account, synced to your login. Upgrade or cancel anytime.</p>
          </article>
        </div>
      </section>

      <section class="steps">
        <h2>Up in three moves</h2>
        <div class="cards">
          <div class="step"><span class="num num--pink">1</span>
            <h3>Sign up free</h3><p>One account, one dashboard. No credit card.</p></div>
          <div class="step"><span class="num num--peach">2</span>
            <h3>Fill your cells</h3><p>Pick from the catalog or paste any URL into a slot.</p></div>
          <div class="step"><span class="num num--mint">3</span>
            <h3>Glance all day</h3><p>Everything live in one window. Focus any cell full-screen.</p></div>
        </div>
      </section>

      <section class="pricing">
        <h2>Simple pricing</h2>
        <div class="plans">
          <div class="plan tl-card">
            <span class="plan-tag">Free</span>
            <div class="price">$0<span>/forever</span></div>
            <ul>
              <li>✓ 5 usable cells</li>
              <li>✓ Full catalog + custom URLs</li>
              <li>✓ Drag to rearrange</li>
              <li class="dim">• One ad in the 6th cell</li>
            </ul>
            <a routerLink="/register" class="tl-btn tl-btn--soft plan-cta">Start free</a>
          </div>
          <div class="plan plan--premium">
            <span class="plan-tag plan-tag--premium">Premium</span>
            <div class="price">$4<span>/month</span></div>
            <ul>
              <li>✓ All 6 cells unlocked</li>
              <li>✓ Zero ads, ever</li>
              <li>✓ Everything in Free</li>
              <li>✓ Cancel anytime via Stripe</li>
            </ul>
            <a routerLink="/register" class="tl-btn tl-btn--primary plan-cta">Go Premium</a>
          </div>
        </div>
      </section>

      <section class="faq">
        <h2>Questions</h2>
        <details>
          <summary>Can I embed any website?</summary>
          <p>Any HTTPS URL. Some sites block embedding — the optional Chrome companion unlocks most of them.</p>
        </details>
        <details>
          <summary>Is my data private?</summary>
          <p>Your dashboard is tied to your login and synced only to your account. Frames are sandboxed.</p>
        </details>
        <details>
          <summary>What happens if I cancel Premium?</summary>
          <p>You drop back to the free 5-cell layout; the 6th app is parked so you can re-place or discard it.</p>
        </details>
      </section>
    </main>

    <tl-site-footer />
  `,
```

Styles (complete replacement of the `styles` array):

```ts
  styles: [`
    section h2 { margin: 0 0 32px; text-align: center; font-family: var(--tl-font-display);
      font-weight: 700; font-size: 34px; color: var(--tl-ink); }
    .hero { text-align: center; padding: 72px var(--tl-page-pad) 24px;
      display: flex; flex-direction: column; align-items: center; gap: 22px; }
    .hero h1 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 60px;
      line-height: 1.05; letter-spacing: -0.02em; max-width: 760px; }
    .hero .hl { color: var(--tl-primary); }
    .hero .sub { margin: 0; font-size: 19px; line-height: 1.55; color: var(--tl-ink-soft); max-width: 560px; }
    .cta-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
    .preview { padding: 20px var(--tl-page-pad) 72px; max-width: 1120px; margin: 0 auto; width: 100%; }
    .preview-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
      gap: 16px; aspect-ratio: 3 / 1.35; background: var(--tl-surface-2); border-radius: 24px; padding: 16px; }
    .tile { border-radius: 16px; padding: 14px; display: flex; align-items: flex-end;
      font-family: var(--tl-font-mono); font-size: 12px; font-weight: 700; }
    .tile--pink { background: var(--tl-pink); color: var(--tl-pink-ink); }
    .tile--peach { background: var(--tl-peach); color: var(--tl-peach-ink); }
    .tile--sky { background: var(--tl-sky); color: var(--tl-sky-ink); }
    .tile--mint { background: var(--tl-mint); color: var(--tl-mint-ink); }
    .tile--lilac { background: var(--tl-lilac); color: var(--tl-lilac-ink); }
    .tile--ad { background: repeating-linear-gradient(45deg, #efedf5, #efedf5 8px, #e6e3f0 8px, #e6e3f0 16px);
      border: 1.5px dashed var(--tl-border-dashed); align-items: center; justify-content: center;
      text-align: center; font-size: 11px; color: var(--tl-ink-faint); }
    .features { padding: 56px var(--tl-page-pad); background: var(--tl-surface); }
    .features .cards, .steps .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
      max-width: 1120px; margin: 0 auto; }
    .features article { padding: 26px; }
    .swatch { width: 46px; height: 46px; border-radius: 14px; margin-bottom: 16px; }
    .swatch--peach { background: var(--tl-peach); }
    .swatch--sky { background: var(--tl-sky); }
    .swatch--mint { background: var(--tl-mint); }
    .features h3, .steps h3 { margin: 0 0 8px; font-family: var(--tl-font-display); font-size: 20px; color: var(--tl-ink); }
    .features p, .steps p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    .steps { padding: 56px var(--tl-page-pad); max-width: 1232px; margin: 0 auto; width: 100%; }
    .step { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .num { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
      font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; border-radius: 999px; }
    .num--pink { background: var(--tl-pink); color: var(--tl-pink-ink); }
    .num--peach { background: var(--tl-peach); color: var(--tl-peach-ink); }
    .num--mint { background: var(--tl-mint); color: var(--tl-mint-ink); }
    .pricing { padding: 56px var(--tl-page-pad); background: var(--tl-surface); }
    .plans { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 760px; margin: 0 auto; }
    .plan { padding: 32px; border-radius: 22px; }
    .plan--premium { background: var(--tl-primary-tint); border: 1.5px solid var(--tl-primary); }
    .plan-tag { font-family: var(--tl-font-mono); font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; font-size: 13px; color: var(--tl-ink-faint); }
    .plan-tag--premium { color: var(--tl-primary); }
    .price { font-family: var(--tl-font-display); font-weight: 700; font-size: 46px; margin: 6px 0 16px; }
    .price span { font-size: 18px; color: var(--tl-ink-faint); }
    .plan ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;
      font-size: 15px; color: var(--tl-ink-soft); }
    .plan .dim { color: var(--tl-ink-faint); }
    .plan-cta { display: flex; margin-top: 24px; padding: 12px; }
    .faq { padding: 56px var(--tl-page-pad); max-width: 932px; margin: 0 auto; width: 100%; }
    .faq h2 { margin-bottom: 28px; }
    .faq details { background: var(--tl-surface); border: 1px solid var(--tl-border);
      border-radius: 16px; padding: 18px 22px; margin-bottom: 12px; }
    .faq summary { font-family: var(--tl-font-display); font-weight: 600; font-size: 17px; color: var(--tl-ink); }
    .faq p { margin: 12px 0 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    @media (max-width: 960px) {
      .features .cards, .steps .cards, .plans { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .hero h1 { font-size: 42px; }
      section h2 { font-size: 28px; }
    }
  `],
```

Update the SEO call copy to: title `'TulipLot — your apps on one calm screen'`, description `'Turn one browser window into a personal dashboard: a fixed 3×2 grid of the web apps you use all day.'`.

- [ ] **Step 2: Verify + commit**

Suite + build green (a spec may assert old landing copy — re-point strings if so). Visually compare `npx ng serve` → http://localhost:4200/ against `design_mocks/Landing.dc.html` opened as a file.
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): landing page in Soft Pastel design

TulipLot-Task: T9
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Static prose pages — About, Contact, Privacy, Terms

**Files:**
- Modify: `frontend/src/app/features/marketing/about.component.ts`, `contact.component.ts`, `privacy.component.ts`, `terms.component.ts`
- Mocks: `design_mocks/About.dc.html`, `Contact.dc.html`, `Privacy.dc.html`, `Terms.dc.html`

**Interfaces:**
- Consumes: `tl-site-header/footer` (T8); `tl-hero-band`, `tl-prose`, `tl-back`, `tl-updated`, `tl-lead` globals (T7).
- Produces: nothing consumed later.

All four pages share this shell (imports gain `SiteHeaderComponent, SiteFooterComponent`; `RouterLink` stays):

```ts
  template: `
    <tl-site-header />
    <div class="tl-hero-band">
      <div class="tl-hero-band__inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>About TulipLot</h1>
      </div>
    </div>
    <main class="tl-prose">
      <!-- existing page paragraphs move here, EXACT TEXT UNCHANGED -->
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: #fff; }
    main { flex: 1; }
  `],
```

- [ ] **Step 1: About** — apply the shell; move the five existing sections (`Why we built it` … `Contact`) into `main.tl-prose` unchanged; give the first paragraph `class="tl-lead"`. Delete the old `doc-page` wrapper and back-link markup (replaced by the hero band).

- [ ] **Step 2: Privacy and Terms** — same shell but: `tl-hero-band--tight` modifier on the band; keep the existing "Last updated" line as `<span class="tl-updated">Last updated: 21 July 2026</span>` directly under the `<h1>` inside the band; `main` gets `class="tl-prose tl-prose--legal"`; add a per-component style override `.tl-hero-band h1 { font-size: 44px; }`. All existing legal text, lists, and external links move over verbatim.

- [ ] **Step 3: Contact** — shell plus the mock's email-card grid replacing the current `<ul>` of mailto links:

```ts
      <h2>Email us</h2>
      <div class="cards">
        <div class="card">
          <div class="sw" style="background: var(--tl-peach)"></div>
          <h3>General &amp; feedback</h3>
          <a href="mailto:hello&#64;tuliplot.com">hello&#64;tuliplot.com</a>
        </div>
        <div class="card">
          <div class="sw" style="background: var(--tl-sky)"></div>
          <h3>Support &amp; billing</h3>
          <a href="mailto:support&#64;tuliplot.com">support&#64;tuliplot.com</a>
        </div>
        <div class="card">
          <div class="sw" style="background: var(--tl-mint)"></div>
          <h3>Privacy &amp; data</h3>
          <a href="mailto:privacy&#64;tuliplot.com">privacy&#64;tuliplot.com</a>
        </div>
      </div>
```
with component styles added to the shared shell styles:
```ts
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0 8px; }
    .card { background: var(--tl-surface); border: 1px solid var(--tl-border); border-radius: 16px; padding: 22px; }
    .sw { width: 38px; height: 38px; border-radius: 11px; margin-bottom: 14px; }
    .card h3 { margin: 0 0 6px; font-family: var(--tl-font-display); font-weight: 600; font-size: 16px; color: var(--tl-ink); }
    .card a { font-size: 14px; }
    @media (max-width: 960px) { .cards { grid-template-columns: 1fr; } }
```
The `Response times` and `Company` sections keep their existing text. H1 is `Contact TulipLot`.

- [ ] **Step 4: Verify + commit**

Suite + build green (`ng build` re-prerenders all four routes — check none went blank by grepping the dist HTML for a known sentence per page).
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): about/contact/privacy/terms in Soft Pastel design

TulipLot-Task: T10
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Guides & Blog — lists and detail pages

**Files:**
- Create: `frontend/src/app/features/marketing/pill.util.ts`, `pill.util.spec.ts`
- Modify: `guides-list.component.ts`, `blog-list.component.ts`, `guide-detail.component.ts`, `blog-detail.component.ts`
- Mocks: `Guides.dc.html`, `Blog.dc.html`, `Guide Detail.dc.html`, `Blog Detail.dc.html`

**Interfaces:**
- Consumes: shells (T8), `tl-pill--*`, `tl-article`, `tl-hero-band--tight` globals (T7); `ContentDoc` fields `slug/title/description/date/category/readingMinutes/html` from `content.generated.ts` (existing).
- Produces: `pillClass(category: string): string` and `thumbClass(category: string): string` (marketing-internal).

- [ ] **Step 1: Failing util spec** — `pill.util.spec.ts`:

```ts
import { pillClass, thumbClass } from './pill.util';

describe('pill.util', () => {
  it('maps known categories to pill classes', () => {
    expect(pillClass('Basics')).toBe('tl-pill--amber');
    expect(pillClass('Tips')).toBe('tl-pill--amber');
    expect(pillClass('Product')).toBe('tl-pill--lilac');
    expect(pillClass('Advanced')).toBe('tl-pill--sky');
    expect(pillClass('Billing')).toBe('tl-pill--mint');
    expect(pillClass('Anything else')).toBe('tl-pill--neutral');
  });
  it('maps categories to thumbnail classes', () => {
    expect(thumbClass('Tips')).toBe('thumb--amber');
    expect(thumbClass('Product')).toBe('thumb--sky');
    expect(thumbClass('Nope')).toBe('thumb--neutral');
  });
});
```
Run → FAIL (module missing). Implement `pill.util.ts`:
```ts
/** Category → design-system pill/thumb classes (Design System Contract, Task 7). */
export function pillClass(category: string): string {
  switch (category.toLowerCase()) {
    case 'basics':
    case 'tips':
      return 'tl-pill--amber';
    case 'product':
      return 'tl-pill--lilac';
    case 'advanced':
      return 'tl-pill--sky';
    case 'billing':
      return 'tl-pill--mint';
    default:
      return 'tl-pill--neutral';
  }
}

export function thumbClass(category: string): string {
  switch (category.toLowerCase()) {
    case 'basics':
    case 'tips':
      return 'thumb--amber';
    case 'product':
    case 'advanced':
      return 'thumb--sky';
    case 'billing':
      return 'thumb--mint';
    default:
      return 'thumb--neutral';
  }
}
```
Run → PASS.

- [ ] **Step 2: Guides list** — keep the component class (add `protected readonly pillClass = pillClass;`); new template:

```ts
  template: `
    <tl-site-header />
    <div class="tl-hero-band">
      <div class="inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Guides</h1>
        <p>Step-by-step help getting the most out of TulipLot.</p>
      </div>
    </div>
    <main>
      <div class="cards">
        @for (guide of guides; track guide.slug) {
          <a class="card tl-card" [routerLink]="['/guides', guide.slug]">
            <span [class]="'tl-pill ' + pillClass(guide.category)">{{ guide.category }}</span>
            <h2>{{ guide.title }}</h2>
            <p>{{ guide.description }}</p>
            <span class="meta">{{ guide.readingMinutes }} min read</span>
          </a>
        }
      </div>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: #fff; }
    .inner { max-width: 900px; margin: 0 auto; }
    main { flex: 1; max-width: 900px; margin: 0 auto; padding: 48px var(--tl-page-pad); width: 100%; }
    .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .card { padding: 26px; display: flex; flex-direction: column; gap: 10px; text-decoration: none; }
    .card h2 { margin: 4px 0 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 21px; color: var(--tl-ink); }
    .card p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    .meta { margin-top: auto; font-family: var(--tl-font-mono); font-size: 12px; color: var(--tl-ink-faint); }
    @media (max-width: 960px) { .cards { grid-template-columns: 1fr; } }
  `],
```

- [ ] **Step 3: Blog list** — same shell, mock's horizontal cards with thumbnails (`protected readonly pillClass = pillClass; protected readonly thumbClass = thumbClass;`):

```ts
      <div class="posts">
        @for (post of posts; track post.slug) {
          <a class="post tl-card" [routerLink]="['/blog', post.slug]">
            <span [class]="'thumb ' + thumbClass(post.category)" aria-hidden="true"></span>
            <span class="body">
              <span [class]="'tl-pill ' + pillClass(post.category)">{{ post.category }}</span>
              <h2>{{ post.title }}</h2>
              <p>{{ post.description }}</p>
              <span class="meta">{{ post.date }} · {{ post.readingMinutes }} min read</span>
            </span>
          </a>
        }
      </div>
```
Hero copy: h1 `Blog`, sub `Product news and thinking on focused, single-window work.` Styles:
```ts
    .posts { display: flex; flex-direction: column; gap: 18px; }
    .post { display: flex; gap: 24px; align-items: center; padding: 28px; text-decoration: none; }
    .thumb { flex: none; width: 120px; height: 96px; border-radius: 14px; }
    .thumb--amber { background: #FFEBD1; }
    .thumb--sky { background: var(--tl-sky-tint); }
    .thumb--mint { background: var(--tl-mint-tint); }
    .thumb--neutral { background: var(--tl-surface-3); }
    .body { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .post h2 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; color: var(--tl-ink); }
    .post p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    .meta { font-family: var(--tl-font-mono); font-size: 12px; color: var(--tl-ink-faint); }
    @media (max-width: 720px) { .post { flex-direction: column; align-items: flex-start; } }
```
(plus the same `:host`/`.inner`/`main` shell styles as the guides list, max-width 900px.)

- [ ] **Step 4: Detail pages** — both get the same wrapper; the `doc()` signal, not-found branch, and SEO effect are untouched. Guide detail template:

```ts
  template: `
    <tl-site-header />
    @if (doc(); as d) {
      <div class="tl-hero-band tl-hero-band--tight">
        <div class="inner">
          <a routerLink="/guides" class="tl-back">← All guides</a>
          <div><span [class]="'tl-pill ' + pillClass(d.category)">{{ d.category }} · {{ d.readingMinutes }} min read</span></div>
          <h1>{{ d.title }}</h1>
        </div>
      </div>
      <article class="tl-article" [innerHTML]="d.html"></article>
      <div class="cta-row">
        <a routerLink="/register" class="tl-btn tl-btn--primary tl-btn--sm">Get started free →</a>
        <a routerLink="/guides" class="tl-btn tl-btn--soft tl-btn--sm">More guides</a>
      </div>
    } @else {
      <main class="tl-prose"><p>Guide not found. <a routerLink="/guides">Back to all guides</a>.</p></main>
    }
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: #fff; }
    .inner { max-width: 720px; margin: 0 auto; }
    .inner .tl-pill { margin-top: 14px; }
    .tl-hero-band h1 { font-size: 42px; }
    article { flex: 1; }
    .cta-row { max-width: 720px; margin: 0 auto; padding: 0 var(--tl-page-pad) 44px; width: 100%;
      display: flex; gap: 14px; border-top: 1px solid var(--tl-border); padding-top: 28px; }
    @media (max-width: 720px) { .tl-hero-band h1 { font-size: 30px; } }
  `],
```
Blog detail: identical shape with `← All posts` → `/blog`, pill text `{{ d.category }} · {{ d.date }} · {{ d.readingMinutes }} min read`, CTAs `Try TulipLot free →` (`/register`) and `More posts` (`/blog`), plus a banner div between hero and article: `<div class="banner" aria-hidden="true"></div>` styled `.banner { max-width: 720px; margin: 44px auto 0; height: 260px; border-radius: 20px; background: var(--tl-sky-tint); width: calc(100% - 2 * var(--tl-page-pad)); }` and reduce the article's top padding with `article { padding-top: 36px; }`. Both components add `protected readonly pillClass = pillClass;`.

- [ ] **Step 5: Verify + commit**

Suite + build green; sanity-check `/guides/getting-started` and `/blog/why-we-built-tuliplot` render with hidden duplicate `<h1>` (global `.tl-article h1 { display: none; }`).
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): guides and blog in Soft Pastel design

TulipLot-Task: T11
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Auth pages — Login & Register

**Files:**
- Modify: `frontend/src/app/features/auth/login.component.ts`, `register.component.ts`
- Mocks: `Login.dc.html`, `Register.dc.html`

**Interfaces:**
- Consumes: `tl-logo` (T8), `tl-card--float`, `tl-input`, `tl-field-label`, `tl-btn`, `tl-form-error` (T7).
- Produces: nothing consumed later. All form logic (`loginForm`/`registerForm`, `store.login/register`, `googleAuthUrl`, redirect effects) unchanged.

- [ ] **Step 1: Login** — imports become `[FormField, RouterLink, LogoComponent]` (RouterLink was missing — the "Create an account" link finally becomes a real router link). Template:

```ts
  template: `
    <main class="auth">
      <div class="wrap">
        <tl-logo class="center" />
        <div class="card tl-card tl-card--float">
          <h1>Welcome back</h1>
          <p class="sub">Log in to your dashboard.</p>
          <form (submit)="$event.preventDefault(); submit()">
            <label class="tl-field-label" for="login-email">Email</label>
            <input id="login-email" class="tl-input mb18" type="email" placeholder="you@example.com"
              autocomplete="email" [formField]="loginForm.email" />
            <label class="tl-field-label" for="login-password">Password</label>
            <input id="login-password" class="tl-input mb24" type="password" placeholder="••••••••"
              autocomplete="current-password" [formField]="loginForm.password" />
            @if (store.status() === 'error') {
              <p class="tl-form-error" role="alert">{{ store.error() }}</p>
            }
            <button type="submit" class="tl-btn tl-btn--primary submit"
              [disabled]="store.status() === 'loading'">Log in</button>
          </form>
          <div class="divider"><span></span>or<span></span></div>
          <a class="google" [href]="googleAuthUrl">
            <span class="g" aria-hidden="true"></span>
            Continue with Google
          </a>
        </div>
        <p class="alt">New here? <a routerLink="/register">Create an account</a></p>
      </div>
    </main>
  `,
  styles: [`
    .auth { min-height: 100vh; background: var(--tl-grad); display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 40px; }
    .wrap { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 22px; }
    .center { align-self: center; }
    .card { padding: 36px; }
    h1 { margin: 0 0 6px; font-family: var(--tl-font-display); font-weight: 700; font-size: 28px; color: var(--tl-ink); }
    .sub { margin: 0 0 26px; font-size: 15px; color: var(--tl-ink-soft); }
    .mb18 { margin-bottom: 18px; }
    .mb24 { margin-bottom: 24px; }
    .submit { width: 100%; padding: 14px; }
    .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--tl-ink-faint); font-size: 13px; }
    .divider span { flex: 1; height: 1px; background: var(--tl-border); }
    .google { display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none;
      font-weight: 600; font-size: 15px; color: var(--tl-ink); background: #fff;
      border: 1.5px solid var(--tl-border-strong); border-radius: 999px; padding: 13px; }
    .g { width: 18px; height: 18px; border-radius: 50%;
      background: conic-gradient(#EA4335, #FBBC05, #34A853, #4285F4); }
    .alt { margin: 0; text-align: center; font-size: 15px; color: var(--tl-ink-soft); }
    .alt a { font-weight: 600; }
  `],
```

- [ ] **Step 2: Register** — same shell/styles; card content: `h1` "Create your account", sub "Free forever. No credit card.", three fields (Display name / Email / Password with placeholders "Alex Rivera" / "you@example.com" / "At least 8 characters", `mb18/mb18/mb24`), submit label "Sign up free", no Google button and no divider (per mock), bottom line `Already have an account? <a routerLink="/login">Log in</a>`. Imports `[FormField, RouterLink, LogoComponent]`. All form wiring unchanged.

- [ ] **Step 3: Verify + commit**

`npx vitest run` — `login.google.spec` (asserts the Google href) and other auth specs must stay green; re-point any copy assertions ("Log in to TulipLot" → "Welcome back") without weakening them. Build green.
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): auth pages in Soft Pastel design

TulipLot-Task: T12
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: App top bar + dashboard page shell

**Files:**
- Create: `frontend/src/app/shared/app-topbar.component.ts`, `app-topbar.spec.ts`
- Modify: `frontend/src/app/features/dashboard/dashboard-page.component.ts` (template/styles only)
- Mock: `Dashboard.dc.html` (top bar), `Settings.dc.html` (back mode)

**Interfaces:**
- Consumes: `tl-logo` (T8), `AuthStore.tier()` (existing).
- Produces: `<tl-app-topbar [mode]="'dashboard' | 'back'" />` — consumed by Task 16 (settings/upgrade use `mode="back"`).

- [ ] **Step 1: Failing topbar spec** — `frontend/src/app/shared/app-topbar.spec.ts`. Look at how existing dashboard specs provide `AuthStore` fakes (e.g. `grid.gating.spec.ts`) and follow the same pattern to provide a FREE-tier user; assert: renders "Free plan" text, an `/app/upgrade` link, and an `/app/settings` link; with a PREMIUM user: renders "Premium" and no upgrade link. Run → FAIL (module missing).

- [ ] **Step 2: Implement**

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../stores/auth.store';
import { LogoComponent } from './logo.component';

@Component({
  selector: 'tl-app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LogoComponent],
  template: `
    <div class="bar">
      <tl-logo [compact]="true" [link]="mode() === 'dashboard' ? '/' : '/app'" />
      @if (mode() === 'dashboard') {
        <div class="right">
          <span class="plan" [class.plan--premium]="premium()" data-testid="topbar-plan">
            {{ premium() ? 'Premium' : 'Free plan' }}
          </span>
          @if (!premium()) {
            <a routerLink="/app/upgrade" class="tl-btn tl-btn--primary tl-btn--sm">Go Premium</a>
          }
          <a routerLink="/app/settings" class="gear" aria-label="Settings">⚙</a>
        </div>
      } @else {
        <a routerLink="/app" class="tl-back">← Back to dashboard</a>
      }
    </div>
  `,
  styles: [`
    .bar { display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px; background: #fff; border-bottom: 1px solid var(--tl-border); }
    .right { display: flex; align-items: center; gap: 14px; }
    .plan { font-family: var(--tl-font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--tl-peach-ink);
      background: var(--tl-peach-tint); border-radius: 999px; padding: 5px 12px; }
    .plan--premium { color: var(--tl-mint-ink); background: var(--tl-mint-tint); }
    .gear { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
      border-radius: 50%; background: var(--tl-surface-3); color: var(--tl-ink-soft);
      font-size: 16px; text-decoration: none; }
  `],
})
export class AppTopbarComponent {
  readonly mode = input<'dashboard' | 'back'>('dashboard');
  private readonly authStore = inject(AuthStore);
  protected readonly premium = computed(() => this.authStore.tier() === 'PREMIUM');
}
```
Spec → PASS. (Before using `data-testid="topbar-plan"`, `grep -rn "topbar-plan" frontend/src` — must be unique; it is, unless a later change reused it.)

- [ ] **Step 3: Dashboard page shell** — template becomes:

```ts
  template: `
    <div class="page">
      <tl-app-topbar mode="dashboard" />
      <main class="grid-area">
        <tl-grid (edit)="onEdit($event)" />
        @if (store.parkedApp(); as parked) {
          <div class="parked-prompt" data-testid="parked-prompt" role="dialog" aria-label="Placed app removed">
            <p>
              Your plan changed and “{{ parked.title || parked.url }}” no longer fits your dashboard.
              Place it in a slot or discard it.
            </p>
            <div class="parked-actions">
              @for (slot of placeableSlots(); track slot) {
                <button type="button" class="tl-btn tl-btn--soft tl-btn--sm"
                  [attr.data-testid]="'park-slot-' + slot" (click)="resolveParkedApp(slot)">
                  Slot {{ slot + 1 }}
                </button>
              }
              <button type="button" class="discard tl-btn tl-btn--primary tl-btn--sm"
                data-testid="park-discard" (click)="resolveParkedApp(null)">
                Discard
              </button>
            </div>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .page { width: 100vw; height: 100vh; display: flex; flex-direction: column; background: var(--tl-app-bg); }
    .grid-area { flex: 1; min-height: 0; padding: 12px; position: relative; }
    .parked-prompt { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 1100;
      max-width: 90vw; background: #fff; border: 1px solid var(--tl-border); border-radius: 16px;
      padding: 16px 20px; box-shadow: var(--tl-shadow-card); font-size: 15px; color: var(--tl-ink); }
    .parked-prompt p { margin: 0 0 4px; }
    .parked-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .parked-actions .discard { margin-left: auto; }
  `],
```
`imports` gains `AppTopbarComponent`. Class code untouched — `data-testid`s (`parked-prompt`, `park-slot-*`, `park-discard`) preserved.

- [ ] **Step 4: Verify + commit**

`npx vitest run` — dashboard-page checkout/gating specs stay green (they already provide `AuthStore`). Build green.
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): app top bar and dashboard shell in Soft Pastel design

TulipLot-Task: T13
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Grid, cell chrome, fallback states, ad cell

**Files:**
- Modify: `frontend/src/app/features/dashboard/grid.component.ts` (styles + one class binding), `cell.component.ts` (styles, fallback markup classes, accent), `cell-toolbar.component.ts` (template + styles), `frontend/src/app/features/ads/ad-cell.component.ts` (template classes + styles)
- Mock: `Dashboard.dc.html`

**Interfaces:**
- Consumes: tokens (T7).
- Produces: `CellToolbarComponent` gains input `accent: string` (default `'var(--tl-lilac)'`). No other API changes.

- [ ] **Step 1: Grid styles** — in `grid.component.ts`, change only:
  - `.grid` gap `8px` → `10px`.
  - `.cell` → `border: 1px solid var(--tl-border-cell); border-radius: 12px; background: #fff;` (keep `position/min-height/min-width/overflow/flex` as-is).
  - Add to the cell div in the template: `[class.cell--ad]="cell.type === 'AD'"` and style `.cell--ad { background: transparent; border: none; }` (the ad cell draws its own dashed box).
  - `.cell.focused` keeps `border-radius: 0`.

- [ ] **Step 2: Toolbar accent + restyle** — `cell-toolbar.component.ts`: add `accent = input<string>('var(--tl-lilac)');` and a dot before the title:

```ts
  template: `
    <div class="toolbar" data-testid="cell-toolbar">
      <span class="dot" [style.background]="accent()" aria-hidden="true"></span>
      <span class="title">{{ title() }}</span>
      <span class="spacer"></span>
      <button type="button" title="Reload" data-testid="tb-reload" (click)="reload.emit()">&#8635;</button>
      <button type="button" title="Expand" data-testid="tb-focus" (click)="focusToggle.emit()">&#8690;</button>
      <button type="button" title="Pop out" data-testid="tb-popout" (click)="popOut.emit()">&#9099;</button>
      <button type="button" title="Open in tab" data-testid="tb-opentab" (click)="openInTab.emit()">&#8599;</button>
      <button type="button" title="Edit" data-testid="tb-edit" (click)="edit.emit()">&#9998;</button>
      <button type="button" [title]="asleep() ? 'Wake' : 'Sleep'" data-testid="tb-sleep" (click)="sleep.emit()">
        {{ asleep() ? '☾' : '☀' }}
      </button>
      <button type="button" title="Remove" data-testid="tb-remove" (click)="remove.emit()">&#128465;</button>
    </div>
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: var(--tl-surface); border-bottom: 1px solid var(--tl-app-bg); font-size: 13px; }
    .dot { width: 14px; height: 14px; border-radius: 4px; flex: none; }
    .title { font-weight: 600; color: var(--tl-ink); overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; max-width: 40%; }
    .spacer { flex: 1; }
    button { border: none; background: transparent; cursor: pointer; padding: 2px 4px;
      line-height: 1; font-size: 13px; color: #b8b3c9; }
    button:hover { color: var(--tl-ink); }
  `],
```

- [ ] **Step 3: Cell accent + fallback/empty restyle** — `cell.component.ts`:
  - Add to the class: `private static readonly ACCENTS = ['var(--tl-pink)', 'var(--tl-sky)', 'var(--tl-mint)', 'var(--tl-peach)', 'var(--tl-lilac)'];` and `protected readonly accent = computed(() => CellComponent.ACCENTS[this.cell().slot % CellComponent.ACCENTS.length]);`
  - Pass it: `<tl-cell-toolbar [accent]="accent()" …/>` (all existing bindings kept).
  - Empty-cell button (keep `data-testid="add-btn"`): `<span class="plus">+</span> Add app` markup stays; new styles below.
  - Fallback buttons get design classes, text/ids unchanged — primary action `class="tl-btn tl-btn--primary tl-btn--sm"` ("Install TulipLot Companion" / "Open in a tab" / "Retry"), secondary actions `class="tl-btn tl-btn--soft tl-btn--sm"` ("Enable for this site" / "Open in a tab instead" / the load-failed "Open in a tab").
  - Replace the styles array:

```ts
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .add-btn { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 8px; border: 1.5px dashed var(--tl-border-dashed); border-radius: 12px;
      background: transparent; cursor: pointer; font-family: var(--tl-font-body); font-size: 14px;
      font-weight: 600; color: var(--tl-ink-soft); }
    .add-btn:hover { background: var(--tl-surface); }
    .add-btn .plus { width: 34px; height: 34px; border-radius: 999px; background: var(--tl-surface-3);
      display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--tl-ink); }
    .state, .cell-fallback { width: 100%; height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px; padding: 16px; text-align: center; }
    .cell-fallback p { margin: 0; font-family: var(--tl-font-display); font-weight: 600; font-size: 15px;
      color: var(--tl-ink-soft); max-width: 230px; line-height: 1.4; }
  `],
```

- [ ] **Step 4: Ad cell** — `ad-cell.component.ts` template becomes (behavior/effect untouched; `aria-label` kept):

```ts
    @if (config().showAd) {
      <section class="ad-cell" aria-label="Advertisements">
        <span class="ad-cell__label">Ad · Free plan</span>
        @if (showHousePromo()) {
          <a class="ad-cell__promo" routerLink="/app/upgrade">
            <span class="promo-text">Your 6th cell shows one ad.</span>
            <span class="tl-btn tl-btn--primary tl-btn--sm">Remove ad — go Premium</span>
          </a>
        } @else {
          <div #adHost class="ad-cell__slot"></div>
        }
      </section>
    }
```
```ts
  styles: `
    .ad-cell { height: 100%; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; text-align: center; padding: 16px;
      border: 1.5px dashed var(--tl-border-dashed); border-radius: 12px;
      background: repeating-linear-gradient(45deg, #F4F2FA, #F4F2FA 9px, #ECE8F6 9px, #ECE8F6 18px); }
    .ad-cell__label { font-family: var(--tl-font-mono); font-size: 11px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--tl-ink-faint); }
    .ad-cell__promo { display: flex; flex-direction: column; align-items: center; gap: 12px;
      text-decoration: none; }
    .promo-text { font-family: var(--tl-font-display); font-weight: 600; font-size: 15px;
      color: var(--tl-ink-soft); max-width: 180px; line-height: 1.4; }
    .ad-cell__slot { width: 300px; height: 250px; max-width: 100%; }
  `,
```

- [ ] **Step 5: Verify + commit**

`npx vitest run` — `cell.states.spec` and grid specs green (all testids/states intact). Build green. Manual: log in locally, confirm cells/ad/empty/fallback look per mock.
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): dashboard grid, cell chrome, fallback and ad cells in Soft Pastel

TulipLot-Task: T14
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: Dialogs + browser-notice banner

**Files:**
- Modify: `frontend/src/app/features/dashboard/catalog-dialog.component.ts`, `add-url-dialog.component.ts`, `frontend/src/app/app.component.ts`

**Interfaces:**
- Consumes: tokens + `tl-input/tl-btn/tl-pill/tl-form-error` (T7), backdrop rule (T7).
- Produces: nothing consumed later. DialogRef flows and every `data-testid` unchanged.

- [ ] **Step 1: Catalog dialog** — template keeps all testids; add classes: search input gains `class="tl-input"`; compat badge span becomes `<span [class]="'compat-badge tl-pill tl-pill--neutral'" [attr.data-compat]="app.compatibility">{{ badgeFor(app) }}</span>`; "Add by URL instead" button gains `class="tl-btn tl-btn--soft tl-btn--sm"`; Cancel gains `class="ghost"`. Replace styles:

```ts
  styles: [`
    .dialog { background: #fff; border-radius: 24px; box-shadow: var(--tl-shadow-card); padding: 28px;
      width: 100%; max-width: 480px; font-family: var(--tl-font-body); color: var(--tl-ink); }
    h2 { margin: 0 0 16px; font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; }
    .apps { list-style: none; margin: 14px 0; padding: 0; max-height: 320px; overflow: auto;
      display: flex; flex-direction: column; gap: 2px; }
    .app { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none;
      border-radius: 12px; background: transparent; cursor: pointer; font-family: var(--tl-font-body);
      font-size: 15px; color: var(--tl-ink); text-align: left; }
    .app:hover { background: var(--tl-surface); }
    .app img { border-radius: 4px; }
    .name { font-weight: 600; }
    .compat-badge { margin-left: auto; }
    .cat { color: var(--tl-ink-faint); font-size: 12px; }
    .empty { padding: 16px; text-align: center; color: var(--tl-ink-faint); }
    .actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 14px; }
    .ghost { border: none; background: none; cursor: pointer; font-family: var(--tl-font-body);
      font-size: 14px; color: var(--tl-ink-soft); }
    .ghost:hover { color: var(--tl-ink); }
  `],
```

- [ ] **Step 2: Add-URL dialog** — labels split into `tl-field-label` + `tl-input` (keep `data-testid`s `url-input`, `title-input`, `url-error`, `url-cancel`, `url-add`); error p gains `class="tl-form-error"`; Cancel → `class="ghost"`, Add → `class="tl-btn tl-btn--primary tl-btn--sm"`. Styles:

```ts
  styles: [`
    .dialog { background: #fff; border-radius: 24px; box-shadow: var(--tl-shadow-card); padding: 28px;
      width: 100%; max-width: 420px; font-family: var(--tl-font-body); color: var(--tl-ink); }
    h2 { margin: 0 0 16px; font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; }
    .tl-input { margin-bottom: 16px; }
    .actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 6px; }
    .ghost { border: none; background: none; cursor: pointer; font-family: var(--tl-font-body);
      font-size: 14px; color: var(--tl-ink-soft); }
    .ghost:hover { color: var(--tl-ink); }
  `],
```

- [ ] **Step 3: Browser-notice banner** — in `app.component.ts`, move the inline style to a styles array (copy already says TulipLot after T5):

```ts
  template: `
    @if (showBanner()) {
      <div class="browser-notice" role="status">
        <span>TulipLot works best in Chrome or a Chromium-based browser. Some features may be limited here.</span>
        <button type="button" aria-label="Dismiss notice" (click)="dismiss()">Dismiss</button>
      </div>
    }
    <router-outlet />
  `,
  styles: [`
    .browser-notice { display: flex; gap: 16px; align-items: center; justify-content: space-between;
      padding: 10px 20px; background: var(--tl-peach-tint); color: var(--tl-peach-ink);
      font-family: var(--tl-font-body); font-size: 14px; }
    .browser-notice button { border: none; background: #fff; color: var(--tl-peach-ink); font-weight: 600;
      border-radius: 999px; padding: 6px 14px; cursor: pointer; }
  `],
```

- [ ] **Step 4: Verify + commit**

Suite + build green (dialog specs assert testids and DialogRef results — untouched).
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): dialogs and browser notice in Soft Pastel design

TulipLot-Task: T15
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 16: Settings & Upgrade pages

**Files:**
- Modify: `frontend/src/app/features/billing/settings.component.ts`, `upgrade.component.ts`
- Mocks: `Settings.dc.html`, `Upgrade.dc.html`

**Interfaces:**
- Consumes: `tl-app-topbar` (T13), tokens (T7), `AuthStore.user()/tier()` (existing).
- Produces: nothing consumed later. `manageBilling()/upgrade()/redirectTo()` seams unchanged.

- [ ] **Step 1: Settings** — imports `[AppTopbarComponent, RouterLink]`; class gains:

```ts
  protected readonly user = this.authStore.user;
  protected readonly initial = computed(() =>
    (this.authStore.user()?.displayName || this.authStore.user()?.email || '?').charAt(0).toUpperCase(),
  );
```
(add `computed` to the core imports). Template:

```ts
  template: `
    <div class="page">
      <tl-app-topbar mode="back" />
      <main class="wrap">
        <h1>Account &amp; billing</h1>
        <section class="tl-card sec">
          <div class="sec-label">Account</div>
          <div class="account">
            <div class="avatar">{{ initial() }}</div>
            <div>
              <div class="name">{{ user()?.displayName }}</div>
              <div class="email">{{ user()?.email }}</div>
            </div>
          </div>
        </section>
        <section class="tl-card sec">
          <div class="sec-label">Plan</div>
          <div class="row">
            <div class="plan-name">
              <span class="tier">{{ tier() === 'PREMIUM' ? 'Premium' : 'Free' }}</span>
              <span class="badge" [class.badge--premium]="tier() === 'PREMIUM'">
                {{ tier() === 'PREMIUM' ? '6 cells · no ads' : '5 cells + 1 ad' }}
              </span>
            </div>
            @if (tier() !== 'PREMIUM') {
              <a routerLink="/app/upgrade" class="tl-btn tl-btn--primary tl-btn--sm">Go Premium</a>
            }
          </div>
          <div class="hr"></div>
          <div class="row">
            <p class="hint">Manage payment method, invoices, and cancellation through the Stripe billing portal.</p>
            <button type="button" class="manage tl-btn tl-btn--soft tl-btn--sm"
              (click)="manageBilling()" [disabled]="loading()">Manage billing</button>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: flex; flex-direction: column; background: var(--tl-app-bg); }
    .wrap { flex: 1; width: 100%; max-width: 600px; margin: 0 auto; padding: 48px 24px; }
    h1 { margin: 0 0 24px; font-family: var(--tl-font-display); font-weight: 700; font-size: 32px; color: var(--tl-ink); }
    .sec { padding: 28px; margin-bottom: 18px; }
    .sec-label { font-family: var(--tl-font-mono); font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--tl-ink-faint); margin-bottom: 14px; }
    .account { display: flex; align-items: center; gap: 14px; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--tl-lilac-tint);
      color: var(--tl-lilac-ink); display: flex; align-items: center; justify-content: center;
      font-family: var(--tl-font-display); font-weight: 700; font-size: 18px; }
    .name { font-weight: 600; font-size: 16px; color: var(--tl-ink); }
    .email { font-size: 14px; color: var(--tl-ink-soft); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .plan-name { display: flex; align-items: center; gap: 12px; }
    .tier { font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; color: var(--tl-ink); }
    .badge { font-family: var(--tl-font-mono); font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--tl-peach-ink); background: var(--tl-peach-tint);
      border-radius: 999px; padding: 5px 12px; }
    .badge--premium { color: var(--tl-mint-ink); background: var(--tl-mint-tint); }
    .hr { height: 1px; background: var(--tl-app-bg); margin: 22px 0; }
    .hint { margin: 0; font-size: 15px; color: var(--tl-ink-soft); max-width: 340px; line-height: 1.5; }
  `],
```

- [ ] **Step 2: Upgrade** — imports `[AppTopbarComponent]`. Template:

```ts
  template: `
    <div class="page">
      <tl-app-topbar mode="back" />
      <main class="center">
        <div class="card tl-card tl-card--float">
          <div class="squares" aria-hidden="true">
            <span style="background: var(--tl-pink)"></span><span style="background: var(--tl-peach)"></span><span style="background: var(--tl-sky)"></span>
            <span style="background: var(--tl-mint)"></span><span style="background: var(--tl-lilac)"></span><span style="background: var(--tl-primary)"></span>
          </div>
          <h1>Go Premium</h1>
          <p class="sub">Unlock all six cells and remove ads from your dashboard.</p>
          <div class="perks">
            <div>✓ All 6 cells unlocked</div>
            <div>✓ Zero ads, ever</div>
            <div>✓ No advertising cookies</div>
            <div>✓ Cancel anytime via Stripe</div>
          </div>
          <div class="price">$4<span>/month</span></div>
          <button type="button" class="cta tl-btn tl-btn--primary" (click)="upgrade()" [disabled]="loading()">
            Remove ad — go Premium
          </button>
          <p class="tl-mono-note note">Secure checkout via Stripe</p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: flex; flex-direction: column; background: var(--tl-app-bg); }
    .center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px; }
    .card { width: 100%; max-width: 460px; padding: 40px; text-align: center; }
    .squares { display: inline-grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 22px; }
    .squares span { width: 16px; height: 16px; border-radius: 4px; }
    h1 { margin: 0 0 8px; font-family: var(--tl-font-display); font-weight: 700; font-size: 30px; color: var(--tl-ink); }
    .sub { margin: 0 0 26px; font-size: 16px; line-height: 1.55; color: var(--tl-ink-soft); }
    .perks { text-align: left; background: var(--tl-surface); border: 1px solid var(--tl-border);
      border-radius: 16px; padding: 22px; margin-bottom: 26px; display: flex; flex-direction: column;
      gap: 11px; font-size: 15px; color: var(--tl-prose-lead); }
    .price { font-family: var(--tl-font-display); font-weight: 700; font-size: 40px; color: var(--tl-ink); margin-bottom: 20px; }
    .price span { font-size: 17px; color: var(--tl-ink-faint); }
    .cta { width: 100%; padding: 15px; }
    .note { margin: 16px 0 0; font-size: 12px; }
  `],
```
Keep the `manage`/`cta` class names — billing specs target them.

- [ ] **Step 3: Verify + commit**

Suite + build green (billing specs unchanged).
```bash
cd /c/Users/xamcr/DashDash && git add -A frontend && git commit -m "feat(frontend): settings and upgrade pages in Soft Pastel design

TulipLot-Task: T16
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 17: Final verification, visual QA, push

**Files:** none created — verification only (fix anything found, smallest possible diff).

- [ ] **Step 1: All three suites + build**

```bash
cd /c/Users/xamcr/DashDash/backend && export DOCKER_API_VERSION=1.44 && ./gradlew --no-daemon build
cd ../extension && npm test
cd ../frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" && npx vitest run && npx ng build
```
Expected: backend 103, extension 20, frontend 100 (97 + header spec + pill spec ×2 cases + topbar spec — count whatever vitest reports and record it), `ng build` 12 prerendered routes.

- [ ] **Step 2: Visual QA against mocks**

Run backend (`SPRING_PROFILES_ACTIVE=dev ./gradlew bootRun`) + `npx ng serve`; open each route beside its mock file and compare (fonts, colors, spacing, radii):
| Route | Mock |
|---|---|
| `/` | `Landing.dc.html` |
| `/about` `/contact` `/privacy` `/terms` | `About/Contact/Privacy/Terms.dc.html` |
| `/guides` + a guide | `Guides.dc.html`, `Guide Detail.dc.html` |
| `/blog` + a post | `Blog.dc.html`, `Blog Detail.dc.html` |
| `/login` `/register` | `Login.dc.html`, `Register.dc.html` |
| `/app` (logged in, free tier) | `Dashboard.dc.html` |
| `/app/settings` `/app/upgrade` | `Settings.dc.html`, `Upgrade.dc.html` |
Also: open the catalog + add-URL dialogs; check the ad house-promo cell; resize to 390px width on `/`, `/guides`, `/login` (no horizontal scroll, nav collapses).

- [ ] **Step 3: Guard greps**

```bash
cd /c/Users/xamcr/DashDash
grep -ril "dashdash" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.gradle --exclude-dir=.angular | grep -v "docs/superpowers/plans/2026-07-21" | grep -v "docs/superpowers/specs/2026-07-21"
grep -rn "Space Grotesk" frontend/src/styles.scss >/dev/null && echo FONTS-OK
```
Expected: first grep empty; `FONTS-OK`.

- [ ] **Step 4: Push**

```bash
git status   # clean tree, all task commits present
git push origin main
```
Frontend CI job green; backend CI job red only on the known Testcontainers infra issue.

---

## Out of scope (explicitly)

- **Password-reset UI**: the backend flow exists and emails a link to `{ui.base-url}/reset-password?token=…`, but no frontend route/page implements it (pre-existing gap, no mock exists). Not part of this plan — flag for a future plan.
- CI backend job's Testcontainers networking fix (Mongo service container) — separate concern.
- Real AdSense/Web-Store IDs, domain registration, Fly app creation, OAuth/Stripe console changes — owner actions listed in the README cutover checklist (Task 6).




