import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../stores/auth.store';
import { LogoComponent } from './logo.component';
import { TlThemeToggleComponent } from './theme-toggle.component';

@Component({
  selector: 'tl-app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LogoComponent, TlThemeToggleComponent],
  template: `
    <div class="bar">
      <tl-logo [compact]="true" [link]="mode() === 'dashboard' ? '/' : '/app'" />
      <div class="right">
        @if (mode() === 'dashboard') {
          <span class="plan" [class.plan--premium]="premium()" data-testid="topbar-plan">
            {{ premium() ? 'Premium' : 'Free plan' }}
          </span>
          @if (!premium()) {
            <a routerLink="/app/upgrade" class="tl-btn tl-btn--primary tl-btn--sm">Go Premium</a>
          }
          <tl-theme-toggle />
          <a routerLink="/app/settings" class="gear" aria-label="Settings">⚙</a>
        } @else {
          <tl-theme-toggle />
          <a routerLink="/app" class="tl-back">← Back to dashboard</a>
        }
      </div>
    </div>
  `,
  styles: [`
    .bar { display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px; background: var(--tl-card-bg); border-bottom: 1px solid var(--tl-border); }
    .right { display: flex; align-items: center; gap: 14px; }
    .plan { font-family: var(--tl-font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--tl-peach-ink);
      background: var(--tl-peach-tint); border-radius: 999px; padding: 5px 12px; }
    .plan--premium { color: var(--tl-mint-ink); background: var(--tl-mint-tint); }
    .gear { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
      border-radius: 50%; background: var(--tl-surface-3); color: var(--tl-ink-soft);
      font-size: 16px; text-decoration: none; }
  `],
})
export class AppTopbarComponent {
  readonly mode = input<'dashboard' | 'back'>('dashboard');
  private readonly authStore = inject(AuthStore);
  protected readonly premium = computed(() => this.authStore.tier() === 'PREMIUM');
}
