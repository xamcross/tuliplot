import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
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

describe('GridComponent signup-locked slots', () => {
  it('renders a locked cell for each signup-locked slot and leaves the rest usable', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: DASHBOARD_SOURCE,
          useValue: { ...dashboardSourceStub(), lockedSlots: signal<number[]>([2, 3, 4]) },
        },
        { provide: AuthStore, useValue: { adFree: signal(false), tier: signal('FREE') } },
        { provide: AdsApi, useValue: { getConfig: vi.fn().mockReturnValue(of({ showAd: false, adClient: '', adSlot: '' })) } },
        { provide: CatalogApi, useValue: { list: vi.fn().mockReturnValue(of([])) } },
      ],
    });
    const fixture = TestBed.createComponent(GridComponent);
    fixture.detectChanges();

    const locked = fixture.nativeElement.querySelectorAll('[data-testid="locked-cell"]');
    expect(locked.length).toBe(3);
    // slot 0 is usable, so it still offers the add affordance
    expect(fixture.nativeElement.querySelector('[data-testid="add-btn"]')).not.toBeNull();
  });
});
