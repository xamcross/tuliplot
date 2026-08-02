import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnonymousDashboardStore, TRY_STORAGE_KEY } from './anonymous-dashboard.store';
import type { Cell } from '../../core/models/dashboard.model';

const APP: Cell = { slot: 0, type: 'APP', url: 'https://trello.com', title: 'Trello', openMode: 'FRAME' };

function make(): AnonymousDashboardStore {
  TestBed.configureTestingModule({ providers: [AnonymousDashboardStore] });
  return TestBed.inject(AnonymousDashboardStore);
}

describe('AnonymousDashboardStore', () => {
  beforeEach(() => { localStorage.removeItem(TRY_STORAGE_KEY); TestBed.resetTestingModule(); });
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(TRY_STORAGE_KEY); });

  it('starts with six cells: two empty, three locked-empty, and the ad slot', () => {
    const s = make();
    expect(s.cells().length).toBe(6);
    expect(s.cells()[5].type).toBe('AD');
    expect(s.lockedSlots()).toEqual([2, 3, 4]);
  });

  it('sets and clears a usable cell', () => {
    const s = make();
    s.setCell(APP);
    expect(s.cells()[0].title).toBe('Trello');
    s.clearCell(0);
    expect(s.cells()[0].type).toBe('EMPTY');
  });

  it('ignores writes to locked and ad slots', () => {
    const s = make();
    s.setCell({ ...APP, slot: 3 });
    s.setCell({ ...APP, slot: 5 });
    expect(s.cells()[3].type).toBe('EMPTY');
    expect(s.cells()[5].type).toBe('AD');
  });

  it('swaps only within the usable slots', () => {
    const s = make();
    s.setCell(APP);
    s.swap(0, 1);
    expect(s.cells()[1].title).toBe('Trello');
    expect(s.cells()[0].type).toBe('EMPTY');
    s.swap(1, 4);
    expect(s.cells()[1].title).toBe('Trello');
  });

  it('round-trips through localStorage', () => {
    make().setCell(APP);
    TestBed.resetTestingModule();
    expect(make().cells()[0].title).toBe('Trello');
  });

  it('configuredCells returns only the visitor APP cells', () => {
    const s = make();
    s.setCell(APP);
    expect(s.configuredCells().map((c) => c.slot)).toEqual([0]);
  });

  it('survives localStorage throwing on read and on write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const s = make();
    expect(s.cells().length).toBe(6);
    expect(() => s.setCell(APP)).not.toThrow();
    expect(s.cells()[0].title).toBe('Trello');
  });
});
