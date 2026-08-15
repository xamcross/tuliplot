import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FreemiusCheckoutService } from '../../core/services/freemius-checkout.service';
import { AuthStore } from '../../stores/auth.store';
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
            <div>✓ Cancel anytime</div>
          </div>
          <div class="price">$4<span>/month</span></div>
          @if (state() === 'finalizing') {
            <p class="finalizing" data-testid="finalizing-note">Finishing your upgrade…</p>
          } @else if (state() === 'pending') {
            <p class="finalizing" data-testid="pending-note">
              Payment received. The upgrade activates within a few minutes —
              reload the dashboard to check.
            </p>
          } @else {
            <button type="button" class="cta tl-btn tl-btn--primary" (click)="upgrade()" [disabled]="state() === 'opening'">
              Remove ad — go Premium
            </button>
          }
          <p class="tl-mono-note note">Secure checkout via Freemius</p>
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
    .finalizing { font-size: 15px; color: var(--tl-ink-soft); margin: 0; padding: 15px 0; }
  `],
})
export class UpgradeComponent implements OnDestroy {
  private static readonly POLL_MS = 2000;
  private static readonly MAX_POLLS = 15;

  private readonly checkout = inject(FreemiusCheckoutService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly state = signal<'idle' | 'opening' | 'finalizing' | 'pending'>('idle');
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polls = 0;

  upgrade(): void {
    const email = this.authStore.user()?.email;
    if (!email) {
      return;
    }
    this.state.set('opening');
    this.checkout.open(email, () => this.onPurchased())
      .catch(() => this.state.set('idle'))
      .then(() => { if (this.state() === 'opening') this.state.set('idle'); });
  }

  /** The webhook flips the tier; poll /auth/me until the flip lands. */
  private onPurchased(): void {
    this.state.set('finalizing');
    this.polls = 0;
    this.authStore.loadMe();
    this.pollTimer = setInterval(() => {
      if (this.authStore.tier() === 'PREMIUM') {
        this.stopPolling();
        this.router.navigateByUrl('/app');
        return;
      }
      if (++this.polls >= UpgradeComponent.MAX_POLLS) {
        this.stopPolling();
        this.state.set('pending');
        return;
      }
      this.authStore.loadMe();
    }, UpgradeComponent.POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
