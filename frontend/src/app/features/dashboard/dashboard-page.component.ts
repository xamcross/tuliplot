import { ChangeDetectionStrategy, Component, OnInit, afterNextRender, computed, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { DashboardStore } from '../../stores/dashboard.store';
import { GridComponent } from './grid.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { AddUrlDialogComponent, AddUrlResult } from './add-url-dialog.component';
import { CatalogApp } from '../../core/models/catalog.model';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import { openModeFor } from '../../core/services/compatibility.util';

type CatalogChoice = CatalogApp | 'ADD_URL' | null | undefined;

@Component({
  selector: 'dd-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent],
  template: `
    <main class="page">
      <dd-grid (edit)="onEdit($event)" />
      @if (store.parkedApp(); as parked) {
        <div class="parked-prompt" data-testid="parked-prompt" role="dialog" aria-label="Placed app removed">
          <p>
            Your plan changed and “{{ parked.title || parked.url }}” no longer fits your dashboard.
            Place it in a slot or discard it.
          </p>
          <div class="parked-actions">
            @for (slot of placeableSlots(); track slot) {
              <button type="button" [attr.data-testid]="'park-slot-' + slot" (click)="resolveParkedApp(slot)">
                Slot {{ slot + 1 }}
              </button>
            }
            <button type="button" class="discard" data-testid="park-discard" (click)="resolveParkedApp(null)">
              Discard
            </button>
          </div>
        </div>
      }
    </main>
  `,
  styles: [`
    .page { width: 100vw; height: 100vh; padding: 12px; box-sizing: border-box; }
    .parked-prompt {
      position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 1100;
      max-width: 90vw; background: #fff; border: 1px solid #ddd; border-radius: 8px;
      padding: 12px 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    .parked-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .parked-actions button { padding: 4px 10px; cursor: pointer; }
    .parked-actions .discard { margin-left: auto; }
  `],
})
export class DashboardPageComponent implements OnInit {
  protected store = inject(DashboardStore);
  private dialog = inject(Dialog);
  private readonly extensionBridge = inject(ExtensionBridgeService);

  // The parked app can be placed into any non-AD slot (slot 5 is the FREE ad slot).
  protected readonly placeableSlots = computed(() =>
    this.store.cells().filter((c) => c.type !== 'AD').map((c) => c.slot),
  );

  constructor() {
    afterNextRender(() => {
      void this.extensionBridge.ping();
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  async onEdit(slot: number): Promise<void> {
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
