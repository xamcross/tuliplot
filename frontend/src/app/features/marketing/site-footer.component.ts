import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'tl-site-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <footer class="ftr">
      <a routerLink="/" class="brand">TulipLot</a>
      <nav class="links">
        <a routerLink="/about" routerLinkActive="active">About</a>
        <a routerLink="/contact" routerLinkActive="active">Contact</a>
        <a routerLink="/privacy" routerLinkActive="active">Privacy</a>
        <a routerLink="/terms" routerLinkActive="active">Terms</a>
      </nav>
      <span class="copy">© 2026 TulipLot</span>
    </footer>
  `,
  styles: [`
    .ftr { display: flex; align-items: center; justify-content: space-between; gap: 16px;
      flex-wrap: wrap; padding: 36px var(--tl-page-pad); border-top: 1px solid var(--tl-border);
      font-size: 14px; color: var(--tl-ink-soft); }
    .brand { text-decoration: none; font-family: var(--tl-font-display); font-weight: 700;
      font-size: 18px; color: var(--tl-ink); }
    .links { display: flex; gap: 22px; }
    .links a { text-decoration: none; color: var(--tl-ink-soft); }
    .links a:hover, .links a.active { color: var(--tl-primary); }
    .copy { font-family: var(--tl-font-mono); color: var(--tl-ink-faint); }
  `],
})
export class SiteFooterComponent {}
