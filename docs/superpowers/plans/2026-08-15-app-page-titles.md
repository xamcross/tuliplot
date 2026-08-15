# App Page Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the three authenticated pages real browser-tab titles instead of the stale "Log in · TulipLot".

**Architecture:** A new `TlTitleStrategy` extends Angular's `TitleStrategy`. When the resolved route declares a `title`, it sets `"<title> · TulipLot"`; when it does not, it leaves the document title alone, so the `SeoService` pages keep owning theirs. The three `/app` routes gain `title` values. Spec: `docs/superpowers/specs/2026-08-15-app-page-titles-design.md`.

**Tech Stack:** Angular 22 standalone, Vitest + jsdom, `RouterTestingHarness`.

## Global Constraints

- The suffix format is exactly `· TulipLot` (space, middle dot, space, name) — the same format `SeoService` uses.
- Route titles: `/app` → `Dashboard`, `/app/settings` → `Settings`, `/app/upgrade` → `Upgrade`.
- Do not change any component, `SeoService`, or any public route.
- Run Vitest with the system Node from `frontend/`: `npx vitest run <file>`.
- The branch is `feature/app-page-titles`.

---

### Task 1: TlTitleStrategy plus route titles

**Files:**
- Create: `frontend/src/app/core/services/title.strategy.ts`
- Create: `frontend/src/app/core/services/title.strategy.spec.ts`
- Create: `frontend/src/app/app.routes.spec.ts`
- Modify: `frontend/src/app/app.routes.ts` (the three `/app` routes)
- Modify: `frontend/src/app/app.config.ts` (one provider line)

**Interfaces:**
- Consumes: Angular's `TitleStrategy` and `RouterStateSnapshot` from `@angular/router`; `Title` from `@angular/platform-browser`; the exported `routes` array from `app.routes.ts`.
- Produces: `TlTitleStrategy` (class, `providedIn: 'root'`, overrides `updateTitle(snapshot: RouterStateSnapshot): void`). Nothing else consumes it directly; the router calls it.

- [ ] **Step 1: Write the failing strategy test**

Create `frontend/src/app/core/services/title.strategy.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { TlTitleStrategy } from './title.strategy';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('TlTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'titled', component: BlankComponent, title: 'Dashboard' },
          { path: 'untitled', component: BlankComponent },
        ]),
        { provide: TitleStrategy, useClass: TlTitleStrategy },
      ],
    });
  });

  it('sets "<route title> · TulipLot" when the route declares a title', async () => {
    await RouterTestingHarness.create('/titled');
    expect(TestBed.inject(Title).getTitle()).toBe('Dashboard · TulipLot');
  });

  it('leaves the current title alone when the route declares none', async () => {
    TestBed.inject(Title).setTitle('Pre-set · TulipLot');
    await RouterTestingHarness.create('/untitled');
    expect(TestBed.inject(Title).getTitle()).toBe('Pre-set · TulipLot');
  });
});
```

- [ ] **Step 2: Write the failing route-table test**

Create `frontend/src/app/app.routes.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { routes } from './app.routes';

describe('app routes', () => {
  it('declares browser-tab titles for the three authenticated pages', () => {
    const titleOf = (path: string) => routes.find((r) => r.path === path)?.title;
    expect(titleOf('app')).toBe('Dashboard');
    expect(titleOf('app/settings')).toBe('Settings');
    expect(titleOf('app/upgrade')).toBe('Upgrade');
  });
});
```

- [ ] **Step 3: Run both specs to verify they fail**

Run: `cd frontend; npx vitest run src/app/core/services/title.strategy.spec.ts src/app/app.routes.spec.ts`
Expected: FAIL — the strategy spec cannot resolve `./title.strategy` (module does not exist); the routes spec gets `undefined` for all three titles.

- [ ] **Step 4: Implement the strategy**

Create `frontend/src/app/core/services/title.strategy.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Sets "<route title> · TulipLot" when the resolved route declares a title.
 * Leaves the document title alone otherwise: the SeoService pages set their
 * own titles, and this strategy must not overwrite them.
 */
@Injectable({ providedIn: 'root' })
export class TlTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    if (routeTitle !== undefined) {
      this.title.setTitle(`${routeTitle} · TulipLot`);
    }
  }
}
```

- [ ] **Step 5: Add the route titles**

In `frontend/src/app/app.routes.ts`, add one `title` line to each of the three `/app` route objects (keep every other property unchanged):

```ts
  {
    path: 'app',
    title: 'Dashboard',
    canActivate: [authGuard],
    providers: [provideServerDashboardSource()],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'app/upgrade',
    title: 'Upgrade',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/billing/upgrade.component').then((m) => m.UpgradeComponent),
  },
  {
    path: 'app/settings',
    title: 'Settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/billing/settings.component').then((m) => m.SettingsComponent),
  },
```

- [ ] **Step 6: Provide the strategy**

In `frontend/src/app/app.config.ts`:

Add to the imports:

```ts
import { TitleStrategy, provideRouter } from '@angular/router';
import { TlTitleStrategy } from './core/services/title.strategy';
```

(The file already imports `provideRouter` from `@angular/router` — extend that import statement rather than adding a duplicate.)

Add one provider line to the `providers` array, directly after `provideRouter(routes),`:

```ts
    { provide: TitleStrategy, useClass: TlTitleStrategy },
```

- [ ] **Step 7: Run both specs to verify they pass**

Run: `cd frontend; npx vitest run src/app/core/services/title.strategy.spec.ts src/app/app.routes.spec.ts`
Expected: PASS — 3 tests (2 strategy + 1 routes).

- [ ] **Step 8: Run the full frontend suite**

Run: `cd frontend; npx vitest run`
Expected: PASS. The public-page specs that assert titles (for example `not-found.component.spec.ts` expecting "Page not found · TulipLot") must stay green — they prove the strategy leaves `SeoService` pages alone.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/core/services/title.strategy.ts frontend/src/app/core/services/title.strategy.spec.ts frontend/src/app/app.routes.spec.ts frontend/src/app/app.routes.ts frontend/src/app/app.config.ts
git commit -m "feat(app): browser-tab titles for /app pages via a route TitleStrategy"
```

---

## After the plan

Not plan tasks — they need a merge or the owner:

1. Open a PR from `feature/app-page-titles`; CI runs the suite and the production build.
2. After the merge auto-deploys: log in on the live site and confirm the tab shows "Dashboard · TulipLot" on `/app`, "Settings · TulipLot" on `/app/settings`, and "Upgrade · TulipLot" on `/app/upgrade`, and that navigating back to the landing page restores its own title.
