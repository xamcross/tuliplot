# Cell Toolbar in All APP States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every APP cell shows its toolbar (with remove/edit) in all frame states — `frame`, `needs-extension`, `login-in-tab`, `load-failed` — so an app that can't frame can still be removed or replaced; the ad cell stays toolbar-free.

**Architecture:** The `<tl-cell-toolbar>` moves out of the `@case ('frame')` branch in `CellComponent` so it renders for every APP cell above the state-switched content. A new `framed` input on `CellToolbarComponent` hides iframe-only actions (reload, expand, pop out, sleep) when the cell isn't framed. The toolbar's dead open-in-tab button becomes functional by handling it inside `CellComponent` via the existing `openInWindow()`.

**Tech Stack:** Angular 20 standalone components (signals, `input()`/`output()`, `@if`/`@switch` control flow), Vitest + Angular TestBed (zoneless).

**Spec:** `docs/superpowers/specs/2026-08-01-cell-toolbar-all-states-design.md`

## Global Constraints

- Frontend only — no backend changes. `DashboardService.java` invariants (free ⇒ slot 5 is AD, premium ⇒ no AD cell) already cover the server side.
- The AD and EMPTY branches of `CellComponent`'s template must not change: the ad cell never gets a toolbar.
- All test commands run from `C:\Users\xamcr\DashDash\frontend` (`cd frontend` from the repo root first).
- Full suite: `npm test` (this is `vitest run`). Single file: `npx vitest run <path> `.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t`

---

### Task 1: `framed` input on CellToolbarComponent

**Files:**
- Modify: `frontend/src/app/features/dashboard/cell-toolbar.component.ts`
- Test: `frontend/src/app/features/dashboard/cell-toolbar.component.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `framed = input<boolean>(true)` on `CellToolbarComponent`. When `framed` is `false`, the buttons with `data-testid` `tb-reload`, `tb-focus`, `tb-popout`, `tb-sleep` are absent from the DOM; `tb-opentab`, `tb-edit`, `tb-remove` (and the accent dot + title) remain. When `true` (the default), all seven buttons render. Task 2 binds this input.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('CellToolbarComponent', ...)` block in `cell-toolbar.component.spec.ts`:

```typescript
  it('hides frame-only actions when framed=false, keeps open-in-tab/edit/remove', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(CellToolbarComponent);
    f.componentRef.setInput('framed', false);
    f.detectChanges();

    for (const id of ['tb-reload', 'tb-focus', 'tb-popout', 'tb-sleep']) {
      expect(f.nativeElement.querySelector(`[data-testid="${id}"]`), id).toBeNull();
    }
    for (const id of ['tb-opentab', 'tb-edit', 'tb-remove']) {
      expect(f.nativeElement.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
  });

  it('shows all seven actions by default (framed=true)', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(CellToolbarComponent);
    f.detectChanges();

    for (const id of ['tb-reload', 'tb-focus', 'tb-popout', 'tb-opentab', 'tb-edit', 'tb-sleep', 'tb-remove']) {
      expect(f.nativeElement.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
  });
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run src/app/features/dashboard/cell-toolbar.component.spec.ts`
Expected: FAIL — `setInput('framed', ...)` throws because `CellToolbarComponent` has no input named `framed`. The default-case test passes.

- [ ] **Step 3: Implement the `framed` input**

In `cell-toolbar.component.ts`, replace the template's button rows so the four frame-only buttons are wrapped in `@if (framed())` (button order preserved), and add the input:

```typescript
  template: `
    <div class="toolbar" data-testid="cell-toolbar">
      <span class="dot" [style.background]="accent()" aria-hidden="true"></span>
      <span class="title">{{ title() }}</span>
      <span class="spacer"></span>
      @if (framed()) {
        <button type="button" title="Reload" data-testid="tb-reload" (click)="reload.emit()">&#8635;</button>
        <button type="button" title="Expand" data-testid="tb-focus" (click)="focusToggle.emit()">&#8690;</button>
        <button type="button" title="Pop out" data-testid="tb-popout" (click)="popOut.emit()">&#9099;</button>
      }
      <button type="button" title="Open in tab" data-testid="tb-opentab" (click)="openInTab.emit()">&#8599;</button>
      <button type="button" title="Edit" data-testid="tb-edit" (click)="edit.emit()">&#9998;</button>
      @if (framed()) {
        <button type="button" [title]="asleep() ? 'Wake' : 'Sleep'" data-testid="tb-sleep" (click)="sleep.emit()">
          {{ asleep() ? '☾' : '☀' }}
        </button>
      }
      <button type="button" title="Remove" data-testid="tb-remove" (click)="remove.emit()">&#128465;</button>
    </div>
  `,
```

And in the class, next to the other inputs:

```typescript
  framed = input<boolean>(true);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/features/dashboard/cell-toolbar.component.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/dashboard/cell-toolbar.component.ts frontend/src/app/features/dashboard/cell-toolbar.component.spec.ts
git commit -m "feat(frontend): cell toolbar framed input hides iframe-only actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```

---

### Task 2: Toolbar renders for every APP state in CellComponent

**Files:**
- Modify: `frontend/src/app/features/dashboard/cell.component.ts` (template + styles only)
- Test: `frontend/src/app/features/dashboard/cell.states.spec.ts`

**Interfaces:**
- Consumes: `CellToolbarComponent.framed` input from Task 1.
- Produces: for any APP cell, `[data-testid="cell-toolbar"]` is in the DOM regardless of `frameState()`; toolbar `framed` is bound to `frameState() === 'frame'`; the cell's `edit`/`remove` outputs emit the slot number from fallback states exactly as they do from the frame state. Cell host is a flex column; the state content (`tl-safe-frame` or `.cell-fallback`) fills the space below the toolbar.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('CellComponent fallback states', ...)` block in `cell.states.spec.ts` (it already provides `bridge`, `makeCell`, and `create`):

```typescript
  it('renders the toolbar in the needs-extension state', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="needs-extension"]')).not.toBeNull();
  });

  it('renders the toolbar in the login-in-tab state', () => {
    const fixture = create(makeCell({ openMode: 'WINDOW' }), 'LOGIN_IN_TAB');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="login-in-tab"]')).not.toBeNull();
  });

  it('renders the toolbar in the load-failed state', () => {
    const fixture = create(makeCell(), 'FRAMES_CLEAN');
    fixture.detectChanges();
    fixture.componentInstance.onFrameLoadFailed();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="load-failed"]')).not.toBeNull();
  });

  it('hides frame-only toolbar actions in fallback states', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    for (const id of ['tb-reload', 'tb-focus', 'tb-popout', 'tb-sleep']) {
      expect(fixture.nativeElement.querySelector(`[data-testid="${id}"]`), id).toBeNull();
    }
    for (const id of ['tb-opentab', 'tb-edit', 'tb-remove']) {
      expect(fixture.nativeElement.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
  });

  it('emits remove and edit with the slot from a fallback-state toolbar', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell({ slot: 3 }), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    const remove = vi.fn();
    const edit = vi.fn();
    fixture.componentInstance.remove.subscribe(remove);
    fixture.componentInstance.edit.subscribe(edit);
    (fixture.nativeElement.querySelector('[data-testid="tb-remove"]') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="tb-edit"]') as HTMLButtonElement).click();
    expect(remove).toHaveBeenCalledWith(3);
    expect(edit).toHaveBeenCalledWith(3);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/app/features/dashboard/cell.states.spec.ts`
Expected: the 5 new tests FAIL on the `cell-toolbar` / `tb-*` assertions (toolbar only renders in the frame state today); the 8 pre-existing tests still pass.

- [ ] **Step 3: Restructure the CellComponent template and styles**

In `cell.component.ts`, replace the whole `@case ('APP')` branch so the toolbar sits above the state switch. The four fallback/frame inner blocks are copied verbatim from the current code except that the toolbar block is removed from `@case ('frame')`:

```html
      @case ('APP') {
        <tl-cell-toolbar
          [title]="cell().title ?? ''"
          [asleep]="asleep()"
          [accent]="accent()"
          [framed]="frameState() === 'frame'"
          (reload)="onReload()"
          (popOut)="popOut.emit(cell().slot)"
          (openInTab)="openInTab.emit(cell().slot)"
          (focusToggle)="focusToggle.emit(cell().slot)"
          (edit)="edit.emit(cell().slot)"
          (sleep)="sleepToggle.emit(cell().slot)"
          (remove)="remove.emit(cell().slot)"
        />
        @switch (frameState()) {
          @case ('frame') {
            <tl-safe-frame
              [url]="cell().url!"
              [title]="cell().title ?? ''"
              [asleep]="asleep()"
              (loadFailed)="onFrameLoadFailed()"
            />
          }
          @case ('needs-extension') {
            <div class="cell-fallback state" data-testid="needs-extension" data-state="needs-extension">
              <p>This app needs the TulipLot Companion extension to load in the grid.</p>
              <button type="button" class="tl-btn tl-btn--primary tl-btn--sm" (click)="onInstallExtension()">Install TulipLot Companion</button>
              <button type="button" class="tl-btn tl-btn--soft tl-btn--sm" (click)="onEnableForThisApp()">Enable for this site</button>
              <button type="button" class="tl-btn tl-btn--soft tl-btn--sm" (click)="openInWindow()">Open in a tab instead</button>
            </div>
          }
          @case ('login-in-tab') {
            <div class="cell-fallback state" data-testid="login-in-tab" data-state="login-in-tab">
              <p>{{ cell().title }} opens in its own browser tab.</p>
              <button type="button" class="tl-btn tl-btn--primary tl-btn--sm" (click)="openInWindow()">Open in a tab</button>
            </div>
          }
          @case ('load-failed') {
            <div class="cell-fallback state" data-testid="load-failed" data-state="load-failed">
              <p>{{ cell().title }} didn't load in the grid.</p>
              <button type="button" class="tl-btn tl-btn--primary tl-btn--sm" (click)="retry()">Retry</button>
              <button type="button" class="tl-btn tl-btn--soft tl-btn--sm" (click)="openInWindow()">Open in a tab</button>
            </div>
          }
        }
      }
```

In the same file's `styles`, change the `:host` rule and add a flex rule for the state content (the EMPTY `.add-btn` and AD branches are unaffected — each is the sole flex child and already sizes to 100%):

```css
    :host { display: flex; flex-direction: column; width: 100%; height: 100%; }
    tl-safe-frame, .cell-fallback { flex: 1 1 0; min-height: 0; }
```

(The first line replaces the existing `:host { display: block; ... }`; the second is a new rule. `flex-basis: 0` makes the item's `height: 100%` irrelevant for main-axis sizing, so the content exactly fills the space under the toolbar — previously the 100%-height frame was clipped behind the cell's `overflow: hidden`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/features/dashboard/cell.states.spec.ts src/app/features/dashboard/cell.component.spec.ts`
Expected: PASS (13 + 3 tests) — `cell.component.spec.ts` is included because its "renders the toolbar and a safe-frame for APP" test exercises the restructured template.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/dashboard/cell.component.ts frontend/src/app/features/dashboard/cell.states.spec.ts
git commit -m "feat(frontend): cell toolbar renders in all APP states so stuck apps can be removed or replaced

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```

---

### Task 3: Toolbar open-in-tab handled inside the cell

**Files:**
- Modify: `frontend/src/app/features/dashboard/cell.component.ts`
- Test: `frontend/src/app/features/dashboard/cell.states.spec.ts`

**Interfaces:**
- Consumes: `CellComponent.openInWindow(): void` (existing method — opens `cell().url` via `window.open(url, '_blank', 'noopener,noreferrer')`).
- Produces: clicking `tb-opentab` calls `window.open` with the cell URL in any APP state. `CellComponent` no longer declares an `openInTab` output (it was never wired by `GridComponent` — verified: no other reference in `frontend/src`). `popOut` output is deliberately untouched.

- [ ] **Step 1: Write the failing test**

Append inside the `describe('CellComponent fallback states', ...)` block in `cell.states.spec.ts`:

```typescript
  it('toolbar open-in-tab opens the cell url in a new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="tb-opentab"]') as HTMLButtonElement).click();
    expect(openSpy).toHaveBeenCalledWith('https://mail.google.com', '_blank', 'noopener,noreferrer');
  });
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run src/app/features/dashboard/cell.states.spec.ts`
Expected: the new test FAILS (`openSpy` not called — the click currently re-emits the dead `openInTab` output); all others pass.

- [ ] **Step 3: Handle open-in-tab internally**

In `cell.component.ts`:

1. In the template, change the toolbar binding
   `(openInTab)="openInTab.emit(cell().slot)"` → `(openInTab)="openInWindow()"`.
2. Delete the output declaration line `openInTab = output<number>();` from the class.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/features/dashboard/cell.states.spec.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/dashboard/cell.component.ts frontend/src/app/features/dashboard/cell.states.spec.ts
git commit -m "fix(frontend): toolbar open-in-tab actually opens the app (was a dead unwired output)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```

---

### Task 4: AD-cell regression guard + full suite

**Files:**
- Test: `frontend/src/app/features/dashboard/cell.component.ad.spec.ts`

**Interfaces:**
- Consumes: the restructured `CellComponent` template (Tasks 2–3).
- Produces: a pinned assertion that the AD cell renders no toolbar, guarding the free-tier ad slot against future toolbar changes.

- [ ] **Step 1: Add the guard test**

This is a characterization test of behavior that must survive this feature — it should pass immediately. Append inside the `describe('CellComponent AD slot integration', ...)` block in `cell.component.ad.spec.ts` (it already defines `setup()` and `AD_CELL`):

```typescript
  it('never renders a toolbar for the AD cell', async () => {
    await setup();
    const fixture = TestBed.createComponent(CellComponent);
    fixture.componentRef.setInput('cell', AD_CELL);
    fixture.componentRef.setInput('adConfig', { showAd: true, adClient: '', adSlot: '' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="tb-remove"]')).toBeNull();
  });
```

- [ ] **Step 2: Run the full frontend suite**

Run: `npm test`
Expected: PASS across the board (the new guard included). If anything unrelated fails, stop and report — do not "fix" tests outside this feature's files.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/features/dashboard/cell.component.ad.spec.ts
git commit -m "test(frontend): pin that the AD cell never renders a toolbar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018xGUqZse2QXBPHcTCpKf1t"
```
