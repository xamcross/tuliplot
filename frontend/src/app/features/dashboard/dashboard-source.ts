import { InjectionToken, Provider, Signal, computed, inject } from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import { DashboardStore } from '../../stores/dashboard.store';

/**
 * What the grid needs from whatever backs it — the signed-in store on /app, or the
 * localStorage-backed anonymous store on /try. The grid depends on this, not on a
 * concrete store, so the two pages share one grid instead of forking it.
 */
export interface DashboardSource {
  readonly cells: Signal<Cell[]>;
  /** Slots that require an account: rendered as a signup CTA, never editable or draggable. */
  readonly lockedSlots: Signal<number[]>;
  setCell(cell: Cell): void;
  clearCell(slot: number): void;
  swap(a: number, b: number): void;
}

export const DASHBOARD_SOURCE = new InjectionToken<DashboardSource>('DASHBOARD_SOURCE');

/** /app: delegates to the existing server-backed store, which is left untouched. */
export function provideServerDashboardSource(): Provider {
  return {
    provide: DASHBOARD_SOURCE,
    useFactory: (): DashboardSource => {
      const store = inject(DashboardStore);
      return {
        cells: store.cells,
        lockedSlots: computed<number[]>(() => []),
        setCell: (cell: Cell) => store.setCell(cell),
        clearCell: (slot: number) => store.clearCell(slot),
        swap: (a: number, b: number) => store.swap(a, b),
      };
    },
  };
}
