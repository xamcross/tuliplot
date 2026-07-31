import {
  ChangeDetectionStrategy, Component, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import type { Compatibility } from '../../core/models/enums';
import { AdConfig } from '../../core/models/ads.model';
import { CellToolbarComponent } from './cell-toolbar.component';
import { SafeFrameComponent } from './safe-frame.component';
import { AdCellComponent } from '../ads/ad-cell.component';
import { ExtensionBridgeService, EXTENSION_WEBSTORE_URL } from '../../core/services/extension-bridge.service';

@Component({
  selector: 'tl-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellToolbarComponent, SafeFrameComponent, AdCellComponent],
  template: `
    @switch (cell().type) {
      @case ('EMPTY') {
        <button type="button" class="add-btn" data-testid="add-btn" (click)="edit.emit(cell().slot)">
          <span class="plus">+</span> Add app
        </button>
      }
      @case ('AD') {
        @if (!!adConfig()?.showAd) {
          <tl-ad-cell [config]="adConfig()!" />
        }
      }
      @case ('APP') {
        <tl-cell-toolbar
          [title]="cell().title ?? ''"
          [asleep]="asleep()"
          [accent]="accent()"
          [framed]="frameState() === 'frame'"
          (reload)="onReload()"
          (popOut)="popOut.emit(cell().slot)"
          (openInTab)="openInWindow()"
          (focusToggle)="focusToggle.emit(cell().slot)"
          (edit)="edit.emit(cell().slot)"
          (sleep)="sleepToggle.emit(cell().slot)"
          (remove)="remove.emit(cell().slot)"
        />
        @switch (frameState()) {
          @case ('frame') {
            <tl-safe-frame
              [url]="cell().url!"
              [title]="cell().title ?? ''"
              [asleep]="asleep()"
              (loadFailed)="onFrameLoadFailed()"
            />
          }
          @case ('needs-extension') {
            <div class="cell-fallback state" data-testid="needs-extension" data-state="needs-extension">
              <p>This app needs the TulipLot Companion extension to load in the grid.</p>
              <button type="button" class="tl-btn tl-btn--primary tl-btn--sm" (click)="onInstallExtension()">Install TulipLot Companion</button>
              <button type="button" class="tl-btn tl-btn--soft tl-btn--sm" (click)="onEnableForThisApp()">Enable for this site</button>
              <button type="button" class="tl-btn tl-btn--soft tl-btn--sm" (click)="openInWindow()">Open in a tab instead</button>
            </div>
          }
          @case ('login-in-tab') {
            <div class="cell-fallback state" data-testid="login-in-tab" data-state="login-in-tab">
              <p>{{ cell().title }} opens in its own browser tab.</p>
              <button type="button" class="tl-btn tl-btn--primary tl-btn--sm" (click)="openInWindow()">Open in a tab</button>
            </div>
          }
          @case ('load-failed') {
            <div class="cell-fallback state" data-testid="load-failed" data-state="load-failed">
              <p>{{ cell().title }} didn't load in the grid.</p>
              <button type="button" class="tl-btn tl-btn--primary tl-btn--sm" (click)="retry()">Retry</button>
              <button type="button" class="tl-btn tl-btn--soft tl-btn--sm" (click)="openInWindow()">Open in a tab</button>
            </div>
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; width: 100%; height: 100%; }
    tl-safe-frame, .cell-fallback { flex: 1 1 0; min-height: 0; }
    .add-btn { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 8px; border: 1.5px dashed var(--tl-border-dashed); border-radius: 12px;
      background: transparent; cursor: pointer; font-family: var(--tl-font-body); font-size: 14px;
      font-weight: 600; color: var(--tl-ink-soft); }
    .add-btn:hover { background: var(--tl-surface); }
    .add-btn .plus { width: 34px; height: 34px; border-radius: 999px; background: var(--tl-surface-3);
      display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--tl-ink); }
    .state, .cell-fallback { width: 100%; height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px; padding: 16px; text-align: center; }
    .cell-fallback p { margin: 0; font-family: var(--tl-font-display); font-weight: 600; font-size: 15px;
      color: var(--tl-ink-soft); max-width: 230px; line-height: 1.4; }
  `],
})
export class CellComponent {
  private static readonly ACCENTS = ['var(--tl-pink)', 'var(--tl-sky)', 'var(--tl-mint)', 'var(--tl-peach)', 'var(--tl-lilac)'];

  cell = input.required<Cell>();
  dragging = input<boolean>(false);
  asleep = input<boolean>(false);
  readonly compatibility = input<Compatibility | null>(null);
  readonly adConfig = input<AdConfig | null>(null);

  protected readonly accent = computed(() => CellComponent.ACCENTS[this.cell().slot % CellComponent.ACCENTS.length]);

  edit = output<number>();
  remove = output<number>();
  sleepToggle = output<number>();
  popOut = output<number>();
  focusToggle = output<number>();

  private safeFrame = viewChild(SafeFrameComponent);
  private readonly bridge = inject(ExtensionBridgeService);
  private readonly loadFailedFlag = signal(false);

  readonly frameState = computed<'frame' | 'needs-extension' | 'login-in-tab' | 'load-failed'>(() => {
    const cell = this.cell();
    if (cell.type !== 'APP') {
      return 'frame';
    }
    if (this.loadFailedFlag()) {
      return 'load-failed';
    }
    const compat = this.compatibility();
    if (compat === 'NEEDS_EXTENSION' && !this.bridge.installed()) {
      return 'needs-extension';
    }
    if (compat === 'LOGIN_IN_TAB' || cell.openMode === 'WINDOW') {
      return 'login-in-tab';
    }
    return 'frame';
  });

  onReload(): void {
    this.safeFrame()?.reload();
  }

  /** Called from SafeFrameComponent (loadFailed) output. */
  onFrameLoadFailed(): void {
    this.loadFailedFlag.set(true);
  }

  /** Re-attempt framing after a load failure. */
  retry(): void {
    this.loadFailedFlag.set(false);
  }

  /** Fallback: open the app in a real browser tab. */
  openInWindow(): void {
    const url = this.cell().url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /** needs-extension CTA: open the Chrome Web Store listing. */
  onInstallExtension(): void {
    window.open(EXTENSION_WEBSTORE_URL, '_blank', 'noopener,noreferrer');
  }

  /** needs-extension CTA: grant this app's origin to the extension, then retry. */
  async onEnableForThisApp(): Promise<void> {
    const url = this.cell().url;
    if (!url) {
      return;
    }
    const origin = new URL(url).origin;
    const granted = await this.bridge.requestHost(origin);
    if (granted) {
      this.loadFailedFlag.set(false);
    }
  }
}
