import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { GridComponent } from './grid.component';
import { DASHBOARD_SOURCE } from './dashboard-source';
import { AuthStore } from '../../stores/auth.store';
import { AdsApi } from '../../core/api/ads.api';
import { CatalogApi } from '../../core/api/catalog.api';
import type { Cell } from '../../core/models/dashboard.model';

function sixCells(): Cell[] {
  return Array.from({ length: 6 }, (_, slot) => ({
    slot,
    type: slot === 5 ? 'AD' : 'EMPTY',
    openMode: 'FRAME',
  })) as Cell[];
}

function dashboardSourceStub() {
  return {
    cells: signal(sixCells()),
    lockedSlots: signal<number[]>([]),
    setCell: () => {},
    clearCell: () => {},
    swap: () => {},
  };
}

function createGrid(adFree: boolean) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: DASHBOARD_SOURCE, useValue: dashboardSourceStub() },
      { provide: AuthStore, useValue: { adFree: signal(adFree), tier: signal(adFree ? 'PREMIUM' : 'FREE') } },
      { provide: AdsApi, useValue: { getConfig: vi.fn().mockReturnValue(of({ showAd: false, adClient: '', adSlot: '' })) } },
      { provide: CatalogApi, useValue: { list: vi.fn().mockReturnValue(of([])) } },
    ],
  });
  return TestBed.createComponent(GridComponent).componentInstance as unknown as {
    isSlotLocked: (i: number) => boolean;
  };
}

describe('GridComponent slot-5 gating', () => {
  it('locks slot 5 (and only slot 5) for FREE users', () => {
    const grid = createGrid(false);
    expect(grid.isSlotLocked(5)).toBe(true);
    expect(grid.isSlotLocked(0)).toBe(false);
    expect(grid.isSlotLocked(4)).toBe(false);
  });

  it('unlocks slot 5 for PREMIUM users', () => {
    const grid = createGrid(true);
    expect(grid.isSlotLocked(5)).toBe(false);
  });
});
