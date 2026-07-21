# DashDash — Shared Contract & Plan Index

> **Authoritative for cross-cutting names, types, and signatures.** Every plan
> (`01`–`06`) consumes this. If a plan needs a symbol not defined here, it must
> add it under its own **Produces** block and follow the naming conventions
> below — never silently rename a symbol another plan owns.

This document exists so six independently-written plans stay type-consistent.
Read the **Symbol Ownership Map** to see which plan *defines* each symbol vs.
*consumes* it. A consumer must use the exact signature printed here.

---

## Global Constraints (every task inherits these)

- **Backend:** Java **25** LTS · Spring Boot **4.1.x** · Spring Framework 7 · Spring Security **7** · Spring Data MongoDB (2025.1 train) · Jackson 3 · `stripe-java` **33.x** pinned to a fixed API version · build with **Gradle (Kotlin DSL)**.
- **Frontend:** Angular **22** (standalone, **zoneless** default, **OnPush** default, signals, **Signal Forms**, built-in `@if`/`@for`) · `@ngrx/signals` SignalStore · `@angular/cdk` drag-drop · **Vitest** unit tests · **no** `@angular/ssr` runtime for the dashboard (prerender/SSG only for public routes) · **no** JWT in `localStorage`.
- **Extension:** Chrome **MV3** · `declarativeNetRequestWithHostAccess` + `optional_host_permissions` · single **static** DNR ruleset.
- **Hosting/domains:** UI `https://dashdash.app` (Cloudflare Pages) · API `https://api.dashdash.app` (Fly.io) · cookie domain `.dashdash.app` · dev origins `http://localhost:4200` (UI) and `http://localhost:8080` (API).
- **API base path:** all REST endpoints are under `/api/v1`.
- **Auth model:** first-party server session backed by a **custom MongoDB `SessionRepository`** on Spring Session **core** (`spring-session-data-mongodb` does NOT exist for Spring Boot 4.1 — Spring Session dropped MongoDB in 4.0; see "Spring Boot 4.1 reality notes"). Session cookie `DASHSESSION`, `httpOnly` + `Secure` + `SameSite=Lax` (domain `.dashdash.app` in prod). CSRF cookie `XSRF-TOKEN` (readable by JS), request header `X-XSRF-TOKEN`. Credentialed CORS from the UI origin only.
- **Free-tier posture:** prefer the free option unless it blocks a feature; note any spend. Cap Spring Mongo pool at 20–50. Atlas M0 has no backups.
- **Copy/naming:** product name is **DashDash**. Ad cell label is exactly **"Advertisements"**. Upgrade CTA copy: **"Remove ad — go Premium"**.
- **TDD/commits:** every task is test-first; commit at the end of each task with a Conventional Commit message (`feat:`/`test:`/`chore:` …). Repo is created in Plan 01 Task 1 — plans 02–06 assume `git` is initialized.

---

## Backend package layout (`com.dashdash`)

```
com.dashdash
├── DashdashApplication.java
├── common/        error handling (ApiError, GlobalExceptionHandler), UrlValidator, Instant/JSON config
├── config/        SecurityConfig, CorsConfig, MongoIndexConfig, SessionConfig, WebConfig
├── auth/          User, Subscription, Tier, SubStatus, UserRepository, UserService,
│                  DashPrincipal, DashUserDetails, DashUserDetailsService, DashOidcUserService,
│                  AuthController, dto/(RegisterRequest, LoginRequest, UserDto)
├── dashboard/     Dashboard, Cell, CellType, OpenMode, DashboardService, DashboardController,
│                  dto/(DashboardDto, CellDto, UpdateCellsRequest)
├── catalog/       CatalogApp, Compatibility, CatalogAppRepository, CatalogService, CatalogController,
│                  CatalogSeeder, dto/(CatalogAppDto)
├── billing/       ProcessedStripeEvent, ProcessedStripeEventRepository, StripeService,
│                  SubscriptionService, BillingController, StripeWebhookController,
│                  dto/(CheckoutSessionResponse, PortalSessionResponse)
└── ads/           AdConfigService, AdConfigController, dto/(AdConfigDto)
```

