import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardStore } from './dashboard.store';
import { DashboardApi } from '../core/api/dashboard.api';
import { Cell } from '../core/models/dashboard.model';

function freeCells(): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < 5; i++) cells.push({ slot: i, type: 'EMPTY', openMode: 'FRAME' });
  cells.push({ slot: 5, type: 'AD', openMode: 'FRAME' });
  return cells;
}

describe('DashboardStore', () => {
  let apiMock: { get: ReturnType<typeof vi.fn>; updateCells: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = {
      get: vi.fn().mockReturnValue(of({ cells: freeCells() })),
      updateCells: vi.fn().mockImplementation((cells: Cell[]) => of({ cells })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApi, useValue: apiMock },
      ],
    });
  });

  it('swap swaps two slots (optimistic)', () => {
    const store = TestBed.inject(DashboardStore);
    const cells = freeCells();
    cells[0] = { slot: 0, type: 'APP', url: 'https://a.com', openMode: 'FRAME' };
    apiMock.get.mockReturnValue(of({ cells }));
    store.load();

    store.swap(0, 1);

    expect(store.cells()[1].type).toBe('APP');
    expect(store.cells()[1].url).toBe('https://a.com');
    expect(store.cells()[1].slot).toBe(1);
    expect(store.cells()[0].type).toBe('EMPTY');
    expect(store.cells()[0].slot).toBe(0);
  });

  it('persist debounces then calls the API once', () => {
    vi.useFakeTimers();
    const store = TestBed.inject(DashboardStore);
    store.load();

    store.persist();
    store.persist();
    store.persist();
    expect(apiMock.updateCells).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(apiMock.updateCells).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('setCell fills a slot and clearCell empties it', () => {
    const store = TestBed.inject(DashboardStore);
    store.load();

    store.setCell({ slot: 2, type: 'APP', url: 'https://x.com', title: 'X', openMode: 'FRAME' });
    expect(store.cells()[2].type).toBe('APP');
    expect(store.cells()[2].url).toBe('https://x.com');
    expect(store.filledCount()).toBe(2); // slot2 APP + slot5 AD

    store.clearCell(2);
    expect(store.cells()[2].type).toBe('EMPTY');
    expect(store.cells()[2].url).toBeUndefined();
  });

  it('exposes adSlotIndex of 5', () => {
    const store = TestBed.inject(DashboardStore);
    expect(store.adSlotIndex()).toBe(5);
  });
});
