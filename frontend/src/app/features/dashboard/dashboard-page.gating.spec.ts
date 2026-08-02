import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { DashboardPageComponent } from './dashboard-page.component';
import { provideServerDashboardSource } from './dashboard-source';
import { AuthStore } from '../../stores/auth.store';
import { DashboardStore } from '../../stores/dashboard.store';
import { AdsApi } from '../../core/api/ads.api';
import { CatalogApi } from '../../core/api/catalog.api';

function authStoreStub(tier: 'FREE' | 'PREMIUM') {
  return {
    user: signal(null),
    status: signal('authenticated'),
    error: signal(null),
    isAuthenticated: signal(true),
    tier: signal(tier),
    adFree: signal(tier === 'PREMIUM'),
    loadMe: () => {},
    login: () => {},
    register: () => {},
    logout: () => {},
  };
}

function dashboardStoreStub() {
  return {
    cells: signal([]),
    loaded: signal(true),
    saving: signal(false),
    error: signal(null),
    adSlotIndex: signal(5),
    filledCount: signal(0),
    load: () => {},
    swap: () => {},
    setCell: () => {},
    clearCell: () => {},
    persist: () => {},
  };
}

function createPage(tier: 'FREE' | 'PREMIUM') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
      },
      { provide: AuthStore, useValue: authStoreStub(tier) },
      { provide: DashboardStore, useValue: dashboardStoreStub() },
      provideServerDashboardSource(),
      { provide: AdsApi, useValue: { getConfig: vi.fn().mockReturnValue(of({ showAd: false, adClient: '', adSlot: '' })) } },
      { provide: CatalogApi, useValue: { list: vi.fn().mockReturnValue(of([])) } },
    ],
  });
  return TestBed.createComponent(DashboardPageComponent).componentInstance as unknown as {
    isSlotLocked: (slot: number) => boolean;
    onCellEdit: (slot: number) => void;
    openCellEditor: (slot: number) => void;
  };
}

describe('DashboardPageComponent slot-5 edit lock', () => {
  it('locks slot 5 for FREE and short-circuits the add/edit handler', () => {
    const page = createPage('FREE');
    expect(page.isSlotLocked(5)).toBe(true);
    expect(page.isSlotLocked(0)).toBe(false);
    expect(page.isSlotLocked(4)).toBe(false);

    const open = vi.spyOn(page, 'openCellEditor').mockImplementation(() => {});
    page.onCellEdit(5);
    expect(open).not.toHaveBeenCalled(); // guard returns early for the FREE ad slot
    page.onCellEdit(0);
    expect(open).toHaveBeenCalledWith(0);
  });

  it('leaves slot 5 editable for PREMIUM', () => {
    const page = createPage('PREMIUM');
    expect(page.isSlotLocked(5)).toBe(false);

    const open = vi.spyOn(page, 'openCellEditor').mockImplementation(() => {});
    page.onCellEdit(5);
    expect(open).toHaveBeenCalledWith(5); // premium can add/edit the former ad slot
  });
});