## Backend enums (owner: plan in parentheses)

```java
// auth (Plan 02)
public enum Tier { FREE, PREMIUM }
public enum SubStatus { NONE, ACTIVE, TRIALING, PAST_DUE, CANCELED }
// dashboard (Plan 03)
public enum CellType { APP, AD, EMPTY }
public enum OpenMode { FRAME, WINDOW }
// catalog (Plan 03)
public enum Compatibility { FRAMES_CLEAN, NEEDS_EXTENSION, LOGIN_IN_TAB, REFUSES_FRAME }
```

## Backend documents (fields are exact; use Lombok-free plain classes with getters/setters or Java records for embedded value objects as noted)

```java
// auth (Plan 02) — @Document("users")
class User {
  @Id String id;
  @Indexed(unique=true) String email;
  String passwordHash;            // null for OAuth-only accounts
  String googleSub;               // null for password-only accounts; sparse-unique
  String displayName;
  boolean emailVerified;
  Instant createdAt;
  Dashboard dashboard;            // embedded (owned by Plan 03, referenced by Plan 02 default init)
  Subscription subscription;      // embedded (owned by Plan 02)
}

// auth (Plan 02) — embedded value object
class Subscription {
  Tier tier;                      // default FREE
  String stripeCustomerId;        // sparse-unique
  String stripeSubscriptionId;    // sparse-unique
  SubStatus status;               // default NONE
  String priceId;
  Instant currentPeriodEnd;
  boolean cancelAtPeriodEnd;
}

// dashboard (model owned by Plan 02) — embedded
class Dashboard {
  List<Cell> cells;   // always exactly 6, indexed by slot 0..5
  Cell parkedApp;     // null normally; set to the displaced APP cell on downgrade when no slot was free
}
class Cell {
  int slot;                       // 0..5 (slot 5 = bottom-right = ad slot for FREE)
  CellType type;                  // APP | AD | EMPTY
  String url;                     // null unless APP
  String title;
  String catalogAppId;            // null unless added from catalog
  String iconUrl;
  OpenMode openMode;              // FRAME | WINDOW (default FRAME)
}

// catalog (Plan 03) — @Document("catalog_apps")
class CatalogApp {
  @Id String id; String name; String url; String iconUrl;
  String category; int order; Compatibility compatibility;
}

// billing (Plan 05) — @Document("stripe_events")
class ProcessedStripeEvent {
  @Id String id;                  // = Stripe event id
  String type; Instant processedAt;   // TTL index (e.g. 30d) via MongoIndexConfig
}
```

## Backend repositories

```java
// Plan 02
interface UserRepository extends MongoRepository<User,String> {
  Optional<User> findByEmail(String email);
  Optional<User> findByGoogleSub(String googleSub);
  Optional<User> findBySubscriptionStripeCustomerId(String stripeCustomerId);   // Plan 05 consumes
  Optional<User> findBySubscriptionStripeSubscriptionId(String stripeSubscriptionId);
}
// Plan 03
interface CatalogAppRepository extends MongoRepository<CatalogApp,String> {
  List<CatalogApp> findAllByOrderByCategoryAscOrderAsc();
}
// Plan 05
interface ProcessedStripeEventRepository extends MongoRepository<ProcessedStripeEvent,String> { }
```

## Backend DTOs (Java records)

```java
// auth (Plan 02)
record RegisterRequest(@Email String email, @NotBlank String password, @NotBlank String displayName) {}
record LoginRequest(@Email String email, @NotBlank String password) {}
record UserDto(String id, String email, String displayName, Tier tier, boolean adFree) {}
// adFree == (tier == PREMIUM). Free users get ads → adFree=false.

// dashboard (Plan 03)
record CellDto(int slot, CellType type, String url, String title,
               String catalogAppId, String iconUrl, OpenMode openMode) {}
record DashboardDto(List<CellDto> cells, CellDto parkedApp) {}   // parkedApp null unless a downgrade parked an app (see Canonical Resolutions v2)
record UpdateCellsRequest(@Size(min=6,max=6) @Valid List<CellDto> cells) {}

// catalog (Plan 03)
record CatalogAppDto(String id, String name, String url, String iconUrl,
                     String category, int order, Compatibility compatibility) {}

// billing (Plan 05)
record CheckoutSessionResponse(String url) {}
record PortalSessionResponse(String url) {}

// ads (Plan 06)
record AdConfigDto(boolean showAd, String adClient, String adSlot) {}
// showAd == (tier == FREE); adClient/adSlot from config (empty string until AdSense live)

// common (Plan 01)
record ApiError(String code, String message) {}
```

