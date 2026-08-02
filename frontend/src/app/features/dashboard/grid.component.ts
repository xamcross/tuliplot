import { ChangeDetectionStrategy, Component, HostListener, PLATFORM_ID, computed, inject, output, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DASHBOARD_SOURCE } from './dashboard-source';
import { AuthStore } from '../../stores/auth.store';
import { CellComponent } from './cell.component';
import { AdsApi } from '../../core/api/ads.api';
import { AdConfig } from '../../core/models/ads.model';
import { CatalogApi } from '../../core/api/catalog.api';
import { Cell } from '../../core/models/dashboard.model';
import { CatalogApp } from '../../core/models/catalog.model';
import { Compatibility } from '../../core/models/enums';

@Component({
  selector: 'tl-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CellComponent],
  template: `
    <div class="grid" cdkDropListGroup [class.dragging]="dragging()" [class.has-focus]="focusedSlot() !== null">
      @for (cell of store.cells(); track cell.slot; let i = $index) {
        <div
          class="cell"
          [class.focused]="focusedSlot() === cell.slot"
          [class.cell--ad]="cell.type === 'AD'"
          cdkDropList
          [cdkDropListData]="cell.slot"
          [cdkDropListSortingDisabled]="true"
          [cdkDropListDisabled]="cell.type === 'AD' || isSignupLocked(cell.slot)"
          (cdkDropListDropped)="onDropped($event)"
        >
          <div
            class="drag"
            cdkDrag
            [cdkDragData]="cell.slot"
            [cdkDragDisabled]="cell.type !== 'APP' || isSlotLocked(i) || isSignupLocked(cell.slot)"
            (cdkDragStarted)="dragging.set(true)"
            (cdkDragEnded)="dragging.set(false)"
          >
            <tl-cell
              [cell]="cell"
              [dragging]="dragging()"
              [adConfig]="adConfig()"
              [compatibility]="compatOf(cell)"
              [asleep]="asleepSlots().has(cell.slot)"
              [locked]="isSignupLocked(cell.slot)"
              (edit)="edit.emit($event)"
              (remove)="onRemove($event)"
              (sleepToggle)="onSleepToggle($event)"
              (focusToggle)="onFocusToggle($event)"
            />
          </div>
        </div>
      }
      @if (dragging()) {
        <div class="iframe-shield" data-testid="iframe-shield"></div>
      }
    </div>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 10px;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .cell { position: relative; min-height: 0; min-width: 0; overflow: hidden; border: 1px solid var(--tl-border-cell); border-radius: 12px; background: var(--tl-card-bg); display: flex; flex-direction: column; }
    .cell--ad { background: transparent; border: none; }
    .drag { width: 100%; height: 100%; display: flex; flex-direction: column; }
    .cell.focused { position: fixed; inset: 0; z-index: 1000; border-radius: 0; background: var(--tl-card-bg); }
    .iframe-shield { position: absolute; inset: 0; z-index: 50; pointer-events: auto; background: transparent; }
    .grid.dragging iframe { pointer-events: none; }
  `],
})
export class GridComponent {
  protected store = inject(DASHBOARD_SOURCE);
  private readonly authStore = inject(AuthStore);
  private readonly adsApi = inject(AdsApi);
  private readonly catalogApi = inject(CatalogApi);
  private readonly platformId = inject(PLATFORM_ID);
  readonly dragging = signal(false);
  readonly focusedSlot = signal<number | null>(null);
  protected readonly asleepSlots = signal<Set<number>>(new Set());
  protected readonly adConfig = signal<AdConfig | null>(null);
  private readonly catalog = signal<CatalogApp[]>([]);
  private readonly compatByAppId = computed(() => {
    const map = new Map<string, Compatibility>();
    for (const app of this.catalog()) {
      map.set(app.id, app.compatibility);
    }
    return map;
  });
  readonly edit = output<number>();

  constructor() {
    // Ads never render server-side (AdSense needs a browser, and Mediapartners-Google executes JS),
    // so skip the fetch during SSR/prerender entirely — that also removes the build's dependency on
    // a live backend response. A failed request (offline, blocked, backend down) leaves adConfig null
    // and the ad cell degrades to empty instead of throwing.
    // Same reasoning for the catalog: it only feeds the client-side add/edit dialogs and the
    // compatibility badge on already-placed APP cells. No prerendered route seeds an APP cell
    // (/try's defaults are EMPTY + AD only, and localStorage — the only source of a restored APP
    // cell — isn't available during SSR), so no prerendered markup depends on this response. Skip
    // it server-side and degrade to an empty catalog on a browser-side failure instead of throwing.
    if (isPlatformBrowser(this.platformId)) {
      this.adsApi.getConfig().subscribe({
        next: (c) => this.adConfig.set(c),
        error: () => this.adConfig.set(null),
      });
      this.catalogApi.list().subscribe({
        next: (apps) => this.catalog.set(apps),
        error: () => this.catalog.set([]),
      });
    }
  }

  /** Resolve a cell's compatibility from the catalog; null when the cell has no app or the catalog isn't loaded yet. */
  protected compatOf(cell: Cell): Compatibility | null {
    if (!cell.catalogAppId) {
      return null;
    }
    return this.compatByAppId().get(cell.catalogAppId) ?? null;
  }

  /** Slot 5 is the fixed ad slot; it is locked (non-editable, non-draggable) unless the user is ad-free. */
  protected isSlotLocked(index: number): boolean {
    return index === 5 && !this.authStore.adFree();
  }

  /** Slots that need an account (the /try page's 3 locked cells); always [] when signed in. */
  protected isSignupLocked(slot: number): boolean {
    return this.store.lockedSlots().includes(slot);
  }

  onDropped(event: CdkDragDrop<number>): void {
    const from = event.item.data as number;
    const to = event.container.data;
    if (from === to) {
      return;
    }
    this.store.swap(from, to);
  }

  onRemove(slot: number): void {
    this.store.clearCell(slot);
  }

  onSleepToggle(slot: number): void {
    const next = new Set(this.asleepSlots());
    if (next.has(slot)) {
      next.delete(slot);
    } else {
      next.add(slot);
    }
    this.asleepSlots.set(next);
  }

  onFocusToggle(slot: number): void {
    this.focusedSlot.set(this.focusedSlot() === slot ? null : slot);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.focusedSlot.set(null);
  }
}
