import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BillingApi } from '../../core/api/billing.api';
import { AppTopbarComponent } from '../../shared/app-topbar.component';

@Component({
  selector: 'tl-upgrade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppTopbarComponent],
  template: `
    <div class="page">
      <tl-app-topbar mode="back" />
      <main class="center">
        <div class="card tl-card tl-card--float">
          <div class="squares" aria-hidden="true">
            <span style="background: var(--tl-pink)"></span><span style="background: var(--tl-peach)"></span><span style="background: var(--tl-sky)"></span>
            <span style="background: var(--tl-mint)"></span><span style="background: var(--tl-lilac)"></span><span style="background: var(--tl-primary)"></span>
          </div>
          <h1>Go Premium</h1>
          <p class="sub">Unlock all six cells and remove ads from your dashboard.</p>
          <div class="perks">
            <div>✓ All 6 cells unlocked</div>
            <div>✓ Zero ads, ever</div>
            <div>✓ No advertising cookies</div>
            <div>✓ Cancel anytime via Stripe</div>
          </div>
          <div class="price">$4<span>/month</span></div>
          <button type="button" class="cta tl-btn tl-btn--primary" (click)="upgrade()" [disabled]="loading()">
            Remove ad — go Premium
          </button>
          <p class="tl-mono-note note">Secure checkout via Stripe</p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: flex; flex-direction: column; background: var(--tl-app-bg); }
    .center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px; }
    .card { width: 100%; max-width: 460px; padding: 40px; text-align: center; }
    .squares { display: inline-grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 22px; }
    .squares span { width: 16px; height: 16px; border-radius: 4px; }
    h1 { margin: 0 0 8px; font-family: var(--tl-font-display); font-weight: 700; font-size: 30px; color: var(--tl-ink); }
    .sub { margin: 0 0 26px; font-size: 16px; line-height: 1.55; color: var(--tl-ink-soft); }
    .perks { text-align: left; background: var(--tl-surface); border: 1px solid var(--tl-border);
      border-radius: 16px; padding: 22px; margin-bottom: 26px; display: flex; flex-direction: column;
      gap: 11px; font-size: 15px; color: var(--tl-prose-lead); }
    .price { font-family: var(--tl-font-display); font-weight: 700; font-size: 40px; color: var(--tl-ink); margin-bottom: 20px; }
    .price span { font-size: 17px; color: var(--tl-ink-faint); }
    .cta { width: 100%; padding: 15px; }
    .note { margin: 16px 0 0; font-size: 12px; }
  `],
})
export class UpgradeComponent {
  private readonly billingApi = inject(BillingApi);
  protected readonly loading = signal(false);

  upgrade(): void {
    this.loading.set(true);
    this.billingApi.createCheckoutSession().subscribe({
      next: (res) => this.redirectTo(res.url),
      error: () => this.loading.set(false),
    });
  }

  protected redirectTo(url: string): void {
    window.location.href = url;
  }
}
