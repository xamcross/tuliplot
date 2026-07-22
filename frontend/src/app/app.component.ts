import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from './stores/auth.store';
import { BrowserDetectService } from './core/services/browser-detect.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (showBanner()) {
      <div
        class="browser-notice"
        role="status"
        style="display:flex; gap:1rem; align-items:center; justify-content:space-between; padding:.75rem 1rem; background:#fff3cd; color:#664d03; font-family: system-ui, sans-serif;">
        <span>DashDash works best in Chrome or a Chromium-based browser. Some features may be limited here.</span>
        <button type="button" aria-label="Dismiss notice" (click)="dismiss()">Dismiss</button>
      </div>
    }
    <router-outlet />
  `,
})
export class AppComponent {
  private readonly authStore = inject(AuthStore);
  private readonly browser = inject(BrowserDetectService);

  private readonly dismissed = signal(false);
  readonly showBanner = computed(() => !this.browser.isChromium() && !this.dismissed());

  constructor() {
    // Restore the session (if the cookie is present) before guarded navigation.
    this.authStore.loadMe();
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}
