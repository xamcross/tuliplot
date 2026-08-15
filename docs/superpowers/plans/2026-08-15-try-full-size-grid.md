# /try Full-Size Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/try` grid cells render at the same size as the `/app` cells.

**Architecture:** `TryPageComponent` alone changes. Its host becomes a fixed `height: 100vh` flex column (the frame `/app` uses), the intro collapses into one compact strip, and the grid area becomes `flex: 1; min-height: 0` at full width. `GridComponent` keeps `height: 100%`; it now resolves against a definite height. Spec: `docs/superpowers/specs/2026-08-15-try-full-size-grid-design.md`.

**Tech Stack:** Angular 22 standalone component, Vitest + jsdom.

## Global Constraints

- Do not change cell counts or lock behavior: slots 0–1 usable, 2–4 signup-locked, 5 ad.
- Do not change `GridComponent`, `CellComponent`, `AnonymousDashboardStore`, or any backend file.
- On-page copy must state true counts: two cells now, five free on signup.
- The page keeps `tl-site-header`, the `h1` element, and the unchanged `SeoService` call.
- Run Vitest with the system Node from `frontend/`: `npx vitest run <file>`.
- The branch is `feature/try-full-size-grid`.

---

### Task 1: Restyle TryPageComponent to the app-like fixed-height frame

**Files:**
- Modify: `frontend/src/app/features/dashboard/try-page.component.ts`
- Test: `frontend/src/app/features/dashboard/try-page.component.spec.ts`

**Interfaces:**
- Consumes: `GridComponent` (`tl-grid`, sized by its parent), `SiteHeaderComponent` (`tl-site-header`), existing `onEdit(slot)` dialog flow.
- Produces: nothing new — this task changes template and styles only. All existing selectors (`tl-try-page`), inputs, and the `SeoService` call stay as they are.

- [ ] **Step 1: Write the failing structure test**

Append to `frontend/src/app/features/dashboard/try-page.component.spec.ts`, inside the existing `describe('TryPageComponent', …)` block:

```ts
  it('renders the compact intro strip with the h1 and the register CTA', () => {
    const f = render();
    const strip = f.nativeElement.querySelector('[data-testid="try-strip"]') as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.querySelector('h1')?.textContent).toContain('Try TulipLot without an account');
    expect(strip.querySelector('a[href="/register"]')).not.toBeNull();
  });

  it('wraps the grid in a flex grid area below the strip', () => {
    const f = render();
    const area = f.nativeElement.querySelector('[data-testid="try-grid-area"]') as HTMLElement;
    expect(area).not.toBeNull();
    expect(area.querySelector('tl-grid')).not.toBeNull();
  });
```

- [ ] **Step 2: Run the spec to verify the new tests fail**

Run: `cd frontend; npx vitest run src/app/features/dashboard/try-page.component.spec.ts`
Expected: FAIL — both new tests report a null element (`[data-testid="try-strip"]` does not exist yet). The three existing tests stay green.

- [ ] **Step 3: Replace the template and styles**

In `frontend/src/app/features/dashboard/try-page.component.ts`, replace the `template` with:

```ts
  template: `
    <tl-site-header />
    <main class="try">
      <div class="strip" data-testid="try-strip">
        <h1>Try TulipLot without an account</h1>
        <p>Two cells are yours right now — sign up free to keep them and unlock five.</p>
        <a routerLink="/register" class="tl-btn tl-btn--primary tl-btn--sm">Get all five cells free →</a>
      </div>
      <div class="grid-area" data-testid="try-grid-area">
        <tl-grid (edit)="onEdit($event)" />
      </div>
    </main>
  `,
```

Replace the `styles` with:

```ts
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; background: var(--tl-app-bg); }
    .try { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .strip { display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
      gap: 8px 16px; padding: 10px 16px 0; text-align: center; }
    .strip h1 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 20px; color: var(--tl-ink); }
    .strip p { margin: 0; font-size: 14px; line-height: 1.4; color: var(--tl-ink-soft); }
    .grid-area { flex: 1; min-height: 0; padding: 12px; }
  `],
```

Change nothing else in the file. The imports (`GridComponent`, `SiteHeaderComponent`, `RouterLink`), the constructor (`afterNextRender` ping + `SeoService`), and `onEdit` stay byte-identical.

Why the frame works: `GridComponent` sets `height: 100%`, and a percentage height resolves only against a definite parent height. `height: 100vh` on the host (not `min-height`) makes every link of the chain definite: host → `.try` (`flex: 1; min-height: 0`) → `.grid-area` (`flex: 1; min-height: 0`) → grid. This is the same chain `/app`'s `.page`/`.grid-area` builds in `dashboard-page.component.ts`.

- [ ] **Step 4: Run the spec to verify all tests pass**

Run: `cd frontend; npx vitest run src/app/features/dashboard/try-page.component.spec.ts`
Expected: PASS — 5 tests (3 existing + 2 new).

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend; npx vitest run`
Expected: PASS, 48 files. If `try-page` snapshots or other specs assert the old intro markup, fix those assertions to the new structure — the strip and grid area are the source of truth.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/dashboard/try-page.component.ts frontend/src/app/features/dashboard/try-page.component.spec.ts
git commit -m "feat(try): full-size grid — fixed-height frame, compact intro strip"
```

---

## After the plan

Not plan tasks — they need a merge or the owner:

1. Open a PR from `feature/try-full-size-grid`; CI runs the suite and the production build (the prerender of `/try` must stay green).
2. After the merge auto-deploys: live acceptance per the spec — open `/try` and `/app` side by side, confirm equal cell widths, `/try` height equal minus the strip, and one live cell (Wikipedia) rendering at the new size.
