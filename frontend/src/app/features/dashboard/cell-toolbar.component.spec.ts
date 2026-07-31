import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { CellToolbarComponent } from './cell-toolbar.component';

describe('CellToolbarComponent', () => {
  it('emits reload/edit/remove/sleep on click', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(CellToolbarComponent);
    f.detectChanges();

    const reload = vi.fn();
    const edit = vi.fn();
    const remove = vi.fn();
    const sleep = vi.fn();
    f.componentInstance.reload.subscribe(reload);
    f.componentInstance.edit.subscribe(edit);
    f.componentInstance.remove.subscribe(remove);
    f.componentInstance.sleep.subscribe(sleep);

    (f.nativeElement.querySelector('[data-testid="tb-reload"]') as HTMLButtonElement).click();
    (f.nativeElement.querySelector('[data-testid="tb-edit"]') as HTMLButtonElement).click();
    (f.nativeElement.querySelector('[data-testid="tb-remove"]') as HTMLButtonElement).click();
    (f.nativeElement.querySelector('[data-testid="tb-sleep"]') as HTMLButtonElement).click();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

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
});