## Backend service signatures

```java
// auth (Plan 02)
class UserService {
  User register(RegisterRequest req);                 // throws EmailInUseException on dup
  UserDto toDto(User user);
  boolean isPremium(User user);                       // status ∈ {ACTIVE, TRIALING}
}
interface DashPrincipal { String getUserId(); String getEmail(); }   // implemented by DashUserDetails + DashOidcUser
// Controllers obtain the current user via @AuthenticationPrincipal DashPrincipal principal → principal.getUserId()

// dashboard MODEL classes Dashboard/Cell/CellType/OpenMode + this factory are DEFINED IN PLAN 02
//   (User embeds Dashboard, and register() must build a default). Plan 03 defines the service below.
class Dashboard {
  List<Cell> cells;
  static Dashboard defaultFor(boolean premium);   // 6 cells; FREE → slot5=AD + rest EMPTY; PREMIUM → all 6 EMPTY
}
// dashboard SERVICE (Plan 03) — consumes the Plan-02 model classes
class DashboardService {
  DashboardDto getDashboard(String userId);                       // maps Dashboard.parkedApp -> DashboardDto.parkedApp
  DashboardDto updateCells(String userId, List<CellDto> cells);   // enforces plan invariants + URL validation; CLEARS parkedApp (the PUT is the resolution of the parked-app prompt)
  Dashboard reconcileForTier(Dashboard current, boolean premium); // Plan 05 downgrade consumes this
}
// common (Plan 03 owns, all consume)
class UrlValidator { static boolean isSafeHttpsUrl(String url); } // https only; reject javascript:/data:/blob:/creds

// catalog (Plan 03)
class CatalogService { List<CatalogAppDto> list(); }

// billing (Plan 05)
class StripeService {
  String createCheckoutSession(User user);   // returns Checkout URL; mode=subscription, client_reference_id=userId
  String createPortalSession(User user);     // returns Billing Portal URL
  com.stripe.model.Event verifyAndParse(byte[] rawBody, String signatureHeader); // throws on bad signature
}
class SubscriptionService {
  boolean alreadyProcessed(String eventId);
  void markProcessed(String eventId, String type);
  void applyFromStripe(String stripeSubscriptionId);  // re-fetch sub, recompute premium, persist User + reconcile dashboard
  void handleDispute(String chargeId);                // policy: revoke premium
}
// ads (Plan 06)
class AdConfigService { AdConfigDto forUser(User user); }
```

## Backend REST endpoints (all `/api/v1`, JSON unless noted)

| Method | Path | Auth | Request | Response | Owner |
|---|---|---|---|---|---|
| POST | `/auth/register` | public | `RegisterRequest` | 201 `UserDto` + session cookie | 02 |
| POST | `/auth/login` | public | `LoginRequest` | 200 `UserDto` + session cookie | 02 |
| POST | `/auth/logout` | auth | — | 204 | 02 |
| GET | `/auth/me` | auth | — | 200 `UserDto` (401 if anon) | 02 |
| GET | `/oauth2/authorization/google` | public | — | 302 to Google (Spring-managed) | 02 |
| GET | `/dashboard` | auth | — | 200 `DashboardDto` | 03 |
| PUT | `/dashboard/cells` | auth | `UpdateCellsRequest` | 200 `DashboardDto` | 03 |
| GET | `/catalog` | public | — | 200 `List<CatalogAppDto>` | 03 |
| POST | `/billing/checkout-session` | auth | — | 200 `CheckoutSessionResponse` | 05 |
| POST | `/billing/portal-session` | auth | — | 200 `PortalSessionResponse` | 05 |
| POST | `/billing/webhook` | public (signature) | raw body (`byte[]`) + `Stripe-Signature` header | 200 | 05 |
| GET | `/config/ads` | auth | — | 200 `AdConfigDto` | 06 |
| GET | `/health` | public | — | 200 `{status:"UP"}` | 01 |

