import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService, ThemePreference } from '../core/services/theme.service';

const NEXT: Record<ThemePreference, ThemePreference> = { auto: 'light', light: 'dark', dark: 'auto' };

@Component({
  selector: 'tl-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" data-testid="theme-toggle"
            [attr.aria-label]="label()" [title]="label()" (click)="theme.cycle()">
      @switch (theme.preference()) {
        @case ('auto') {
          <svg data-icon="auto" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 12.6V2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor"/>
          </svg>
        }
        @case ('light') {
          <svg data-icon="light" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="3.4" fill="currentColor"/>
            <path d="M8 0v2.4M8 13.6V16M0 8h2.4M13.6 8H16M2.3 2.3l1.7 1.7M12 12l1.7 1.7M13.7 2.3 12 4M4 12l-1.7 1.7"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        }
        @case ('dark') {
          <svg data-icon="dark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M13.6 9.8A6.4 6.4 0 0 1 6.2 2.4 6.4 6.4 0 1 0 13.6 9.8Z" fill="currentColor"/>
          </svg>
        }
      }
    </button>
  `,
  styles: [`
    .toggle { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
      border: none; border-radius: 50%; background: var(--tl-surface-3); color: var(--tl-ink-soft);
      cursor: pointer; padding: 0; }
    .toggle:hover { color: var(--tl-primary); }
  `],
})
export class TlThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(
    () => `Theme: ${this.theme.preference()}. Activate for ${NEXT[this.theme.preference()]}.`,
  );
}
