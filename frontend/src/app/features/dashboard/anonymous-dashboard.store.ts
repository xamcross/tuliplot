import { Injectable, Provider, computed, signal } from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import { DASHBOARD_SOURCE, DashboardSource } from './dashboard-source';

export const TRY_STORAGE_KEY = 'tl-try-cells';

const USABLE_SLOTS = [0, 1];
const LOCKED_SLOTS = [2, 3, 4];
const AD_SLOT = 5;

function emptyCell(slot: number): Cell {
  return { slot, type: 'EMPTY', openMode: 'FRAME' };
}

function defaultCells(): Cell[] {
  return [0, 1, 2, 3, 4, 5].map((slot) =>
    slot === AD_SLOT ? ({ slot, type: 'AD', openMode: 'FRAME' } as Cell) : emptyCell(slot),
  );
}

/**
 * The /try page's dashboard: six cells where only slots 0-1 are the visitor's, kept in
 * localStorage instead of on the server. Every storage touch is best-effort — a visitor
 * in private mode still gets a working grid, it just doesn't survive a reload.
 */
@Injectable()
export class AnonymousDashboardStore implements DashboardSource {
  private readonly _cells = signal<Cell[]>(defaultCells());
  readonly cells = this._cells.asReadonly();
  readonly lockedSlots = computed<number[]>(() => LOCKED_SLOTS);

  constructor() {
    this.restore();
  }

  setCell(cell: Cell): void {
    if (!USABLE_SLOTS.includes(cell.slot)) return;
    this._cells.set(this._cells().map((c) => (c.slot === cell.slot ? { ...cell } : c)));
    this.persist();
  }

  clearCell(slot: number): void {
    if (!USABLE_SLOTS.includes(slot)) return;
    this._cells.set(this._cells().map((c) => (c.slot === slot ? emptyCell(slot) : c)));
    this.persist();
  }

  swap(a: number, b: number): void {
    if (!USABLE_SLOTS.includes(a) || !USABLE_SLOTS.includes(b) || a === b) return;
    const cells = [...this._cells()];
    const first = cells[a];
    const second = cells[b];
    cells[a] = { ...second, slot: a };
    cells[b] = { ...first, slot: b };
    this._cells.set(cells);
    this.persist();
  }

  /** The apps this visitor actually placed — what Task 6 migrates into a new account. */
  configuredCells(): Cell[] {
    return this._cells().filter((c) => USABLE_SLOTS.includes(c.slot) && c.type === 'APP');
  }

  clearStorage(): void {
    try {
      localStorage.removeItem(TRY_STORAGE_KEY);
    } catch {
      /* storage unavailable; nothing to clear */
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(TRY_STORAGE_KEY, JSON.stringify(this.configuredCells()));
    } catch {
      /* private mode or storage disabled: the grid still works for this session */
    }
  }

  private restore(): void {
    let stored: Cell[] = [];
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(TRY_STORAGE_KEY);
      stored = raw ? (JSON.parse(raw) as Cell[]) : [];
    } catch {
      return; // unreadable or malformed: keep the defaults
    }
    if (!Array.isArray(stored) || stored.length === 0) return;
    const cells = defaultCells();
    for (const cell of stored) {
      if (cell && USABLE_SLOTS.includes(cell.slot) && cell.type === 'APP') {
        cells[cell.slot] = { ...cell };
      }
    }
    this._cells.set(cells);
  }
}

/** /try: the grid is backed by localStorage and slots 2-4 are signup-locked. */
export function provideAnonymousDashboardSource(): Provider[] {
  return [
    AnonymousDashboardStore,
    { provide: DASHBOARD_SOURCE, useExisting: AnonymousDashboardStore },
  ];
}