**Security rules:** `permitAll` for `/health`, `/auth/register`, `/auth/login`, `/catalog`, `/billing/webhook`, `/oauth2/**`; everything else under `/api/v1/**` requires authentication. CSRF applies to all state-changing endpoints **except** `/billing/webhook` (signature-verified, must be CSRF-exempt and raw-body).

---

## Frontend layout (`frontend/src/app`)

```
core/
  models/  enums.ts · user.model.ts · dashboard.model.ts · catalog.model.ts · ads.model.ts
  guards/  auth.guard.ts · chromium.guard.ts (optional notice, not a hard block)
  interceptors/  credentials.interceptor.ts
  api/     auth.api.ts · dashboard.api.ts · catalog.api.ts · billing.api.ts · ads.api.ts
  services/ extension-bridge.service.ts · browser-detect.service.ts · consent.service.ts (Plan 06)
stores/    auth.store.ts · dashboard.store.ts
features/
  marketing/  landing · about · privacy · terms · guides (list+detail) · blog (list+detail)  (Plan 06)
  auth/       login.component.ts · register.component.ts                                       (Plan 02)
  dashboard/  dashboard-page.component.ts · grid.component.ts · cell.component.ts ·
              safe-frame.component.ts · cell-toolbar.component.ts · catalog-dialog.component.ts ·
              add-url-dialog.component.ts                                                       (Plan 03)
  ads/        ad-cell.component.ts                                                              (Plan 06)
  billing/    upgrade.component.ts · settings.component.ts                                      (Plan 05)
app.config.ts · app.routes.ts · app.component.ts
environments/environment.ts · environment.development.ts
```

## Frontend TypeScript models (mirror the DTOs exactly)

**Each interface lives in a specific file — import from the exact module named in its comment (this split is authoritative; do NOT import `Cell`/`Dashboard`/`User`/`AdConfig` from `enums.ts`):**

```ts
// core/models/enums.ts   — string-literal type aliases ONLY
export type CellType = 'APP' | 'AD' | 'EMPTY';
export type OpenMode = 'FRAME' | 'WINDOW';
export type Tier = 'FREE' | 'PREMIUM';
export type Compatibility = 'FRAMES_CLEAN' | 'NEEDS_EXTENSION' | 'LOGIN_IN_TAB' | 'REFUSES_FRAME';

// core/models/user.model.ts        (owner: Plan 02)
export interface User { id: string; email: string; displayName: string; tier: Tier; adFree: boolean; }
export interface Credentials { email: string; password: string; }
export interface RegisterPayload { email: string; password: string; displayName: string; }

// core/models/dashboard.model.ts   (frontend interface owner: Plan 03; mirrors backend Java Dashboard/Cell owned by Plan 02)
export interface Cell { slot: number; type: CellType; url?: string; title?: string;
                        catalogAppId?: string; iconUrl?: string; openMode: OpenMode; }
export interface Dashboard { cells: Cell[]; parkedApp?: Cell; }   // cells length 6; parkedApp set only after a downgrade with no empty slot

// core/models/catalog.model.ts     (owner: Plan 03)
export interface CatalogApp { id: string; name: string; url: string; iconUrl: string;
                              category: string; order: number; compatibility: Compatibility; }

// core/models/ads.model.ts         (owner: Plan 06 — sole creator)
export interface AdConfig { showAd: boolean; adClient: string; adSlot: string; }
```

## Frontend API services (thin HttpClient wrappers, `withCredentials` via interceptor)

