import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, debounceTime, pipe, switchMap, tap } from 'rxjs';
import { DashboardApi } from '../core/api/dashboard.api';
import { Cell, Dashboard } from '../core/models/dashboard.model';

interface DashboardState {
  cells: Cell[];
  parkedApp: Cell | null;
  loaded: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  cells: [],
  parkedApp: null,
  loaded: false,
  saving: false,
  error: null,
};

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    adSlotIndex: computed(() => 5),
    filledCount: computed(() => state.cells().filter((c) => c.type !== 'EMPTY').length),
  })),
  withMethods((store, api = inject(DashboardApi)) => {
    const persist = rxMethod<void>(
      pipe(
        debounceTime(500),
        tap(() => patchState(store, { saving: true, error: null })),
        switchMap(() =>
          api.updateCells(store.cells()).pipe(
            tap((dash: Dashboard) => patchState(store, { cells: dash.cells, saving: false })),
            catchError((err) => {
              patchState(store, { saving: false, error: String(err?.message ?? err) });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const load = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { cells: [], parkedApp: null, loaded: false, error: null })),
        switchMap(() =>
          api.get().pipe(
            tap((dash: Dashboard) =>
              patchState(store, { cells: dash.cells, parkedApp: dash.parkedApp ?? null, loaded: true }),
            ),
            catchError((err) => {
              patchState(store, { error: String(err?.message ?? err), loaded: true });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    return {
      load,
      persist,
      swap(a: number, b: number): void {
        const cells = [...store.cells()];
        const contentA = cells[a];
        const contentB = cells[b];
        cells[a] = { ...contentB, slot: a };
        cells[b] = { ...contentA, slot: b };
        patchState(store, { cells });
        persist();
      },
      setCell(cell: Cell): void {
        const cells = store.cells().map((c) => (c.slot === cell.slot ? { ...cell } : c));
        patchState(store, { cells });
        persist();
      },
      clearCell(slot: number): void {
        const cells = store.cells().map((c) =>
          c.slot === slot ? ({ slot, type: 'EMPTY', openMode: 'FRAME' } as Cell) : c,
        );
        patchState(store, { cells });
        persist();
      },
      resolveParked(slot: number | null): void {
        const parked = store.parkedApp();
        if (!parked) {
          return;
        }
        if (slot !== null) {
          // Place the parked app into the chosen slot, replacing whatever is there.
          const cells = store.cells().map((c) => (c.slot === slot ? ({ ...parked, slot } as Cell) : c));
          patchState(store, { cells, parkedApp: null });
        } else {
          // Discard the parked app.
          patchState(store, { parkedApp: null });
        }
        persist();
      },
    };
  }),
);
