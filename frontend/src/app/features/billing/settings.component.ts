import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingApi } from '../../core/api/billing.api';
import { AuthStore } from '../../stores/auth.store';
import { AppTopbarComponent } from '../../shared/app-topbar.component';

@Component({
  selector: 'tl-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppTopbarComponent, RouterLink],
  template: `
    <div class="page">
      <tl-app-topbar mode="back" />
      <main class="wrap">
        <h1>Account &amp; billing</h1>
        <section class="tl-card sec">
          <div class="sec-label">Account</div>
          <div class="account">
            <div class="avatar">{{ initial() }}</div>
            <div>
              <div class="name">{{ user()?.displayName }}</div>
              <div class="email">{{ user()?.email }}</div>
            </div>
          </div>
        </section>
        <section class="tl-card sec">
          <div class="sec-label">Plan</div>
          <div class="row">
            <div class="plan-name">
              <span class="tier">{{ tier() === 'PREMIUM' ? 'Premium' : 'Free' }}</span>
              <span class="badge" [class.badge--premium]="tier() === 'PREMIUM'">
                {{ tier() === 'PREMIUM' ? '6 cells · no ads' : '5 cells + 1 ad' }}
              </span>
            </div>
            @if (tier() !== 'PREMIUM') {
              <a routerLink="/app/upgrade" class="tl-btn tl-btn--primary tl-btn--sm">Go Premium</a>
            }
          </div>
          <div class="hr"></div>
          <div class="row">
            <p class="hint">Manage payment method, invoices, and cancellation through the Stripe billing portal.</p>
            <button type="button" class="manage tl-btn tl-btn--soft tl-btn--sm"
              (click)="manageBilling()" [disabled]="loading()">Manage billing</button>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: flex; flex-direction: column; background: var(--tl-app-bg); }
    .wrap { flex: 1; width: 100%; max-width: 600px; margin: 0 auto; padding: 48px 24px; }
    h1 { margin: 0 0 24px; font-family: var(--tl-font-display); font-weight: 700; font-size: 32px; color: var(--tl-ink); }
    .sec { padding: 28px; margin-bottom: 18px; }
    .sec-label { font-family: var(--tl-font-mono); font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--tl-ink-faint); margin-bottom: 14px; }
    .account { display: flex; align-items: center; gap: 14px; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--tl-lilac-tint);
      color: var(--tl-lilac-ink); display: flex; align-items: center; justify-content: center;
      font-family: var(--tl-font-display); font-weight: 700; font-size: 18px; }
    .name { font-weight: 600; font-size: 16px; color: var(--tl-ink); }
    .email { font-size: 14px; color: var(--tl-ink-soft); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .plan-name { display: flex; align-items: center; gap: 12px; }
    .tier { font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; color: var(--tl-ink); }
    .badge { font-family: var(--tl-font-mono); font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--tl-peach-ink); background: var(--tl-peach-tint);
      border-radius: 999px; padding: 5px 12px; }
    .badge--premium { color: var(--tl-mint-ink); background: var(--tl-mint-tint); }
    .hr { height: 1px; background: var(--tl-app-bg); margin: 22px 0; }
    .hint { margin: 0; font-size: 15px; color: var(--tl-ink-soft); max-width: 340px; line-height: 1.5; }
  `],
})
export class SettingsComponent {
  private readonly billingApi = inject(BillingApi);
  private readonly authStore = inject(AuthStore);
  protected readonly tier = this.authStore.tier;
  protected readonly loading = signal(false);
  protected readonly user = this.authStore.user;
  protected readonly initial = computed(() =>
    (this.authStore.user()?.displayName || this.authStore.user()?.email || '?').charAt(0).toUpperCase(),
  );

  manageBilling(): void {
    this.loading.set(true);
    this.billingApi.createPortalSession().subscribe({
      next: (res) => this.redirectTo(res.url),
      error: () => this.loading.set(false),
    });
  }

  protected redirectTo(url: string): void {
    window.location.href = url;
  }
}
