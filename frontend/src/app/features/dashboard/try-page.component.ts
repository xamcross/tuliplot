import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { GridComponent } from './grid.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { AddUrlDialogComponent, AddUrlResult } from './add-url-dialog.component';
import { CatalogApp } from '../../core/models/catalog.model';
import { DASHBOARD_SOURCE } from './dashboard-source';
import { openModeFor } from '../../core/services/compatibility.util';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from '../marketing/site-header.component';

type CatalogChoice = CatalogApp | 'ADD_URL' | null | undefined;

@Component({
  selector: 'tl-try-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, SiteHeaderComponent, RouterLink],
  template: `
    <tl-site-header />
    <main class="try">
      <div class="strip" data-testid="try-strip">
        <h1>Try TulipLot without an account</h1>
        <p>Two cells are yours right now — sign up free to keep them and unlock five.</p>
        <a routerLink="/register" class="tl-btn tl-btn--primary tl-btn--sm">Get all five cells free →</a>
      </div>
      <div class="grid-area" data-testid="try-grid-area">
        <tl-grid (edit)="onEdit($event)" />
      </div>
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; background: var(--tl-app-bg); }
    .try { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .strip { display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
      gap: 8px 16px; padding: 10px 16px 0; text-align: center; }
    .strip h1 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 20px; color: var(--tl-ink); }
    .strip p { margin: 0; font-size: 14px; line-height: 1.4; color: var(--tl-ink-soft); }
    .grid-area { flex: 1; min-height: 0; padding: 12px; }
  `],
})
export class TryPageComponent {
  private readonly dialog = inject(Dialog);
  private readonly source = inject(DASHBOARD_SOURCE);
  private readonly extensionBridge = inject(ExtensionBridgeService);

  constructor() {
    // Same handshake as the dashboard page: without it, a visitor with the
    // Companion installed still sees the install prompt on every framed cell.
    afterNextRender(() => {
      void this.extensionBridge.ping();
    });
    inject(SeoService).set({
      title: 'Try TulipLot — no account needed',
      description:
        'Try the TulipLot browser dashboard right now, no account required: two live cells in a fixed 3×2 grid. Add any HTTPS site and see how it works.',
      path: '/try',
    });
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
      this.source.setCell({ slot, type: 'APP', url: urlResult.url, title: urlResult.title, openMode: 'FRAME' });
      return;
    }
    this.source.setCell({
      slot,
      type: 'APP',
      url: result.url,
      title: result.name,
      catalogAppId: result.id,
      iconUrl: result.iconUrl,
      openMode: openModeFor(result.compatibility),
    });
  }
}
