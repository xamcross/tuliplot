import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { GridComponent } from './grid.component';
import { DashboardStore } from '../../stores/dashboard.store';
import { DashboardApi } from '../../core/api/dashboard.api';
import { AdsApi } from '../../core/api/ads.api';
import { Cell } from '../../core/models/dashboard.model';

function freeCells(): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < 5; i++) cells.push({ slot: i, type: 'EMPTY', openMode: 'FRAME' });
  cells.push({ slot: 5, type: 'AD', openMode: 'FRAME' });
  return cells;
}

describe('GridComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: DashboardApi,
          useValue: {
            get: vi.fn().mockReturnValue(of({ cells: freeCells() })),
            updateCells: vi.fn().mockImplementation((c: Cell[]) => of({ cells: c })),
          },
        },
        {
          provide: AdsApi,
          useValue: { getConfig: vi.fn().mockReturnValue(of({ showAd: false, adClient: '', adSlot: '' })) },
        },
      ],
    });
  });

  it('drop event swaps store cells', () => {
    const fixture = TestBed.createComponent(GridComponent);
    const store = TestBed.inject(DashboardStore);
    const swapSpy = vi.spyOn(store, 'swap').mockImplementation(() => {});

    fixture.componentInstance.onDropped({ item: { data: 0 }, container: { data: 3 } } as any);

    expect(swapSpy).toHaveBeenCalledWith(0, 3);
  });

  it('drop onto the same slot does nothing', () => {
    const fixture = TestBed.createComponent(GridComponent);
    const store = TestBed.inject(DashboardStore);
    const swapSpy = vi.spyOn(store, 'swap').mockImplementation(() => {});

    fixture.componentInstance.onDropped({ item: { data: 2 }, container: { data: 2 } } as any);

    expect(swapSpy).not.toHaveBeenCalled();
  });

  it('dragging toggles the iframe shield', () => {
    const fixture = TestBed.createComponent(GridComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="iframe-shield"]')).toBeNull();

    fixture.componentInstance.dragging.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="iframe-shield"]')).not.toBeNull();
  });
});