```ts
// base url from environment.apiBaseUrl  (prod 'https://api.dashdash.app/api/v1', dev 'http://localhost:8080/api/v1')
class AuthApi {      register(b): Observable<User>; login(b): Observable<User>; logout(): Observable<void>; me(): Observable<User>; }
class DashboardApi { get(): Observable<Dashboard>; updateCells(cells: Cell[]): Observable<Dashboard>; }
class CatalogApi {   list(): Observable<CatalogApp[]>; }
class BillingApi {   createCheckoutSession(): Observable<{url:string}>; createPortalSession(): Observable<{url:string}>; }
class AdsApi {       getConfig(): Observable<AdConfig>; }
```

## Frontend SignalStores (`@ngrx/signals`, `providedIn: 'root'`)

```ts
// stores/auth.store.ts  (Plan 02)
// state:    user: User | null; status: 'idle'|'loading'|'authenticated'|'anonymous'|'error'; error: string | null
// computed: isAuthenticated: boolean; tier: Tier; adFree: boolean
// methods:  loadMe(): void; login(cred:{email;password}): void; register(req:{email;password;displayName}): void; logout(): void

// stores/dashboard.store.ts  (Plan 03)
// state:    cells: Cell[] (length 6); loaded: boolean; saving: boolean; error: string | null
// computed: adSlotIndex: number (5); filledCount: number
// methods:  load(): void; swap(a: number, b: number): void; setCell(cell: Cell): void;
//           clearCell(slot: number): void; persist(): void   // persist() debounced 500ms → DashboardApi.updateCells
// NOTE: sleep/wake is EPHEMERAL UI state held in GridComponent/SafeFrameComponent, NOT persisted in the store.
```

## Frontend key component contracts

```ts
// GridComponent (Plan 03): injects DashboardStore; renders 6 CellComponents in cdkDropListGroup;
//   dragging = signal<boolean>(false); on cdkDropListDropped → dashboardStore.swap(from, to).
// CellComponent (Plan 03):
//   input cell = input.required<Cell>(); input dragging = input<boolean>(false);
//   output edit = output<number>(); output remove = output<number>(); output sleepToggle = output<number>();
//   renders one of: EMPTY (add button) | APP (SafeFrameComponent) | AD (AdCellComponent, Plan 06) |
//   states from Plan 04: 'needs-extension' | 'login-in-tab' | 'load-failed'.
// SafeFrameComponent (Plan 03):
//   input url = input.required<string>(); input title = input<string>(); input asleep = input<boolean>(false);
//   output loadFailed = output<void>();  reload(): void;  builds SafeResourceUrl only when !asleep and url is https.
//   sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
//   (never allow-top-navigation); allow="fullscreen; clipboard-write; autoplay"; referrerpolicy="strict-origin-when-cross-origin".
// AdCellComponent (Plan 06):
//   input config = input.required<AdConfig>();  renders house Upgrade promo OR AdSense <ins> (300x250, recreate-on-change);
//   only mounts when config.showAd === true.
```

## Extension contract (`extension/`)

```
extension/
  manifest.json          MV3; permissions:["declarativeNetRequestWithHostAccess"];
                         optional_host_permissions:["*://*/*"]; host_permissions:["*://dashdash.app/*"];
                         declarative_net_request.rule_resources → ruleset "dashdash_frame" / rules.json;
                         background.service_worker: "background.js"; content_scripts on "*://dashdash.app/*": "content.js"
  rules.json             one static rule: remove x-frame-options + content-security-policy on
                         resourceTypes:["sub_frame"], initiatorDomains:["dashdash.app"]
  background.js          handles chrome.runtime messages: PING→PONG(version); REQUEST_HOST→chrome.permissions.request→HOST_RESULT
  content.js            bridges window.postMessage(page) ↔ chrome.runtime(background)
```

**Message protocol** (page ↔ extension via `window.postMessage`, both sides check `event.source === window`):

```ts
// page → extension
{ source: 'dashdash', type: 'PING' }
{ source: 'dashdash', type: 'REQUEST_HOST', origin: string }   // e.g. 'https://mail.google.com'
// extension → page
{ source: 'dashdash-ext', type: 'PONG', version: string }
{ source: 'dashdash-ext', type: 'HOST_RESULT', origin: string, granted: boolean }
```

