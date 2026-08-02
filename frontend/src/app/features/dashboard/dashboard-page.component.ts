import { ChangeDetectionStrategy, Component, OnInit, afterNextRender, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { DashboardStore } from '../../stores/dashboard.store';
import { AuthStore } from '../../stores/auth.store';
import { GridComponent } from './grid.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { AddUrlDialogComponent, AddUrlResult } from './add-url-dialog.component';
import { CatalogApp } from '../../core/models/catalog.model';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import { openModeFor } from '../../core/services/compatibility.util';
import { AppTopbarComponent } from '../../shared/app-topbar.component';
import { pendingTryCells, mergeIntoEmptySlots, clearTryCells } from './try-migration';

type CatalogChoice = CatalogApp | 'ADD_URL' | null | undefined;

@Component({
  selector: 'tl-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, AppTopbarComponent],
  template: `
    <div class="page">
      <tl-app-topbar mode="dashboard" />
      <main class="grid-area">
        <tl-grid (edit)="onEdit($event)" />
        @if (store.parkedApp(); as parked) {
          <div class="parked-prompt" data-testid="parked-prompt" role="dialog" aria-label="Placed app removed">
            <p>
              Your plan changed and “{{ parked.title || parked.url }}” no longer fits your dashboard.
              Place it in a slot or discard it.
            </p>
            <div class="parked-actions">
              @for (slot of placeableSlots(); track slot) {
                <button type="button" class="tl-btn tl-btn--soft tl-btn--sm"
                  [attr.data-testid]="'park-slot-' + slot" (click)="resolveParkedApp(slot)">
                  Slot {{ slot + 1 }}
                </button>
              }
              <button type="button" class="discard tl-btn tl-btn--primary tl-btn--sm"
                data-testid="park-discard" (click)="resolveParkedApp(null)">
                Discard
              </button>
            </div>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .page { width: 100vw; height: 100vh; display: flex; flex-direction: column; background: var(--tl-app-bg); }
    .grid-area { flex: 1; min-height: 0; padding: 12px; position: relative; }
    .parked-prompt { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 1100;
      max-width: 90vw; background: var(--tl-card-bg); border: 1px solid var(--tl-border); border-radius: 16px;
      padding: 16px 20px; box-shadow: var(--tl-shadow-card); font-size: 15px; color: var(--tl-ink); }
    .parked-prompt p { margin: 0 0 4px; }
    .parked-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .parked-actions .discard { margin-left: auto; }
  `],
})
export class DashboardPageComponent implements OnInit {
  protected store = inject(DashboardStore);
  private dialog = inject(Dialog);
  private readonly extensionBridge = inject(ExtensionBridgeService);
  private readonly route = inject(ActivatedRoute);
  private readonly authStore = inject(AuthStore);

  // The parked app can be placed into any non-AD slot (slot 5 is the FREE ad slot).
  protected readonly placeableSlots = computed(() =>
    this.store.cells().filter((c) => c.type !== 'AD').map((c) => c.slot),
  );

  constructor() {
    afterNextRender(() => {
      void this.extensionBridge.ping();
    });

    // One-shot: once the store's first load settles (loaded() flips true on success AND on
    // failure), carry any /try cells this visitor configured before signing up into their
    // now-empty account slots. Storage is cleared only when the merge actually applied
    // (mergeIntoEmptySlots returned non-null) — if the load failed (cells stay [], so merge
    // finds no EMPTY slot) or the account is already full, the key is left in place so a later
    // load can retry instead of silently losing the visitor's cells.
    let migrated = false;
    effect(() => {
      if (migrated || !this.store.loaded()) {
        return;
      }
      migrated = true;
      const pending = pendingTryCells();
      const merged = mergeIntoEmptySlots(this.store.cells(), pending);
      if (merged) {
        for (const cell of merged) {
          this.store.setCell(cell);
        }
        clearTryCells();
      }
    });
  }

  ngOnInit(): void {
    this.handleCheckoutReturn();
    this.store.load();
  }

  /** After returning from Stripe Checkout (/app?checkout=success) refresh auth + dashboard so premium reflects. */
  private handleCheckoutReturn(): void {
    if (this.route.snapshot.queryParamMap.get('checkout') === 'success') {
      this.authStore.loadMe();
      this.store.load();
    }
  }

  /**
   * Slot 5 is the fixed ad slot for FREE users; adding or editing an app there is not allowed
   * until the user is Premium. (adFree === (tier === 'PREMIUM'), so this is the same predicate.)
   */
  isSlotLocked(slot: number): boolean {
    return slot === 5 && this.authStore.tier() === 'FREE';
  }

  /**
   * Test/grid-facing guarded add/edit entry; delegates to {@link onEdit} so the FREE ad slot
   * cannot be added to or edited.
   */
  onCellEdit(slot: number): void {
    void this.onEdit(slot);
  }

  async onEdit(slot: number): Promise<void> {
    if (this.isSlotLocked(slot)) {
      return;
    }
    await this.openCellEditor(slot);
  }

  /** Opens the add-URL / catalog dialog for a slot; a seam so tests can assert the slot-5 guard. */
  protected async openCellEditor(slot: number): Promise<void> {
    const ref = this.dialog.open<CatalogChoice>(CatalogDialogComponent, { width: '480px' });
    const result = await firstValueFrom(ref.closed);
    if (!result) {
      return;
    }
    if (result === 'ADD_URL') {
      const urlRef = this.dialog.open<AddUrlResult | null | undefined>(AddUrlDialogComponent, { width: '420px' });
      const urlResult = await firstValueFrom(urlRef.closed);
      if (!urlResult) {
        return;
      }
      this.store.setCell({ slot, type: 'APP', url: urlResult.url, title: urlResult.title, openMode: 'FRAME' });
      return;
    }
    this.store.setCell({
      slot,
      type: 'APP',
      url: result.url,
      title: result.name,
      catalogAppId: result.id,
      iconUrl: result.iconUrl,
      openMode: openModeFor(result.compatibility),
    });
  }

  /** Resolve the downgrade "parked app" prompt: place it into `slot`, or discard it when `slot` is null. */
  resolveParkedApp(slot: number | null): void {
    this.store.resolveParked(slot);
  }
}
