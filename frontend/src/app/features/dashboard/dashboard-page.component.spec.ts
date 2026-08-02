import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { TRY_STORAGE_KEY } from './anonymous-dashboard.store';

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

  it('renders zero locked cells for a signed-in account (server source never signup-locks a slot)', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges(); // ngOnInit → store.load()

    expect(fixture.nativeElement.querySelectorAll('[data-testid="locked-cell"]').length).toBe(0);
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

  describe('try-cell migration on first load', () => {
    const triedApp = (slot: number, title: string): Cell =>
      ({ slot, type: 'APP', url: 'https://example.com', title, openMode: 'FRAME' });

    function fullCells(): Cell[] {
      const c: Cell[] = [];
      for (let i = 0; i < 5; i++) c.push(triedApp(i, `Existing ${i}`));
      c.push({ slot: 5, type: 'AD', openMode: 'FRAME' });
      return c;
    }

    afterEach(() => localStorage.removeItem(TRY_STORAGE_KEY));

    it('merges pending /try cells into empty slots and clears storage once the load succeeds', async () => {
      localStorage.setItem(TRY_STORAGE_KEY, JSON.stringify([triedApp(0, 'Tried')]));
      apiMock.get.mockReturnValue(of({ cells: freeCells() }));

      const fixture = TestBed.createComponent(DashboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const store = TestBed.inject(DashboardStore);
      expect(store.cells()[0].type).toBe('APP');
      expect(store.cells()[0].title).toBe('Tried');
      expect(localStorage.getItem(TRY_STORAGE_KEY)).toBeNull();
    });

    // Pins the Task 6 correction: DashboardStore.load's catchError sets loaded:true while
    // cells stays []. mergeIntoEmptySlots([], pending) then finds no EMPTY slot and returns
    // null. The uncorrected brief logic cleared storage anyway (it only checked
    // pending.length), destroying the visitor's cells before they ever reached the account.
    // This test fails against that original logic — see task-6-report.md for the RED proof.
    it('leaves the try-cells key in place when the dashboard load fails, so a later load can retry', async () => {
      localStorage.setItem(TRY_STORAGE_KEY, JSON.stringify([triedApp(0, 'Tried')]));
      apiMock.get.mockReturnValue(throwError(() => new Error('network down')));

      const fixture = TestBed.createComponent(DashboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const store = TestBed.inject(DashboardStore);
      expect(store.loaded()).toBe(true); // loaded flips true even on a failed load
      expect(store.cells()).toEqual([]); // nothing to merge into — the visitor's cells are not lost
      const stored = localStorage.getItem(TRY_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual([triedApp(0, 'Tried')]);
    });

    // Also fails against the uncorrected logic, for the same reason: a full dashboard means
    // mergeIntoEmptySlots returns null, but the original code cleared storage regardless.
    it('leaves the try-cells key in place when the account already has no empty slot', async () => {
      localStorage.setItem(TRY_STORAGE_KEY, JSON.stringify([triedApp(0, 'Tried')]));
      apiMock.get.mockReturnValue(of({ cells: fullCells() }));

      const fixture = TestBed.createComponent(DashboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const store = TestBed.inject(DashboardStore);
      expect(store.cells()[0].title).toBe('Existing 0'); // untouched — nothing displaced
      expect(localStorage.getItem(TRY_STORAGE_KEY)).not.toBeNull();
    });
  });
});