Frontend `ExtensionBridgeService` (Plan 04) exposes: `installed = signal<boolean>(false)`, `version = signal<string|null>(null)`, `ping(): Promise<boolean>`, `requestHost(origin: string): Promise<boolean>`.

---

## Symbol Ownership Map (who DEFINES what; everyone else CONSUMES)

| Symbol / area | Defined in | Consumed by |
|---|---|---|
| Repo, Gradle, Angular scaffold, CORS/CSRF/session config, `/health`, `ApiError`, CI, deploy | **01** | all |
| `User`, `Subscription`, `Tier`, `SubStatus`, `UserRepository`, `UserService`, `DashPrincipal`, security filter chain, `AuthController`, `UserDto`, `AuthStore`, auth UI, `authGuard`, `credentials.interceptor`, **embedded model classes `Dashboard`/`Cell`/`CellType`/`OpenMode` + `Dashboard.defaultFor()`** (User embeds them) | **02** | 03, 05, 06 |
| `DashboardService` (incl. `reconcileForTier`), `DashboardController`, `UrlValidator`, DTOs (`DashboardDto`/`CellDto`/`UpdateCellsRequest`), `CatalogApp`, `Compatibility`, `CatalogService`, `CatalogSeeder`, `DashboardStore`, `GridComponent`, `CellComponent`, `SafeFrameComponent`, catalog UI | **03** | 04, 05, 06 |
| `manifest.json`, `rules.json`, extension messaging, `ExtensionBridgeService`, framing-failure detection, cell states `needs-extension`/`login-in-tab`/`load-failed`, open-in-window action | **04** | 03 (states are stubbed in 03, wired in 04) |
| `ProcessedStripeEvent`, `StripeService`, `SubscriptionService`, `BillingController`, `StripeWebhookController`, downgrade reconcile call, `BillingApi`, `UpgradeComponent`, `SettingsComponent`, tier gating in UI | **05** | 06 (adFree gating) |
| Prerender/SSG pipeline, marketing/guides/blog/legal pages, `ads.txt`, `ConsentService`, `AdConfigService`, `AdConfigController`, `AdConfigDto`, `AdsApi`, `AdCellComponent`, SEO | **06** | — |

**Interface stubs across plan boundaries:** Plan 03 renders `CellComponent` states `needs-extension`/`login-in-tab`/`load-failed` as static templates with no behavior; Plan 04 wires the behavior (detection + `ExtensionBridgeService`). Plan 03 leaves the `AD` cell as an empty placeholder; Plan 06 drops in `AdCellComponent`. Plan 02 creates a default `FREE` `Subscription` on register; Plan 05 mutates it via webhooks. This staged ordering means each plan is executable and testable on its own.

## Build order

`01 → 02 → 03 → {04, 05} → 06`. Plans 04 and 05 both depend only on 01–03 and can be built in either order (or in parallel by two engineers). Plan 06 depends on 05 (adFree gating) and 03 (grid).

## Canonical Resolutions v2 (authoritative — resolves cross-plan drift found in verification)

These pin choices that were ambiguous in v1 and caused drift. Where a plan currently contradicts this section, the plan is wrong and must be edited to match.

### Frontend route table (single source of truth)

| Path | Component | Guard | Owner | Notes |
|---|---|---|---|---|
| `/` | `LandingComponent` (`features/marketing/landing.component.ts`, selector `dd-landing`) | public | **06** | Plan 01 ships a temporary `features/landing/landing.component.ts` placeholder at `/`; **Plan 06 deletes that placeholder and its route** and owns the final `/`. |
| `/about` `/privacy` `/terms` `/contact` | marketing pages | public | 06 | `/contact` is required (spec) — Plan 06 adds `ContactComponent`. |
| `/guides` `/guides/:slug` `/blog` `/blog/:slug` | marketing | public | 06 | |
| `/login` `/register` | `LoginComponent` / `RegisterComponent` | public | 02 | **Top-level, not under `/app`.** Marketing "sign in / get started" link here. |
| `/app` | `DashboardPageComponent` (`features/dashboard/dashboard-page.component.ts`) | `authGuard` | **03** | **The dashboard lives at `/app`.** Plan 02 ships a temporary `HomeComponent` at `/app`; **Plan 03 replaces it** with `DashboardPageComponent`. There is **no `/dashboard` route.** |
| `/app/settings` | `SettingsComponent` | `authGuard` | 05 | |
| `/app/upgrade` | `UpgradeComponent` | `authGuard` | 05 | AdCell house promo and "Remove ad — go Premium" link here. |

