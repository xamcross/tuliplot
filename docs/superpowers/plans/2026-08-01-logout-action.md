# Logout Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Log out" button in the settings page's Account card that calls the existing `AuthStore.logout()` and navigates to the landing page.

**Architecture:** Fire-and-navigate: the click handler invokes the root-scoped store's `logout` rxMethod (which POSTs `/auth/logout` and clears the user to `anonymous` in both success and error paths) and immediately navigates to `/`. The logout HTTP request completes in the background after the settings component is destroyed. No backend, store, API, topbar, or site-header changes — the entire pipeline already exists; only the button and navigation are missing.

**Tech Stack:** Angular 20 standalone components (signals, `inject()`), Vitest + Angular TestBed (zoneless).

**Spec:** `docs/superpowers/specs/2026-08-01-logout-action-design.md`

## Global Constraints

- Frontend only — the only files that change are `frontend/src/app/features/billing/settings.component.ts` and its spec.
- All test commands run from `C:\Users\xamcr\DashDash\frontend` (`cd frontend` from the repo root first).
- Full suite: `npm test` (this is `vitest run`). Single file: `npx vitest run <path>`.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t`

---

### Task 1: Logout button in the settings Account card

**Files:**
- Modify: `frontend/src/app/features/billing/settings.component.ts`
- Test: `frontend/src/app/features/billing/settings.component.spec.ts`

**Interfaces:**
- Consumes: `AuthStore.logout` — existing rxMethod, callable as `this.authStore.logout()` with no arguments; `Router.navigateByUrl(url: string)`.
- Produces: `[data-testid="logout-btn"]` button in the Account card; `onLogout(): void` on `SettingsComponent`. Nothing downstream depends on this task.

- [ ] **Step 1: Write the failing test**

In `settings.component.spec.ts`, make three edits.

1. Extend the imports (line 2 currently imports only `signal`; the Router import is new):

```typescript
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
```

2. In the `beforeEach` providers, add zoneless change detection (the repo's standard for component specs that render DOM) and a `logout` spy to the AuthStore mock, so the block reads:

```typescript
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            tier: signal('FREE'),
            user: signal({ displayName: 'Jane Doe', email: 'jane@example.com' }),
            logout: vi.fn(),
          },
        },
      ],
```

3. Append this test inside the `describe('SettingsComponent', ...)` block:

```typescript
  it('logout button calls AuthStore.logout and navigates to the landing page', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement.querySelector('[data-testid="logout-btn"]') as HTMLButtonElement).click();

    expect(TestBed.inject(AuthStore).logout).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/');
  });
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run src/app/features/billing/settings.component.spec.ts`
Expected: the new test FAILS — `querySelector('[data-testid="logout-btn"]')` returns null, so `.click()` throws. The pre-existing portal-redirect test still passes. (If `fixture.detectChanges()` itself errors on a child component, report BLOCKED with the output instead of working around it — `app-topbar.spec.ts` renders the same topbar in TestBed, so rendering is expected to work.)

- [ ] **Step 3: Implement the button and handler**

In `settings.component.ts`:

1. Change the `@angular/router` import to include `Router`:

```typescript
import { Router, RouterLink } from '@angular/router';
```

2. In the template, append the button inside the `.account` row, after the name/email `<div>`:

```html
          <div class="account">
            <div class="avatar">{{ initial() }}</div>
            <div>
              <div class="name">{{ user()?.displayName }}</div>
              <div class="email">{{ user()?.email }}</div>
            </div>
            <button type="button" class="logout tl-btn tl-btn--soft tl-btn--sm"
              data-testid="logout-btn" (click)="onLogout()">Log out</button>
          </div>
```

3. In the styles array, extend the `.account` rule's sibling styles with one new rule (place it right after the existing `.account { ... }` line):

```css
    .logout { margin-left: auto; }
```

4. In the class, inject the router next to the existing injects and add the handler after `manageBilling()`:

```typescript
  private readonly router = inject(Router);
```

```typescript
  onLogout(): void {
    this.authStore.logout();
    void this.router.navigateByUrl('/');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/features/billing/settings.component.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS across the board (124 tests expected: 123 existing + 1 new). If anything unrelated fails, stop and report — do not fix tests outside this feature's files.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/billing/settings.component.ts frontend/src/app/features/billing/settings.component.spec.ts
git commit -m "feat(frontend): log out button in settings Account card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```
