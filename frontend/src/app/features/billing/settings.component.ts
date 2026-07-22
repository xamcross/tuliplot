import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BillingApi } from '../../core/api/billing.api';
import { AuthStore } from '../../stores/auth.store';

@Component({
  selector: 'dd-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="settings">
      <h1>Account &amp; billing</h1>
      <p>Current plan: {{ tier() }}</p>
      <button type="button" class="manage" (click)="manageBilling()" [disabled]="loading()">
        Manage billing
      </button>
    </section>
  `,
})
export class SettingsComponent {
  private readonly billingApi = inject(BillingApi);
  private readonly authStore = inject(AuthStore);
  protected readonly tier = this.authStore.tier;
  protected readonly loading = signal(false);

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
