# Dark Theme (Ink Purple) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full dark theme (Ink Purple) across the entire TulipLot frontend — marketing site, auth, and dashboard — with a three-way Auto/Light/Dark preference, flash-free boot, and a toggle in both headers.

**Architecture:** All theming flows through the existing `--tl-*` CSS custom properties in `frontend/src/styles.scss`. First the ~25 hardcoded color stragglers in component styles are tokenized (a byte-identical refactor of the light theme), then a single `html[data-theme='dark']` override block redefines the color tokens with Ink Purple values. A signal-based `ThemeService` resolves the persisted preference (`'auto' | 'light' | 'dark'`, localStorage key `tl-theme`) to `data-theme="light|dark"` on `<html>` — resolving `auto` via `matchMedia('(prefers-color-scheme: dark)')` with a live listener — and a tiny inline script in `index.html` does the same before first paint so the 12 prerendered routes load flash-free. A shared `tl-theme-toggle` icon button (cycle Auto → Light → Dark) lands in the marketing site header and the app topbar.

**Tech Stack:** Angular 22 (standalone, signals, zoneless, inline templates/styles), plain SCSS custom properties, Vitest + jsdom (jsdom has NO `window.matchMedia` — specs stub it), localStorage.

## Global Constraints

- **Branch from `main`** (currently 71ea97f). Do NOT branch from or touch `webstore-launch-kit` (separate open PR). Work on branch `dark-theme`.
- Frontend commands need the bundled Node: `export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"` before any `npx`/`npm` in `frontend/` (system Node 24 is incompatible with Angular 22).
- Baseline: frontend vitest suite is **103 passing** (`cd /c/Users/xamcr/DashDash/frontend && npx vitest run`). After Task 3 it is 111; after Task 4 it is 114. Backend and extension suites are untouched.
- **The light theme must not change visually.** Task 1 is a pure refactor: every extracted token's `:root` value is copied verbatim from the hex it replaces.
- Deliberately NOT tokenized (leave hardcoded): white text on primary-blue buttons (`.tl-btn--primary` in `styles.scss`, `.nav .cta` in `site-header.component.ts`), the Google-logo SVG brand hexes in `login.component.ts` (`#EA4335 #FBBC05 #34A853 #4285F4` family), and HTML entities like `&#8635;` in `cell-toolbar.component.ts` (they are glyphs, not colors).
- `--tl-primary` (#4D96FF), fonts, spacing, and radii are theme-invariant — never redefined in the dark block.
- The five new `--tl-on-*` tokens are theme-invariant by design (dark text on solid pastel) — they must NOT appear in the dark override block.
- localStorage key is exactly `tl-theme`; attribute is exactly `data-theme` on `document.documentElement`; values are exactly `light` / `dark` (never `auto` — auto is a preference, not a resolved theme).
- All new code is SSR/prerender-safe: no `window`/`document`/`localStorage` access at module scope or in constructors; only inside methods guarded by `typeof window === 'undefined'` early returns.
- Selector prefix `tl-`, `ChangeDetectionStrategy.OnPush`, standalone components, inline templates/styles — match the existing codebase style.
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t`

---

### Task 1: Tokenize the hardcoded color stragglers (byte-identical light theme)

**Files:**
- Modify: `frontend/src/styles.scss` (add tokens to `:root`; swap 4 internal hardcodes)
- Modify: 16 component files listed in Step 2 (exact line edits given)

**Interfaces:**
- Consumes: nothing.
- Produces: new tokens `--tl-bg`, `--tl-card-bg`, `--tl-header-bg`, `--tl-error`, `--tl-backdrop`, `--tl-ink-dim`, `--tl-thumb-amber`, `--tl-ad-stripe-a/b`, `--tl-tile-stripe-a/b`, `--tl-on-pink`, `--tl-on-peach`, `--tl-on-sky`, `--tl-on-mint`, `--tl-on-lilac` — Task 2's dark block overrides the themed ones; `--tl-on-*` stay invariant.

- [ ] **Step 1: Add the new tokens to `:root` in `frontend/src/styles.scss`**

Insert directly after the line `  --tl-page-pad: 56px;` (still inside `:root`):

```scss
  --tl-bg: #fff;
  --tl-card-bg: #fff;
  --tl-header-bg: rgba(255, 255, 255, 0.9);
  --tl-error: #c0392b;
  --tl-backdrop: rgba(51, 48, 74, 0.4);
  --tl-ink-dim: #b8b3c9;
  --tl-thumb-amber: #FFEBD1;
  --tl-ad-stripe-a: #F4F2FA;
  --tl-ad-stripe-b: #ECE8F6;
  --tl-tile-stripe-a: #efedf5;
  --tl-tile-stripe-b: #e6e3f0;
  /* dark text on SOLID pastel fills — theme-invariant, never overridden */
  --tl-on-pink: #7a3838;
  --tl-on-peach: #8a5a1f;
  --tl-on-sky: #1f5a8a;
  --tl-on-mint: #2b6b39;
  --tl-on-lilac: #54398a;
```

Then swap the four hardcodes inside `styles.scss` itself:
- Line 53: `body { font-family: var(--tl-font-body); color: var(--tl-ink); background: #fff; }` → `background: var(--tl-bg);`
- Line 100: `.tl-card { background: #fff; …` → `background: var(--tl-card-bg);`
- Line 108: `.tl-form-error { color: #c0392b; …` → `color: var(--tl-error);`
- Line 149: `.cdk-overlay-backdrop.cdk-overlay-dark-backdrop { background: rgba(51, 48, 74, 0.4); }` → `background: var(--tl-backdrop);`

- [ ] **Step 2: Swap the component stragglers**

Each edit replaces only the color value shown; the rest of the line stays untouched. (Line numbers are pre-edit references.)

| File | Line | Old value | New value |
|---|---|---|---|
| `app/app.component.ts` | 23 | `background: #fff` (browser-notice button) | `background: var(--tl-card-bg)` |
| `app/shared/app-topbar.component.ts` | 31 | `background: #fff` | `background: var(--tl-card-bg)` |
| `app/features/marketing/site-header.component.ts` | 25 | `background: rgba(255, 255, 255, 0.9)` | `background: var(--tl-header-bg)` |
| `app/features/marketing/about.component.ts` | 55 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/marketing/contact.component.ts` | 63 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/marketing/blog-detail.component.ts` | 38 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/marketing/blog-list.component.ts` | 41 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/marketing/blog-list.component.ts` | 47 | `.thumb--amber { background: #FFEBD1; }` | `background: var(--tl-thumb-amber);` |
| `app/features/marketing/guide-detail.component.ts` | 37 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/marketing/guides-list.component.ts` | 38 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/marketing/privacy.component.ts` | 118 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/marketing/terms.component.ts` | 83 | `background: #fff` (`:host`) | `background: var(--tl-bg)` |
| `app/features/ads/ad-cell.component.ts` | 39 | `repeating-linear-gradient(45deg, #F4F2FA, #F4F2FA 9px, #ECE8F6 9px, #ECE8F6 18px)` | `repeating-linear-gradient(45deg, var(--tl-ad-stripe-a), var(--tl-ad-stripe-a) 9px, var(--tl-ad-stripe-b) 9px, var(--tl-ad-stripe-b) 18px)` |
| `app/features/marketing/landing.component.ts` | 138 | `repeating-linear-gradient(45deg, #efedf5, #efedf5 8px, #e6e3f0 8px, #e6e3f0 16px)` | `repeating-linear-gradient(45deg, var(--tl-tile-stripe-a), var(--tl-tile-stripe-a) 8px, var(--tl-tile-stripe-b) 8px, var(--tl-tile-stripe-b) 16px)` |
| `app/features/auth/login.component.ts` | 61 | `background: #fff` (Google button) | `background: var(--tl-card-bg)` |
| `app/features/dashboard/add-url-dialog.component.ts` | 33 | `.dialog { background: #fff; …` | `background: var(--tl-card-bg);` |
| `app/features/dashboard/catalog-dialog.component.ts` | 40 | `.dialog { background: #fff; …` | `background: var(--tl-card-bg);` |
| `app/features/dashboard/dashboard-page.component.ts` | 54 | `background: #fff` | `background: var(--tl-card-bg)` |
| `app/features/dashboard/grid.component.ts` | 68 | `background: #fff` (`.cell`) | `background: var(--tl-card-bg)` |
| `app/features/dashboard/grid.component.ts` | 71 | `background: #fff` (`.cell.focused`) | `background: var(--tl-card-bg)` |
| `app/features/dashboard/cell-toolbar.component.ts` | 31 | `color: #b8b3c9` | `color: var(--tl-ink-dim)` |

Solid-pastel carve-out in `app/features/marketing/landing.component.ts` (dark text must stay dark on solid pastel in both themes):
- Lines 133–137: `.tile--pink { … color: var(--tl-pink-ink); }` → `color: var(--tl-on-pink);` — same swap for `.tile--peach`→`--tl-on-peach`, `.tile--sky`→`--tl-on-sky`, `.tile--mint`→`--tl-on-mint`, `.tile--lilac`→`--tl-on-lilac`.
- Lines 155–157: `.num--pink`→`var(--tl-on-pink)`, `.num--peach`→`var(--tl-on-peach)`, `.num--mint`→`var(--tl-on-mint)`.

- [ ] **Step 3: Verify no stragglers remain**

Run from `frontend/`:
```bash
grep -rn --include="*.ts" -E "background:[^;]*#fff|#FFEBD1|#F4F2FA|#ECE8F6|#efedf5|#e6e3f0|#b8b3c9" src/app | grep -v "\.spec\.ts"
```
Expected: no output. Then confirm the allowed hardcodes are untouched: `grep -n "#fff" src/styles.scss src/app/features/marketing/site-header.component.ts` → hits only for `.tl-btn--primary` (styles.scss lines ~66–67) and `.nav .cta` (site-header lines ~31, 33).

- [ ] **Step 4: Run the suite to prove the refactor broke nothing**

Run: `cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" && npx vitest run`
Expected: **103 passed** (same as baseline; this task adds no tests).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/xamcr/DashDash
git add frontend/src/styles.scss frontend/src/app
git commit -m "refactor(frontend): tokenize hardcoded colors behind --tl-* custom properties"
```

---

### Task 2: Dark token block + flash-free boot script

**Files:**
- Modify: `frontend/src/styles.scss` (append dark override block)
- Modify: `frontend/src/index.html` (inline theme script in `<head>`)

**Interfaces:**
- Consumes: every token from Task 1.
- Produces: `html[data-theme='dark']` activates the Ink Purple palette; the inline script sets `data-theme` from localStorage key `tl-theme` + `prefers-color-scheme` before first paint. Task 3's service takes over after bootstrap using the exact same resolution rule.

- [ ] **Step 1: Append the dark override block to `frontend/src/styles.scss`**

Add directly after the `@media (max-width: 720px) { :root { --tl-page-pad: 24px; } }` block:

```scss
/* --- Ink Purple dark theme (design: 2026-07-23 dark-theme plan) --- */
html[data-theme='dark'] {
  color-scheme: dark;
  --tl-ink: #EDEBF7;
  --tl-ink-soft: #A9A4C4;
  --tl-ink-faint: #6F6A8E;
  --tl-ink-label: #8D88AC;
  --tl-ink-dim: #6A6590;
  --tl-prose: #C6C2DC;
  --tl-prose-lead: #D6D2E8;
  --tl-primary-hover: #6FAAFF;
  --tl-primary-tint: rgba(77, 150, 255, 0.16);
  --tl-pink-ink: #FFB1B1;
  --tl-peach-ink: #FFD8A8; --tl-peach-tint: rgba(255, 216, 168, 0.14);
  --tl-sky-ink: #A5D8FF;   --tl-sky-tint: rgba(165, 216, 255, 0.14);
  --tl-mint-ink: #B2F2BB;  --tl-mint-tint: rgba(178, 242, 187, 0.14);
  --tl-lilac-ink: #D0BFFF; --tl-lilac-tint: rgba(208, 191, 255, 0.14);
  --tl-surface: #232040;
  --tl-surface-2: #201D3A;
  --tl-surface-3: #2A2748;
  --tl-app-bg: #1A1830;
  --tl-bg: #16142A;
  --tl-card-bg: #232040;
  --tl-header-bg: rgba(22, 20, 42, 0.9);
  --tl-border: #2E2B4E;
  --tl-border-strong: #423D68;
  --tl-border-cell: #363258;
  --tl-border-dashed: #4A4574;
  --tl-grad: linear-gradient(135deg, #232048, #2A2358);
  --tl-shadow-card: 0 20px 50px rgba(0, 0, 0, 0.45);
  --tl-shadow-btn: 0 8px 20px rgba(77, 150, 255, 0.22);
  --tl-error: #FF8A7A;
  --tl-backdrop: rgba(0, 0, 0, 0.55);
  --tl-thumb-amber: rgba(255, 216, 168, 0.16);
  --tl-ad-stripe-a: #232040;
  --tl-ad-stripe-b: #2A2748;
  --tl-tile-stripe-a: #262246;
  --tl-tile-stripe-b: #2C284E;
}
```

Note what is deliberately absent: `--tl-primary`, the pastel bases (`--tl-pink` etc.), all `--tl-on-*` tokens, fonts, `--tl-page-pad`.

- [ ] **Step 2: Add the boot script to `frontend/src/index.html`**

Insert immediately after `<meta name="viewport" …>` in `<head>`:

```html
  <script>
    (function () {
      var theme = 'light';
      try {
        var p = localStorage.getItem('tl-theme');
        if (p === 'dark' || (p !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          theme = 'dark';
        }
      } catch (e) { /* no storage / no matchMedia -> stay light */ }
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>
```

- [ ] **Step 3: Verify suite + build**

Run: `cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" && npx vitest run && npx ng build`
Expected: **103 passed**; build succeeds with **12 prerendered routes**. Spot-check the script survived prerender: `grep -c "tl-theme" dist/tuliplot-frontend/browser/index.html` → ≥ 1 (also check one static route, e.g. `browser/about/index.html`).

- [ ] **Step 4: Commit**

```bash
cd /c/Users/xamcr/DashDash
git add frontend/src/styles.scss frontend/src/index.html
git commit -m "feat(frontend): Ink Purple dark token block and flash-free theme boot script"
```

---

### Task 3: ThemeService (TDD)

**Files:**
- Create: `frontend/src/app/core/services/theme.service.ts`
- Test: `frontend/src/app/core/services/theme.service.spec.ts`
- Modify: `frontend/src/app/app.config.ts` (app initializer)

**Interfaces:**
- Consumes: localStorage key `tl-theme`; `data-theme` attribute contract from Task 2.
- Produces (Task 4 relies on these exact names):
  - `type ThemePreference = 'auto' | 'light' | 'dark'` (exported)
  - `THEME_STORAGE_KEY = 'tl-theme'` (exported const)
  - `class ThemeService` with: `readonly preference: Signal<ThemePreference>` (read-only view), `init(): void`, `setPreference(p: ThemePreference): void`, `cycle(): void` (auto → light → dark → auto).

- [ ] **Step 1: Write the failing spec**

Create `frontend/src/app/core/services/theme.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ThemeService, THEME_STORAGE_KEY } from './theme.service';

type MediaListener = (ev: { matches: boolean }) => void;

function stubMatchMedia(initialMatches: boolean): { listeners: MediaListener[]; mql: MediaQueryList } {
  const listeners: MediaListener[] = [];
  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: MediaListener) => listeners.push(fn),
    removeEventListener: (_: string, fn: MediaListener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', () => mql);
  return { listeners, mql };
}

describe('ThemeService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function create(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  it('defaults to auto and applies the OS scheme (light) on init', () => {
    stubMatchMedia(false);
    const svc = create();
    svc.init();
    expect(svc.preference()).toBe('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applies dark on init when the OS prefers dark and no preference is stored', () => {
    stubMatchMedia(true);
    const svc = create();
    svc.init();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores a stored explicit preference over the OS scheme', () => {
    stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const svc = create();
    svc.init();
    expect(svc.preference()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setPreference persists and applies immediately', () => {
    stubMatchMedia(false);
    const svc = create();
    svc.init();
    svc.setPreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('follows a live OS scheme change while in auto', () => {
    const { listeners } = stubMatchMedia(false);
    const svc = create();
    svc.init();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    listeners.forEach((fn) => fn({ matches: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores OS scheme changes while an explicit preference is set', () => {
    const { listeners } = stubMatchMedia(false);
    const svc = create();
    svc.init();
    svc.setPreference('light');
    listeners.forEach((fn) => fn({ matches: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('cycles auto -> light -> dark -> auto', () => {
    stubMatchMedia(false);
    const svc = create();
    svc.init();
    svc.cycle();
    expect(svc.preference()).toBe('light');
    svc.cycle();
    expect(svc.preference()).toBe('dark');
    svc.cycle();
    expect(svc.preference()).toBe('auto');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('auto');
  });

  it('treats a corrupt stored value as auto', () => {
    stubMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    const svc = create();
    svc.init();
    expect(svc.preference()).toBe('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" && npx vitest run src/app/core/services/theme.service.spec.ts`
Expected: FAIL — cannot resolve `./theme.service`.

- [ ] **Step 3: Implement the service**

Create `frontend/src/app/core/services/theme.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'auto' | 'light' | 'dark';
export const THEME_STORAGE_KEY = 'tl-theme';

const CYCLE: Record<ThemePreference, ThemePreference> = { auto: 'light', light: 'dark', dark: 'auto' };

/** Owns the three-way theme preference and stamps the resolved theme on <html>.
 *  The inline script in index.html applies the same rule pre-bootstrap. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly pref = signal<ThemePreference>('auto');
  readonly preference = this.pref.asReadonly();
  private media: MediaQueryList | null = null;

  init(): void {
    if (typeof window === 'undefined') return;
    const stored = this.read();
    this.pref.set(stored);
    this.media = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    this.media?.addEventListener('change', (ev) => {
      if (this.pref() === 'auto') this.apply(ev.matches ? 'dark' : 'light');
    });
    this.applyResolved();
  }

  setPreference(p: ThemePreference): void {
    this.pref.set(p);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      /* storage unavailable (private mode) — theme still applies for this page load */
    }
    this.applyResolved();
  }

  cycle(): void {
    this.setPreference(CYCLE[this.pref()]);
  }

  private read(): ThemePreference {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch {
      return 'auto';
    }
  }

  private applyResolved(): void {
    const p = this.pref();
    this.apply(p === 'auto' ? (this.media?.matches ? 'dark' : 'light') : p);
  }

  private apply(theme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }
}
```

- [ ] **Step 4: Wire the app initializer**

In `frontend/src/app/app.config.ts`, add to the imports: `provideAppInitializer` and `inject` from `@angular/core`, and `ThemeService` from `./core/services/theme.service`. Add to the `providers` array (after `provideClientHydration()`):

```ts
    provideAppInitializer(() => inject(ThemeService).init()),
```

- [ ] **Step 5: Run the focused spec, then the full suite**

Run: `npx vitest run src/app/core/services/theme.service.spec.ts` → **8 passed**.
Run: `npx vitest run` → **111 passed** (103 + 8).

- [ ] **Step 6: Commit**

```bash
cd /c/Users/xamcr/DashDash
git add frontend/src/app/core/services/theme.service.ts frontend/src/app/core/services/theme.service.spec.ts frontend/src/app/app.config.ts
git commit -m "feat(frontend): ThemeService with auto/light/dark preference and live OS tracking"
```

---

### Task 4: Theme toggle component in both headers (TDD)

**Files:**
- Create: `frontend/src/app/shared/theme-toggle.component.ts`
- Test: `frontend/src/app/shared/theme-toggle.component.spec.ts`
- Modify: `frontend/src/app/features/marketing/site-header.component.ts` (add toggle to nav)
- Modify: `frontend/src/app/shared/app-topbar.component.ts` (add toggle to bar)

**Interfaces:**
- Consumes: `ThemeService.preference`, `.cycle()` from Task 3 (exact names).
- Produces: `TlThemeToggleComponent`, selector `tl-theme-toggle`, no inputs/outputs, `data-testid="theme-toggle"`.

- [ ] **Step 1: Write the failing spec**

Create `frontend/src/app/shared/theme-toggle.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { TlThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '../core/services/theme.service';

describe('TlThemeToggleComponent', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function render() {
    TestBed.configureTestingModule({ imports: [TlThemeToggleComponent] });
    const fixture = TestBed.createComponent(TlThemeToggleComponent);
    fixture.detectChanges();
    return { fixture, svc: TestBed.inject(ThemeService) };
  }

  it('renders a button labelled with the current preference (auto by default)', () => {
    const { fixture } = render();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="theme-toggle"]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Theme: auto. Activate for light.');
  });

  it('click cycles the preference and updates the label', async () => {
    const { fixture, svc } = render();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="theme-toggle"]');
    btn.click();
    await fixture.whenStable();
    expect(svc.preference()).toBe('light');
    expect(btn.getAttribute('aria-label')).toBe('Theme: light. Activate for dark.');
    btn.click();
    await fixture.whenStable();
    expect(svc.preference()).toBe('dark');
    expect(btn.getAttribute('aria-label')).toBe('Theme: dark. Activate for auto.');
  });

  it('shows one icon per mode', async () => {
    const { fixture } = render();
    const icon = () => fixture.nativeElement.querySelector('[data-testid="theme-toggle"] svg')?.getAttribute('data-icon');
    expect(icon()).toBe('auto');
    fixture.nativeElement.querySelector('[data-testid="theme-toggle"]').click();
    await fixture.whenStable();
    expect(icon()).toBe('light');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/shared/theme-toggle.component.spec.ts`
Expected: FAIL — cannot resolve `./theme-toggle.component`.

- [ ] **Step 3: Implement the component**

Create `frontend/src/app/shared/theme-toggle.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService, ThemePreference } from '../core/services/theme.service';

const NEXT: Record<ThemePreference, ThemePreference> = { auto: 'light', light: 'dark', dark: 'auto' };

@Component({
  selector: 'tl-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" data-testid="theme-toggle"
            [attr.aria-label]="label()" [title]="label()" (click)="theme.cycle()">
      @switch (theme.preference()) {
        @case ('auto') {
          <svg data-icon="auto" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 12.6V2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor"/>
          </svg>
        }
        @case ('light') {
          <svg data-icon="light" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="3.4" fill="currentColor"/>
            <path d="M8 0v2.4M8 13.6V16M0 8h2.4M13.6 8H16M2.3 2.3l1.7 1.7M12 12l1.7 1.7M13.7 2.3 12 4M4 12l-1.7 1.7"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        }
        @case ('dark') {
          <svg data-icon="dark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M13.6 9.8A6.4 6.4 0 0 1 6.2 2.4 6.4 6.4 0 1 0 13.6 9.8Z" fill="currentColor"/>
          </svg>
        }
      }
    </button>
  `,
  styles: [`
    .toggle { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
      border: none; border-radius: 50%; background: var(--tl-surface-3); color: var(--tl-ink-soft);
      cursor: pointer; padding: 0; }
    .toggle:hover { color: var(--tl-primary); }
  `],
})
export class TlThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(
    () => `Theme: ${this.theme.preference()}. Activate for ${NEXT[this.theme.preference()]}.`,
  );
}
```

- [ ] **Step 4: Run the toggle spec**

Run: `npx vitest run src/app/shared/theme-toggle.component.spec.ts` → **3 passed**.

- [ ] **Step 5: Place the toggle in both headers**

In `frontend/src/app/features/marketing/site-header.component.ts`:
- Add import: `import { TlThemeToggleComponent } from '../../shared/theme-toggle.component';`
- Add `TlThemeToggleComponent` to the `imports` array.
- In the template, insert `<tl-theme-toggle />` inside `<nav class="nav">`, directly before `<a routerLink="/login">Log in</a>`.

In `frontend/src/app/shared/app-topbar.component.ts`:
- Add import: `import { TlThemeToggleComponent } from './theme-toggle.component';`
- Add `TlThemeToggleComponent` to the `imports` array.
- Restructure the template so the toggle shows in BOTH modes — replace the current `@if (mode() === 'dashboard') { <div class="right">…</div> } @else { <a …>← Back to dashboard</a> }` with:

```html
      <div class="right">
        @if (mode() === 'dashboard') {
          <span class="plan" [class.plan--premium]="premium()" data-testid="topbar-plan">
            {{ premium() ? 'Premium' : 'Free plan' }}
          </span>
          @if (!premium()) {
            <a routerLink="/app/upgrade" class="tl-btn tl-btn--primary tl-btn--sm">Go Premium</a>
          }
          <tl-theme-toggle />
          <a routerLink="/app/settings" class="gear" aria-label="Settings">⚙</a>
        } @else {
          <tl-theme-toggle />
          <a routerLink="/app" class="tl-back">← Back to dashboard</a>
        }
      </div>
```

(The `.right` styles already exist; `mode() === 'back'` keeps its back-link, now with the toggle beside it.)

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: **114 passed** (111 + toggle 3 + no regressions; if the existing topbar spec asserts exact DOM structure and fails, fix the assertion to accommodate the added `.right` wrapper in back mode — content assertions like the back-link text and testids must keep passing unchanged). Then: `npx ng build` → 12 prerendered routes.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/xamcr/DashDash
git add frontend/src/app/shared/theme-toggle.component.ts frontend/src/app/shared/theme-toggle.component.spec.ts frontend/src/app/shared/app-topbar.component.ts frontend/src/app/features/marketing/site-header.component.ts
git commit -m "feat(frontend): theme toggle in site header and app topbar"
```

---

### Task 5: Full verification sweep

**Files:** none created — verification and (if needed) fixes only.

**Interfaces:** consumes everything above.

- [ ] **Step 1: Full frontend suite + build**

Run: `cd /c/Users/xamcr/DashDash/frontend && export PATH="/c/Users/xamcr/.dashdash-tooling/node-v22.22.3-win-x64:$PATH" && npx vitest run && npx ng build`
Expected: **114 passed**, build green, 12 prerendered routes, boot script present in `dist/tuliplot-frontend/browser/index.html` AND in `dist/tuliplot-frontend/browser/about/index.html`.

- [ ] **Step 2: Static dark-coverage check**

Run from `frontend/`:
```bash
grep -c -- "--tl-" src/styles.scss
grep -rn --include="*.ts" -E "background:[^;]*#f|background: #fff" src/app | grep -v spec | grep -v "btn--primary"
```
Expected: first command returns a large count (tokens present twice — light and dark definitions); second returns no output (no light-only backgrounds left outside the allowed list).

- [ ] **Step 3: Commit anything Step 1–2 forced you to fix; otherwise no commit**

If fixes were needed: `git add -A frontend/src && git commit -m "fix(frontend): dark theme verification fixes"` (with the standard trailers). If everything was already green, this task produces no commit.

---

## Post-merge follow-ups (documented, not tasks)

- Manual visual QA of both themes across landing, guides/blog, auth, dashboard, settings, upgrade — same owner step as the redesign.
- Optional later: sync theme preference to the user profile (deliberately out of scope; localStorage-only was the approved design).
- The AdSense iframe and SafeFrame third-party content keep their own colors by design; the surrounding chrome themes.
