import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { DashboardPageComponent } from './dashboard-page.component';
import { provideServerDashboardSource } from './dashboard-source';
import { DashboardStore } from '../../stores/dashboard.store';
import { DashboardApi } from '../../core/api/dashboard.api';
import { AdsApi } from '../../core/api/ads.api';
import { CatalogApi } from '../../core/api/catalog.api';
import { CatalogApp } from '../../core/models/catalog.model';
import { Cell } from '../../core/models/dashboard.model';

function freeCells(): Cell[] {
  const c: Cell[] = [];
  for (let i = 0; i < 5; i++) c.push({ slot: i, type: 'EMPTY', openMode: 'FRAME' });
  c.push({ slot: 5, type: 'AD', openMode: 'FRAME' });
  return c;
}

describe('DashboardPageComponent', () => {
  let apiMock: { get: ReturnType<typeof vi.fn>; updateCells: ReturnType<typeof vi.fn> };
  let dialogMock: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = {
      get: vi.fn().mockReturnValue(of({ cells: freeCells() })),
      updateCells: vi.fn().mockImplementation((cells: Cell[]) => of({ cells })),
    };
    dialogMock = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideServerDashboardSource(),
        { provide: DashboardApi, useValue: apiMock },
        { provide: AdsApi, useValue: { getConfig: vi.fn().mockReturnValue(of({ showAd: false, adClient: '', adSlot: '' })) } },
        { provide: CatalogApi, useValue: { list: vi.fn().mockReturnValue(of([])) } },
        { provide: Dialog, useValue: dialogMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    });
  });

  it('add-from-catalog fills the clicked slot and persists', async () => {
    vi.useFakeTimers();
    const chosen: CatalogApp = {
      id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', iconUrl: 'i',
      category: 'Email', order: 0, compatibility: 'LOGIN_IN_TAB',
    };
    dialogMock.open.mockReturnValue({ closed: of(chosen) });

    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges(); // ngOnInit → store.load()
    const store = TestBed.inject(DashboardStore);

    await fixture.componentInstance.onEdit(0);

    expect(store.cells()[0].type).toBe('APP');
    expect(store.cells()[0].url).toBe('https://mail.google.com');
    expect(store.cells()[0].catalogAppId).toBe('gmail');

    vi.advanceTimersByTime(500);
    expect(apiMock.updateCells).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancelling the dialog leaves the slot empty', async () => {
    dialogMock.open.mockReturnValue({ closed: of(null) });
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const store = TestBed.inject(DashboardStore);

    await fixture.componentInstance.onEdit(0);

    expect(store.cells()[0].type).toBe('EMPTY');
  });

  it('resolveParkedApp places the parked app into the chosen slot and clears the prompt', () => {
    apiMock.get.mockReturnValue(
      of({
        cells: freeCells(),
        parkedApp: { slot: 5, type: 'APP', url: 'https://parked.com', title: 'Parked', openMode: 'FRAME' } as Cell,
      }),
    );
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges(); // ngOnInit → store.load()
    const store = TestBed.inject(DashboardStore);
    expect(store.parkedApp()).not.toBeNull();

    fixture.componentInstance.resolveParkedApp(2);

    expect(store.cells()[2].type).toBe('APP');
    expect(store.cells()[2].url).toBe('https://parked.com');
    expect(store.parkedApp()).toBeNull();
  });
});
