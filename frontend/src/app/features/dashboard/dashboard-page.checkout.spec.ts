import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { DashboardPageComponent } from './dashboard-page.component';
import { AuthStore } from '../../stores/auth.store';
import { DashboardStore } from '../../stores/dashboard.store';

function authStoreStub(loadMe: () => void) {
  return {
    user: signal(null),
    status: signal('authenticated'),
    error: signal(null),
    isAuthenticated: signal(true),
    tier: signal('FREE'),
    adFree: signal(false),
    loadMe,
    login: () => {},
    register: () => {},
    logout: () => {},
  };
}

function dashboardStoreStub(load: () => void) {
  return {
    cells: signal([]),
    loaded: signal(true),
    saving: signal(false),
    error: signal(null),
    adSlotIndex: signal(5),
    filledCount: signal(0),
    load,
    swap: () => {},
    setCell: () => {},
    clearCell: () => {},
    persist: () => {},
  };
}

function setup(checkout: string | null) {
  const loadMe = vi.fn();
  const load = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(checkout ? { checkout } : {}) } },
      },
      { provide: AuthStore, useValue: authStoreStub(loadMe) },
      { provide: DashboardStore, useValue: dashboardStoreStub(load) },
    ],
  });
  const component = TestBed.createComponent(DashboardPageComponent).componentInstance as unknown as {
    handleCheckoutReturn: () => void;
  };
  return { component, loadMe, load };
}

describe('DashboardPageComponent checkout return', () => {
  it('reloads auth then dashboard when checkout=success', () => {
    const { component, loadMe, load } = setup('success');
    component.handleCheckoutReturn();
    expect(loadMe).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not reload when no checkout param is present', () => {
    const { component, loadMe, load } = setup(null);
    component.handleCheckoutReturn();
    expect(loadMe).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });
});