Redirect targets (exact): post-login, post-register, and OIDC success → `/app`. Stripe checkout `success_url` → `https://dashdash.app/app?checkout=success` (prod) / `http://localhost:4200/app?checkout=success` (dev); `cancel_url` → `/app/upgrade`. `DashboardPageComponent` reads `?checkout=success` and calls `authStore.loadMe()` then `dashboardStore.load()`.

### Component selectors — dashboard/ads components use the `dd-` prefix

`dd-grid` (GridComponent) · `dd-cell` (CellComponent) · `dd-safe-frame` (SafeFrameComponent) · `dd-ad-cell` (AdCellComponent) · `dd-cell-toolbar` (CellToolbarComponent) · `dd-landing` (marketing landing). Any `<app-cell>` / `<app-safe-frame>` / `<app-ad-cell>` reference is WRONG — use the `dd-` element. (Auth/marketing components created in Plans 01/02 keep whatever selector they were written with; only the cross-referenced dashboard/ads components are pinned here.)

### `environment` import depth

From any file under `src/app/**` (i.e. `core/api/*`, `core/services/*`, `features/<area>/*`), import as `import { environment } from '../../../environments/environment'` — always **three** `../`. `environment` exists only at `src/environments/environment.ts` (+ `.development.ts`), owned by Plan 01.

### Single-ownership assignments (resolve duplicate Create)

- `core/models/ads.model.ts` (`AdConfig`) — **Plan 06 only.** Plan 03 must NOT create it (Plan 03 does not need `AdConfig`).
- `frontend/public/_redirects` — **Plan 01 Creates** it as exactly `/* /index.html 200`. Plan 06 may **Modify** (never re-Create) it. Prerendered public HTML and `/ads.txt` are real static files served before the SPA catch-all, so no rule is needed to protect them.
- `frontend/public/ads.txt` — **Plan 06 only.** Plan 01 must not place any `ads.txt` (drop the `content/public/ads.txt` placeholder).
- Landing/`/` route — Plan 06 owns the final one and deletes Plan 01's placeholder (see route table).

### Backend config file & premium source of truth

- All backend config is in **`application.yml`** (Plans 01/02). Stripe and AdSense keys go in `application.yml` — **never** `application.properties` (that file does not exist).
- The single premium predicate is `UserService.isPremium(user)` = `subscription.status ∈ {ACTIVE, TRIALING}`. `UserDto.adFree = isPremium(user)`. `AdConfigService.forUser`: `showAd = !isPremium(user)` (compute from `isPremium`, **not** the denormalized `subscription.tier` field). `SubscriptionService` keeps `subscription.tier` as a cache in sync with status, but no read path branches on `tier`.

### Downgrade "park an app" (spec: prompt to drop an app)

`DashboardService.reconcileForTier(current, premium)` on downgrade to FREE: if slot 5 holds an APP and an EMPTY slot exists, move it there and set slot 5 = AD; if **no** EMPTY slot exists, set slot 5 = AD and move the displaced app into `Dashboard.parkedApp` (do not discard it). On upgrade to PREMIUM, slot 5 AD → EMPTY and leave `parkedApp` untouched. Persist the whole `Dashboard` (including `parkedApp`). Plan 05's webhook path persists the returned dashboard verbatim (must not drop `parkedApp`). Plan 03's `DashboardPageComponent` shows a "parked app" prompt when `dashboard.parkedApp` is set, letting the user place it into a chosen slot (replacing that app) or discard it; resolving clears `parkedApp`.

