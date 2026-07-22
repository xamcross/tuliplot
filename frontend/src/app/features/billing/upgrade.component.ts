import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BillingApi } from '../../core/api/billing.api';

@Component({
  selector: 'dd-upgrade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="upgrade">
      <h1>Go Premium</h1>
      <p>Unlock all six cells and remove ads from your dashboard.</p>
      <button type="button" class="cta" (click)="upgrade()" [disabled]="loading()">
        Remove ad — go Premium
      </button>
    </section>
  `,
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
