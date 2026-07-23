import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from './stores/auth.store';
import { BrowserDetectService } from './core/services/browser-detect.service';
import { ConsentService } from './core/services/consent.service';

@Component({
  selector: 'tl-root',
  imports: [RouterOutlet],
  template: `
    @if (showBanner()) {
      <div class="browser-notice" role="status">
        <span>TulipLot works best in Chrome or a Chromium-based browser. Some features may be limited here.</span>
        <button type="button" aria-label="Dismiss notice" (click)="dismiss()">Dismiss</button>
      </div>
    }
    <router-outlet />
  `,
  styles: [`
    .browser-notice { display: flex; gap: 16px; align-items: center; justify-content: space-between;
      padding: 10px 20px; background: var(--tl-peach-tint); color: var(--tl-peach-ink);
      font-family: var(--tl-font-body); font-size: 14px; }
    .browser-notice button { border: none; background: var(--tl-card-bg); color: var(--tl-peach-ink); font-weight: 600;
      border-radius: 999px; padding: 6px 14px; cursor: pointer; }
  `],
})
export class AppComponent {
  private readonly authStore = inject(AuthStore);
  private readonly browser = inject(BrowserDetectService);

  private readonly dismissed = signal(false);
  readonly showBanner = computed(() => !this.browser.isChromium() && !this.dismissed());

  constructor() {
    // Restore the session (if the cookie is present) before guarded navigation.
    this.authStore.loadMe();
    // Set Consent Mode v2 defaults and defer adsbygoogle until CMP consent
    // (browser-guarded inside the service, so a safe no-op during prerender).
    inject(ConsentService).init();
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}
