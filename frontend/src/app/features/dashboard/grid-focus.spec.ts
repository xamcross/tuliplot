import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { GridComponent } from './grid.component';
import { DashboardApi } from '../../core/api/dashboard.api';
import { AdsApi } from '../../core/api/ads.api';

describe('GridComponent focus mode', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApi, useValue: { get: vi.fn().mockReturnValue(of({ cells: [] })), updateCells: vi.fn() } },
        { provide: AdsApi, useValue: { getConfig: vi.fn().mockReturnValue(of({ showAd: false, adClient: '', adSlot: '' })) } },
      ],
    });
  });

  it('toggles focusedSlot and clears it on Escape', () => {
    const c = TestBed.createComponent(GridComponent).componentInstance;

    c.onFocusToggle(2);
    expect(c.focusedSlot()).toBe(2);

    c.onFocusToggle(2);
    expect(c.focusedSlot()).toBeNull();

    c.onFocusToggle(3);
    expect(c.focusedSlot()).toBe(3);
    c.onEscape();
    expect(c.focusedSlot()).toBeNull();
  });
});
