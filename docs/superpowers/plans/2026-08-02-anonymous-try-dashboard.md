# Anonymous Try-It Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/try` page where signed-out visitors use a real 3×2 dashboard with 2 working cells, 3 signup-locked cells, and a crawlable ad cell — unblocking AdSense review and giving the product a try-before-signup funnel.

**Architecture:** `GridComponent` stops injecting `DashboardStore` directly and injects a `DASHBOARD_SOURCE` token instead; `/app` provides an adapter over the existing store (behaviour unchanged), `/try` provides a localStorage-backed `AnonymousDashboardStore`. Signup-locked slots are a render concern — `CellComponent` gains a `locked` input — so the persisted `CellType` enum is untouched. The ad-config endpoint opens to anonymous callers; migration of a visitor's two cells into a new account happens client-side when they first land on `/app`.

**Tech Stack:** Angular 20 standalone (signals, `InjectionToken`, route-level providers, `@angular/ssr` prerender), Vitest + TestBed (zoneless), Spring Boot 4.1 / Spring Security 7.

**Spec:** `docs/superpowers/specs/2026-08-02-anonymous-try-dashboard-design.md`

## Global Constraints

- Frontend commands run from `C:\Users\xamcr\DashDash\frontend`; full suite `npm test`; builds need `PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" npm run build`.
- Backend commands run from `C:\Users\xamcr\DashDash\backend`: `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon build` (the env var is required for Testcontainers on this machine).
- **The `/app` dashboard is the revenue path. Its behaviour must not change.** Every existing dashboard, grid, and cell spec must still pass; where a spec provided `DashboardStore` to `GridComponent` it now provides `DASHBOARD_SOURCE` with the same data — that is a test-wiring change, never a behaviour change.
- **Spec correction (authoritative over the spec document):** `/try` is **prerendered**, so Cloudflare Pages serves `try/index.html` directly and it needs **no `_redirects` row**. The spec's caution about rows applies to `RenderMode.Client` routes only — verified in production, where every prerendered marketing route serves 200 with no row. Do not add a row.
- Anonymous cells persist under the localStorage key `tl-try-cells`. Usable slots are `0` and `1`; signup-locked slots are `2`, `3`, `4`; slot `5` is the ad cell.
- All storage access must tolerate `localStorage` throwing or being absent (private mode, prerender): reads fall back to defaults, writes are fire-and-forget, and no error UI is ever shown.
- Every commit message ends with the two trailers your harness instructs, keeping the session line exactly:
  `Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t`

---

### Task 1: The `DASHBOARD_SOURCE` seam

**Files:**
- Create: `frontend/src/app/features/dashboard/dashboard-source.ts`
- Modify: `frontend/src/app/features/dashboard/grid.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (the `app` route only)
- Modify: every spec that provides `DashboardStore` for `GridComponent` — at minimum `grid.component.spec.ts`, `grid.gating.spec.ts`, `grid-focus.spec.ts` (check with `grep -rl "GridComponent" src/app/features/dashboard/*.spec.ts`)

**Interfaces:**
- Produces: `DashboardSource` interface — `cells: Signal<Cell[]>`, `lockedSlots: Signal<number[]>`, `setCell(cell: Cell): void`, `clearCell(slot: number): void`, `swap(a: number, b: number): void`. `DASHBOARD_SOURCE: InjectionToken<DashboardSource>`. `provideServerDashboardSource(): Provider` — the `/app` adapter over `DashboardStore`. Tasks 2–5 depend on these exact names.
- This task is a **pure refactor**: no user-visible change.

- [ ] **Step 1: Write the seam**

Create `dashboard-source.ts`:

```typescript
import { InjectionToken, Provider, Signal, computed, inject } from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import { DashboardStore } from '../../stores/dashboard.store';

/**
 * What the grid needs from whatever backs it — the signed-in store on /app, or the
 * localStorage-backed anonymous store on /try. The grid depends on this, not on a
 * concrete store, so the two pages share one grid instead of forking it.
 */
export interface DashboardSource {
  readonly cells: Signal<Cell[]>;
  /** Slots that require an account: rendered as a signup CTA, never editable or draggable. */
  readonly lockedSlots: Signal<number[]>;
  setCell(cell: Cell): void;
  clearCell(slot: number): void;
  swap(a: number, b: number): void;
}

export const DASHBOARD_SOURCE = new InjectionToken<DashboardSource>('DASHBOARD_SOURCE');

