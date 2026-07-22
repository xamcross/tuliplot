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
});