### Password reset (spec: Auth password-reset endpoints) — owner Plan 02

Endpoints (public): `POST /api/v1/auth/password-reset/request` (`{email}` → 204 always, to avoid account enumeration) and `POST /api/v1/auth/password-reset/confirm` (`{token, newPassword}` → 204, 400 on invalid/expired token). Backed by `@Document("password_reset_tokens")` `PasswordResetToken {@Id String id; String userId; String tokenHash; Instant expiresAt;}` with a TTL index on `expiresAt` (added in `MongoIndexConfig`). Delivery via an `EmailSender` interface (`void send(String to, String subject, String body)`) with a dev `LoggingEmailSender` impl (logs the reset link); the prod SMTP/SES impl is a config-only swap (out of scope for v1 code, noted in the cost table as $0 dev). Tokens are random 256-bit, stored only as a SHA-256 hash, single-use, 30-min expiry.

## Spring Boot 4.1 reality notes (discovered during execution — authoritative)

The plans were drafted against Spring Boot 3.x idioms in places. Boot 4.1 relocations that every backend task must apply:

- **Test slices moved to per-module packages.** `@WebMvcTest` is now `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest` (NOT `org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest`), and it requires the dependency `testImplementation("org.springframework.boot:spring-boot-webmvc-test")`. Apply this wherever a plan's test code uses the old `@WebMvcTest` import (Plan 01 Task 4, Plan 02 controller tests, Plan 03/05/06 controller tests). Reviewers must NOT flag the new package/dependency as drift — the old path does not compile on 4.1.
- **Toolchain:** Gradle wrapper is pinned to **9.0.0** (as committed in Task 2; builds succeed), and `org.gradle.toolchains.foojay-resolver-convention` is **1.0.0** (0.9.0 references the removed `JvmVendorSpec.IBM_SEMERU` and fails on Gradle 9.x). JDK 25 is provisioned by the toolchain.
- **Session store = custom Mongo repository.** Use these exact shapes:

```java
// config/SessionConfig.java  (Plan 01) — @Configuration @EnableSpringHttpSession
//   registers the MongoSessionRepository bean + a DefaultCookieSerializer:
//   cookie name "DASHSESSION", httpOnly, sameSite "Lax", useSecureCookie + domainName from env
//   (dashdash.session.secure / dashdash.session.cookie-domain), path "/".

// auth/session/MongoSession.java  (Plan 01) — implements org.springframework.session.Session
//   by delegating to an internal org.springframework.session.MapSession; adds an `expireAt`
//   Instant (= lastAccessedTime + maxInactiveInterval) persisted for the TTL index.
//   @Document("sessions"); @Id is the session id.

// auth/session/MongoSessionRepository.java  (Plan 01) — implements SessionRepository<MongoSession>
class MongoSessionRepository /* implements SessionRepository<MongoSession> */ {
  MongoSession createSession();                 // new MongoSession, honoring configured default maxInactiveInterval
  void save(MongoSession session);              // upsert the session document
  MongoSession findById(String id);             // null if absent OR expired (delete-on-read if expired)
  void deleteById(String id);                   // remove document
}
// MongoIndexConfig adds a TTL index on sessions.expireAt (expireAfter = 0s → Mongo expires at that instant).
// spring-session-core is in the Boot 4.1 BOM; add testImplementation for the session + Testcontainers-Mongo round-trip test.
```

Spring Session core still generates/secures session IDs and runs the `SessionRepositoryFilter`; only persistence is custom. Plan 02's auth flows rely on the standard `HttpSession`/`SecurityContextRepository` being transparently Mongo-backed via this store — Plan 02 does not re-implement any of it.

## Plan documents

- `2026-07-21-dashdash-01-walking-skeleton.md`
- `2026-07-21-dashdash-02-auth.md`
- `2026-07-21-dashdash-03-dashboard-core.md`
- `2026-07-21-dashdash-04-extension.md`
- `2026-07-21-dashdash-05-billing.md`
- `2026-07-21-dashdash-06-content-and-ads.md`