/** /app: delegates to the existing server-backed store, which is left untouched. */
export function provideServerDashboardSource(): Provider {
  return {
    provide: DASHBOARD_SOURCE,
    useFactory: (): DashboardSource => {
      const store = inject(DashboardStore);
      return {
        cells: store.cells,
        lockedSlots: computed<number[]>(() => []),
        setCell: (cell: Cell) => store.setCell(cell),
        clearCell: (slot: number) => store.clearCell(slot),
        swap: (a: number, b: number) => store.swap(a, b),
      };
    },
  };
}
```

- [ ] **Step 2: Point the grid at the token**

In `grid.component.ts`, replace the store injection:

```typescript
  protected store = inject(DASHBOARD_SOURCE);
```

and update the import (drop `DashboardStore`, add `DASHBOARD_SOURCE` from `./dashboard-source`). Nothing else in the component changes — the template already only calls `store.cells()` and the three mutators.

- [ ] **Step 3: Provide it on the `/app` route**

In `app.routes.ts`, the `app` route gains a providers array (leave `canActivate` and `loadComponent` as they are):

```typescript
  {
    path: 'app',
    canActivate: [authGuard],
    providers: [provideServerDashboardSource()],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
```

with `import { provideServerDashboardSource } from './features/dashboard/dashboard-source';` at the top.

- [ ] **Step 4: Update the grid specs' wiring**

Run `npx vitest run src/app/features/dashboard/` — specs that provided `DashboardStore` for `GridComponent` now fail with a missing-provider error for `DASHBOARD_SOURCE`. In each, replace that provider with an equivalent source stub, keeping whatever cells the test already used:

```typescript
        {
          provide: DASHBOARD_SOURCE,
          useValue: {
            cells: signal(<the same cells the spec already used>),
            lockedSlots: signal<number[]>([]),
            setCell: () => {},
            clearCell: () => {},
            swap: () => {},
          },
        },
```

Leave any `AuthStore` stub in place — the ad-slot lock still reads it. **Do not change a single assertion**: if an assertion fails, the refactor broke behaviour and that is a real defect to fix, not a test to adjust.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/app/features/dashboard/` → PASS.
Run: `npm test` → all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/dashboard/dashboard-source.ts frontend/src/app/features/dashboard/grid.component.ts frontend/src/app/app.routes.ts frontend/src/app/features/dashboard/
git commit -m "refactor(frontend): grid depends on a DASHBOARD_SOURCE token, not the server store"
```

---

### Task 2: Signup-locked cells

**Files:**
- Modify: `frontend/src/app/features/dashboard/cell.component.ts`
- Modify: `frontend/src/app/features/dashboard/grid.component.ts`
- Test: `frontend/src/app/features/dashboard/cell.component.spec.ts`, `frontend/src/app/features/dashboard/grid.gating.spec.ts`

**Interfaces:**
- Consumes: `DASHBOARD_SOURCE` / `lockedSlots` from Task 1.
- Produces: `CellComponent.locked = input<boolean>(false)` — when true the cell renders a signup CTA (`[data-testid="locked-cell"]`) linking to `/register`, and nothing else. `GridComponent.isSignupLocked(slot: number): boolean` reads `store.lockedSlots()`; locked slots are non-editable and non-draggable. Task 4's `/try` page relies on this rendering.

- [ ] **Step 1: Write the failing tests**

Append to `cell.component.spec.ts`:

```typescript
  it('renders a signup CTA instead of the cell when locked', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const f = TestBed.createComponent(CellComponent);
    f.componentRef.setInput('cell', { slot: 2, type: 'EMPTY', openMode: 'FRAME' } as Cell);
    f.componentRef.setInput('locked', true);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="locked-cell"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="add-btn"]')).toBeNull();
  });
```

Append to `grid.gating.spec.ts`. Build the fixture exactly the way that file's existing tests do (same `TestBed.configureTestingModule` providers and `createComponent(GridComponent)` call), changing only the `DASHBOARD_SOURCE` stub so its `lockedSlots` is `signal([2, 3, 4])` and its `cells` is a six-cell array with slot 5 of type `'AD'`. Assert through the DOM, not on the component — `isSignupLocked` is `protected` and TypeScript will not let a spec call it:

```typescript
  it('renders a locked cell for each signup-locked slot and leaves the rest usable', () => {
    // (same setup as this file's other tests; DASHBOARD_SOURCE stub with lockedSlots signal([2, 3, 4]))
    const locked = fixture.nativeElement.querySelectorAll('[data-testid="locked-cell"]');
    expect(locked.length).toBe(3);
    // slot 0 is usable, so it still offers the add affordance
    expect(fixture.nativeElement.querySelector('[data-testid="add-btn"]')).not.toBeNull();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/app/features/dashboard/cell.component.spec.ts src/app/features/dashboard/grid.gating.spec.ts`
Expected: FAIL — `setInput('locked', …)` throws (no such input) and `isSignupLocked` is undefined.

- [ ] **Step 3: Implement the locked cell**

In `cell.component.ts`, add the input beside the others:

```typescript
  readonly locked = input<boolean>(false);
```

and wrap the existing `@switch (cell().type)` block so the locked branch wins:

```html
    @if (locked()) {
      <a class="locked" data-testid="locked-cell" routerLink="/register">
        <span class="locked__icon" aria-hidden="true">🔒</span>
        <span class="locked__text">Sign up free to unlock this cell</span>
      </a>
    } @else {
      @switch (cell().type) {
        <!-- existing branches, unchanged -->
      }
    }
```

Add `RouterLink` to the component's `imports` array, and these styles:

```css
    .locked { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 10px; text-decoration: none; border: 1.5px dashed var(--tl-border-dashed);
      border-radius: 12px; background: var(--tl-surface); text-align: center; padding: 16px; }
    .locked:hover { background: var(--tl-surface-3); }
    .locked__icon { font-size: 20px; }
    .locked__text { font-family: var(--tl-font-display); font-weight: 600; font-size: 14px;
      color: var(--tl-ink-soft); max-width: 150px; line-height: 1.4; }
```

- [ ] **Step 4: Wire it in the grid**

In `grid.component.ts`, add the predicate next to `isSlotLocked`:

```typescript
  /** Slots that need an account (the /try page's 3 locked cells); always [] when signed in. */
  protected isSignupLocked(slot: number): boolean {
    return this.store.lockedSlots().includes(slot);
  }
```

Pass it to the cell in the template — add `[locked]="isSignupLocked(cell.slot)"` to the `<tl-cell>` bindings — and extend the drag guard so a locked cell cannot be dragged:

```html
            [cdkDragDisabled]="cell.type !== 'APP' || isSlotLocked(i) || isSignupLocked(cell.slot)"
```

Also make the drop target refuse locked slots by extending the existing `cdkDropListDisabled` binding:

```html
          [cdkDropListDisabled]="cell.type === 'AD' || isSignupLocked(cell.slot)"
```

(`isSignupLocked` is `protected` so the template can call it; the spec asserts on the rendered DOM rather than on the method, since TypeScript blocks external access to a protected member.)

- [ ] **Step 5: Verify**

Run: `npx vitest run src/app/features/dashboard/` → PASS.
Run: `npm test` → green. The `/app` grid is unaffected because its `lockedSlots()` is always `[]`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/dashboard/cell.component.ts frontend/src/app/features/dashboard/grid.component.ts frontend/src/app/features/dashboard/cell.component.spec.ts frontend/src/app/features/dashboard/grid.gating.spec.ts
git commit -m "feat(frontend): signup-locked cells render an upgrade CTA and refuse drag/edit"
```

---

### Task 3: `AnonymousDashboardStore`

**Files:**
- Create: `frontend/src/app/features/dashboard/anonymous-dashboard.store.ts`
- Create: `frontend/src/app/features/dashboard/anonymous-dashboard.store.spec.ts`

**Interfaces:**
- Consumes: `DashboardSource` from Task 1.
- Produces: `AnonymousDashboardStore implements DashboardSource` (an `@Injectable()`, **not** `providedIn: 'root'` — it is provided per-route). Extra members Task 6 uses: `configuredCells(): Cell[]` returns the APP cells in slots 0–1; `clearStorage(): void` removes the key. Also exports `TRY_STORAGE_KEY = 'tl-try-cells'` and `provideAnonymousDashboardSource(): Provider`.

- [ ] **Step 1: Write the failing spec**

Create `anonymous-dashboard.store.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnonymousDashboardStore, TRY_STORAGE_KEY } from './anonymous-dashboard.store';
import type { Cell } from '../../core/models/dashboard.model';

const APP: Cell = { slot: 0, type: 'APP', url: 'https://trello.com', title: 'Trello', openMode: 'FRAME' };

function make(): AnonymousDashboardStore {
  TestBed.configureTestingModule({ providers: [AnonymousDashboardStore] });
  return TestBed.inject(AnonymousDashboardStore);
}

describe('AnonymousDashboardStore', () => {
  beforeEach(() => { localStorage.removeItem(TRY_STORAGE_KEY); TestBed.resetTestingModule(); });
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(TRY_STORAGE_KEY); });

  it('starts with six cells: two empty, three locked-empty, and the ad slot', () => {
    const s = make();
    expect(s.cells().length).toBe(6);
    expect(s.cells()[5].type).toBe('AD');
    expect(s.lockedSlots()).toEqual([2, 3, 4]);
  });

  it('sets and clears a usable cell', () => {
    const s = make();
    s.setCell(APP);
    expect(s.cells()[0].title).toBe('Trello');
    s.clearCell(0);
    expect(s.cells()[0].type).toBe('EMPTY');
  });

  it('ignores writes to locked and ad slots', () => {
    const s = make();
    s.setCell({ ...APP, slot: 3 });
    s.setCell({ ...APP, slot: 5 });
    expect(s.cells()[3].type).toBe('EMPTY');
    expect(s.cells()[5].type).toBe('AD');
  });

  it('swaps only within the usable slots', () => {
    const s = make();
    s.setCell(APP);
    s.swap(0, 1);
    expect(s.cells()[1].title).toBe('Trello');
    expect(s.cells()[0].type).toBe('EMPTY');
    s.swap(1, 4);
    expect(s.cells()[1].title).toBe('Trello');
  });

  it('round-trips through localStorage', () => {
    make().setCell(APP);
    TestBed.resetTestingModule();
    expect(make().cells()[0].title).toBe('Trello');
  });

  it('configuredCells returns only the visitor APP cells', () => {
    const s = make();
    s.setCell(APP);
    expect(s.configuredCells().map((c) => c.slot)).toEqual([0]);
  });

  it('survives localStorage throwing on read and on write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const s = make();
    expect(s.cells().length).toBe(6);
    expect(() => s.setCell(APP)).not.toThrow();
    expect(s.cells()[0].title).toBe('Trello');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/features/dashboard/anonymous-dashboard.store.spec.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `anonymous-dashboard.store.ts`:

```typescript
import { Injectable, Provider, computed, signal } from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import { DASHBOARD_SOURCE, DashboardSource } from './dashboard-source';

export const TRY_STORAGE_KEY = 'tl-try-cells';

const USABLE_SLOTS = [0, 1];
const LOCKED_SLOTS = [2, 3, 4];
const AD_SLOT = 5;

function emptyCell(slot: number): Cell {
  return { slot, type: 'EMPTY', openMode: 'FRAME' };
}

function defaultCells(): Cell[] {
  return [0, 1, 2, 3, 4, 5].map((slot) =>
    slot === AD_SLOT ? ({ slot, type: 'AD', openMode: 'FRAME' } as Cell) : emptyCell(slot),
  );
}

/**
 * The /try page's dashboard: six cells where only slots 0-1 are the visitor's, kept in
 * localStorage instead of on the server. Every storage touch is best-effort — a visitor
 * in private mode still gets a working grid, it just doesn't survive a reload.
 */
@Injectable()
export class AnonymousDashboardStore implements DashboardSource {
  private readonly _cells = signal<Cell[]>(defaultCells());
  readonly cells = this._cells.asReadonly();
  readonly lockedSlots = computed<number[]>(() => LOCKED_SLOTS);

  constructor() {
    this.restore();
  }

  setCell(cell: Cell): void {
    if (!USABLE_SLOTS.includes(cell.slot)) return;
    this._cells.set(this._cells().map((c) => (c.slot === cell.slot ? { ...cell } : c)));
    this.persist();
  }

  clearCell(slot: number): void {
    if (!USABLE_SLOTS.includes(slot)) return;
    this._cells.set(this._cells().map((c) => (c.slot === slot ? emptyCell(slot) : c)));
    this.persist();
  }

  swap(a: number, b: number): void {
    if (!USABLE_SLOTS.includes(a) || !USABLE_SLOTS.includes(b) || a === b) return;
    const cells = [...this._cells()];
    const first = cells[a];
    const second = cells[b];
    cells[a] = { ...second, slot: a };
    cells[b] = { ...first, slot: b };
    this._cells.set(cells);
    this.persist();
  }

  /** The apps this visitor actually placed — what Task 6 migrates into a new account. */
  configuredCells(): Cell[] {
    return this._cells().filter((c) => USABLE_SLOTS.includes(c.slot) && c.type === 'APP');
  }

  clearStorage(): void {
    try {
      localStorage.removeItem(TRY_STORAGE_KEY);
    } catch {
      /* storage unavailable; nothing to clear */
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(TRY_STORAGE_KEY, JSON.stringify(this.configuredCells()));
    } catch {
      /* private mode or storage disabled: the grid still works for this session */
    }
  }

  private restore(): void {
    let stored: Cell[] = [];
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(TRY_STORAGE_KEY);
      stored = raw ? (JSON.parse(raw) as Cell[]) : [];
    } catch {
      return; // unreadable or malformed: keep the defaults
    }
    if (!Array.isArray(stored) || stored.length === 0) return;
    const cells = defaultCells();
    for (const cell of stored) {
      if (cell && USABLE_SLOTS.includes(cell.slot) && cell.type === 'APP') {
        cells[cell.slot] = { ...cell };
      }
    }
    this._cells.set(cells);
  }
}

/** /try: the grid is backed by localStorage and slots 2-4 are signup-locked. */
export function provideAnonymousDashboardSource(): Provider[] {
  return [
    AnonymousDashboardStore,
    { provide: DASHBOARD_SOURCE, useExisting: AnonymousDashboardStore },
  ];
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/app/features/dashboard/anonymous-dashboard.store.spec.ts` → PASS (7 tests).
Run: `npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/dashboard/anonymous-dashboard.store.ts frontend/src/app/features/dashboard/anonymous-dashboard.store.spec.ts
git commit -m "feat(frontend): localStorage-backed dashboard source for anonymous visitors"
```

---

### Task 4: Ad config for signed-out visitors (backend)

**Files:**
- Modify: `backend/src/main/java/com/tuliplot/config/SecurityConfig.java`
- Modify: `backend/src/main/java/com/tuliplot/ads/AdConfigController.java`
- Modify: `backend/src/main/java/com/tuliplot/ads/AdConfigService.java`
- Test: `backend/src/test/java/com/tuliplot/ads/` (create `AdConfigServiceTest.java`)

**Interfaces:**
- Produces: `GET /api/v1/config/ads` answers anonymous callers with `showAd = true` plus the configured client and slot. `AdConfigService.forAnonymous()` returns that DTO. Task 5's `/try` page depends on this not 401-ing.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/com/tuliplot/ads/AdConfigServiceTest.java`:

```java
package com.tuliplot.ads;

import static org.assertj.core.api.Assertions.assertThat;

import com.tuliplot.ads.dto.AdConfigDto;
import com.tuliplot.auth.UserService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AdConfigServiceTest {

    private final AdConfigService service =
            new AdConfigService(Mockito.mock(UserService.class), "ca-pub-test", "1234567890");

    @Test
    void anonymousVisitorsSeeAds() {
        AdConfigDto dto = service.forAnonymous();
        assertThat(dto.showAd()).isTrue();
        assertThat(dto.adClient()).isEqualTo("ca-pub-test");
        assertThat(dto.adSlot()).isEqualTo("1234567890");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon test --tests "com.tuliplot.ads.AdConfigServiceTest"`
Expected: compilation FAILURE — `forAnonymous()` does not exist.

- [ ] **Step 3: Implement**

In `AdConfigService`, add beside `forUser`:

```java
    /** Signed-out visitors on the public /try page always see the ad cell. */
    public AdConfigDto forAnonymous() {
        return new AdConfigDto(true, adClient, adSlot);
    }
```

In `AdConfigController.getAdsConfig`, handle a null principal before the lookup:

```java
    @GetMapping("/ads")
    public AdConfigDto getAdsConfig(@AuthenticationPrincipal DashPrincipal principal) {
        if (principal == null) {
            return adConfigService.forAnonymous();
        }
        User user =
                userRepository
                        .findById(principal.getUserId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return adConfigService.forUser(user);
    }
```

In `SecurityConfig`, add the path to the existing `permitAll` matcher list, next to `"/api/v1/catalog"`:

```java
                    "/api/v1/config/ads",
```

- [ ] **Step 4: Verify**

Run: `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon test --tests "com.tuliplot.ads.AdConfigServiceTest"` → PASS.
Run: `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon build` → BUILD SUCCESSFUL, all tests green (a signed-in caller must still get their own config — the existing controller/auth tests cover that).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/tuliplot/ads/ backend/src/main/java/com/tuliplot/config/SecurityConfig.java backend/src/test/java/com/tuliplot/ads/
git commit -m "feat(backend): serve ad config to anonymous callers so the public try page can render an ad"
```

---

### Task 5: The `/try` page

**Files:**
- Create: `frontend/src/app/features/dashboard/try-page.component.ts`
- Create: `frontend/src/app/features/dashboard/try-page.component.spec.ts`
- Modify: `frontend/src/app/app.routes.ts`, `frontend/src/app/app.routes.server.ts`
- Modify: `frontend/scripts/build-content.mjs` (add `/try` to `staticRoutes`)
- Regenerate: `frontend/public/sitemap.xml`

**Interfaces:**
- Consumes: `provideAnonymousDashboardSource()` (Task 3), `GridComponent`, `CatalogDialogComponent`, `AddUrlDialogComponent`, `SeoService`.
- Produces: the `/try` route, prerendered, in the sitemap. `TryPageComponent` mirrors `DashboardPageComponent`'s add/edit dialog flow but writes through `DASHBOARD_SOURCE` and never calls the dashboard API.

- [ ] **Step 1: Write the failing spec**

Create `try-page.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect } from 'vitest';
import { TryPageComponent } from './try-page.component';

function render() {
  TestBed.configureTestingModule({
    imports: [TryPageComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  const f = TestBed.createComponent(TryPageComponent);
  f.detectChanges();
  return f;
}

describe('TryPageComponent', () => {
  it('renders a six-cell grid with three locked cells', () => {
    const f = render();
    expect(f.nativeElement.querySelectorAll('tl-cell').length).toBe(6);
    expect(f.nativeElement.querySelectorAll('[data-testid="locked-cell"]').length).toBe(3);
  });

  it('sets its own page title', () => {
    render();
    expect(document.title).toBe('Try TulipLot — no account needed · TulipLot');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/features/dashboard/try-page.component.spec.ts`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Implement the page**

Create `try-page.component.ts`. It reuses the grid and the two dialogs; the add/edit flow mirrors `DashboardPageComponent.openCellEditor` but writes through the injected source:

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { GridComponent } from './grid.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { AddUrlDialogComponent, AddUrlResult } from './add-url-dialog.component';
import { CatalogApp } from '../../core/models/catalog.model';
import { DASHBOARD_SOURCE } from './dashboard-source';
import { openModeFor } from '../../core/services/compatibility.util';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from '../marketing/site-header.component';

type CatalogChoice = CatalogApp | 'ADD_URL' | null | undefined;

@Component({
  selector: 'tl-try-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, SiteHeaderComponent, RouterLink],
  template: `
    <tl-site-header />
    <main class="try">
      <div class="intro">
        <h1>Try TulipLot without an account</h1>
        <p>
          Two cells are yours right now. Add any HTTPS site or pick one from the catalog, and it
          loads live in the grid. Sign up free for five cells, or go Premium for all six with no ad.
        </p>
        <a routerLink="/register" class="tl-btn tl-btn--primary tl-btn--sm">Get all five cells free →</a>
      </div>
      <div class="grid-area">
        <tl-grid (edit)="onEdit($event)" />
      </div>
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-app-bg); }
    .try { flex: 1; display: flex; flex-direction: column; gap: 18px; padding: 28px var(--tl-page-pad) 20px;
      max-width: 1120px; margin: 0 auto; width: 100%; }
    .intro { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .intro h1 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 32px; color: var(--tl-ink); }
    .intro p { margin: 0; font-size: 16px; line-height: 1.55; color: var(--tl-ink-soft); max-width: 620px; }
    .grid-area { flex: 1; min-height: 460px; }
    @media (max-width: 720px) { .intro h1 { font-size: 26px; } }
  `],
})
export class TryPageComponent {
  private readonly dialog = inject(Dialog);
  private readonly source = inject(DASHBOARD_SOURCE);

  constructor() {
    inject(SeoService).set({
      title: 'Try TulipLot — no account needed',
      description:
        'Try the TulipLot browser dashboard right now, no account required: two live cells in a fixed 3×2 grid. Add any HTTPS site and see how it works.',
      path: '/try',
    });
  }

  async onEdit(slot: number): Promise<void> {
    const ref = this.dialog.open<CatalogChoice>(CatalogDialogComponent, { width: '480px' });
    const result = await firstValueFrom(ref.closed);
    if (!result) {
      return;
    }
    if (result === 'ADD_URL') {
      const urlRef = this.dialog.open<AddUrlResult | null | undefined>(AddUrlDialogComponent, { width: '420px' });
      const urlResult = await firstValueFrom(urlRef.closed);
      if (!urlResult) {
        return;
      }
      this.source.setCell({ slot, type: 'APP', url: urlResult.url, title: urlResult.title, openMode: 'FRAME' });
      return;
    }
    this.source.setCell({
      slot,
      type: 'APP',
      url: result.url,
      title: result.name,
      catalogAppId: result.id,
      iconUrl: result.iconUrl,
      openMode: openModeFor(result.compatibility),
    });
  }
}
```

- [ ] **Step 4: Route it and prerender it**

`app.routes.ts` — add before the `login` route (any position above `**` works):

```typescript
  {
    path: 'try',
    providers: [provideAnonymousDashboardSource()],
    loadComponent: () =>
      import('./features/dashboard/try-page.component').then((m) => m.TryPageComponent),
  },
```

with `import { provideAnonymousDashboardSource } from './features/dashboard/anonymous-dashboard.store';`.

`app.routes.server.ts` — add above the `**` entry:

```typescript
  { path: 'try', renderMode: RenderMode.Prerender },
```

`build-content.mjs` — add `'/try'` to the `staticRoutes` array so it enters the sitemap.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/app/features/dashboard/try-page.component.spec.ts` → PASS.
Run: `node scripts/build-content.mjs` → sitemap now 17 urls.
Run: `npm test` → green.
Run: `PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" npm run build` → **18 prerendered routes**; then confirm the page has real content for a crawler: `grep -c "Try TulipLot without an account" dist/frontend/browser/try/index.html` → ≥ 1.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/dashboard/try-page.component.ts frontend/src/app/features/dashboard/try-page.component.spec.ts frontend/src/app/app.routes.ts frontend/src/app/app.routes.server.ts frontend/scripts/build-content.mjs frontend/public/sitemap.xml
git commit -m "feat(frontend): public /try dashboard for signed-out visitors"
```

---

### Task 6: Carry a visitor's cells into their new account

**Files:**
- Create: `frontend/src/app/features/dashboard/try-migration.ts`
- Create: `frontend/src/app/features/dashboard/try-migration.spec.ts`
- Modify: `frontend/src/app/features/dashboard/dashboard-page.component.ts`

**Interfaces:**
- Consumes: `TRY_STORAGE_KEY` (Task 3), `DashboardStore`.
- Produces: `pendingTryCells(): Cell[]` reads and parses the stored cells (`[]` on any failure); `clearTryCells(): void`; `mergeIntoEmptySlots(current: Cell[], pending: Cell[]): Cell[] | null` — a pure function returning the merged cell array, or `null` when there is nothing to do. `DashboardPageComponent` applies it once after its first successful load.

- [ ] **Step 1: Write the failing spec**

Create `try-migration.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mergeIntoEmptySlots, pendingTryCells, clearTryCells } from './try-migration';
import { TRY_STORAGE_KEY } from './anonymous-dashboard.store';
import type { Cell } from '../../core/models/dashboard.model';

const app = (slot: number, title: string): Cell =>
  ({ slot, type: 'APP', url: 'https://example.com', title, openMode: 'FRAME' });
const empty = (slot: number): Cell => ({ slot, type: 'EMPTY', openMode: 'FRAME' });
const ad = (slot: number): Cell => ({ slot, type: 'AD', openMode: 'FRAME' });

describe('try migration', () => {
  beforeEach(() => localStorage.removeItem(TRY_STORAGE_KEY));
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(TRY_STORAGE_KEY); });

  it('places pending cells into the first empty slots', () => {
    const current = [empty(0), app(1, 'Existing'), empty(2), empty(3), empty(4), ad(5)];
    const merged = mergeIntoEmptySlots(current, [app(0, 'Tried A'), app(1, 'Tried B')]);
    expect(merged!.map((c) => c.title)).toEqual(['Tried A', 'Existing', 'Tried B', undefined, undefined, undefined]);
  });

  it('never overwrites an occupied slot or the ad slot', () => {
    const current = [app(0, 'A'), app(1, 'B'), app(2, 'C'), app(3, 'D'), app(4, 'E'), ad(5)];
    expect(mergeIntoEmptySlots(current, [app(0, 'Tried')])).toBeNull();
  });

  it('returns null when there is nothing pending', () => {
    expect(mergeIntoEmptySlots([empty(0), ad(5)], [])).toBeNull();
  });

  it('reads and clears storage, tolerating garbage', () => {
    localStorage.setItem(TRY_STORAGE_KEY, JSON.stringify([app(0, 'Tried')]));
    expect(pendingTryCells().map((c) => c.title)).toEqual(['Tried']);
    clearTryCells();
    expect(pendingTryCells()).toEqual([]);
    localStorage.setItem(TRY_STORAGE_KEY, 'not json');
    expect(pendingTryCells()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/features/dashboard/try-migration.spec.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `try-migration.ts`:

```typescript
import { Cell } from '../../core/models/dashboard.model';
import { TRY_STORAGE_KEY } from './anonymous-dashboard.store';

/** Cells a visitor configured on /try before signing up; [] if none or unreadable. */
export function pendingTryCells(): Cell[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(TRY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Cell[]).filter((c) => c?.type === 'APP') : [];
  } catch {
    return [];
  }
}

export function clearTryCells(): void {
  try {
    localStorage.removeItem(TRY_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Drops pending cells into the account's empty slots, never displacing anything the user
 * already has and never touching the ad slot. Returns null when there is nothing to apply.
 */
export function mergeIntoEmptySlots(current: Cell[], pending: Cell[]): Cell[] | null {
  if (pending.length === 0) return null;
  const merged = current.map((c) => ({ ...c }));
  let applied = 0;
  for (const cell of pending) {
    const target = merged.find((c) => c.type === 'EMPTY');
    if (!target) break;
    Object.assign(target, { ...cell, slot: target.slot });
    applied += 1;
  }
  return applied > 0 ? merged : null;
}
```

- [ ] **Step 4: Apply it on the dashboard**

In `dashboard-page.component.ts`, import the helpers and `effect`, and add a one-shot migration in the constructor (after the existing `afterNextRender`):

```typescript
    let migrated = false;
    effect(() => {
      if (migrated || !this.store.loaded()) {
        return;
      }
      migrated = true;
      const pending = pendingTryCells();
      const merged = mergeIntoEmptySlots(this.store.cells(), pending);
      if (merged) {
        for (const cell of merged) {
          this.store.setCell(cell);
        }
      }
      if (pending.length) {
        clearTryCells();
      }
    });
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/app/features/dashboard/try-migration.spec.ts src/app/features/dashboard/dashboard-page.component.spec.ts` → PASS.
Run: `npm test` → green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/dashboard/try-migration.ts frontend/src/app/features/dashboard/try-migration.spec.ts frontend/src/app/features/dashboard/dashboard-page.component.ts
git commit -m "feat(frontend): carry try-page cells into a new account's empty slots on first load"
```

---

### Post-plan verification (executor final step + post-merge)

1. `npm test` and `DOCKER_API_VERSION=1.44 ./gradlew --no-daemon build` both green.
2. `PATH=… npm run build` → 18 prerendered routes; sitemap 17 URLs including `https://tuliplot.com/try/`.
3. Serve `dist/frontend/browser` locally and check `/try/`: 200, three locked cells visible, the ad cell present (house promo until AdSense is configured — that is correct), and adding a catalog app to slot 0 persists across a reload. Then confirm `/app` still redirects a signed-out visitor to `/login`.
4. Manual sanity on the real app before merge: log in, confirm the dashboard behaves exactly as before (the seam is the risk).
5. After merge → auto-deploy: `curl -s -o /dev/null -w "%{http_code}" https://tuliplot.com/try/` → 200; confirm the page contains the intro copy; confirm `curl https://api.tuliplot.com/api/v1/config/ads` returns `showAd: true` without a session.
6. Record in the SEO roadmap that the AdSense placement blocker is resolved pending the owner's `ads.txt` publisher ID, and open the follow-up to update the nine articles' plan descriptions now that an anonymous tier exists.
