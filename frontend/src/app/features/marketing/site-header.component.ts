import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoComponent } from '../../shared/logo.component';

@Component({
  selector: 'tl-site-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  template: `
    <header class="hdr">
      <tl-logo />
      <nav class="nav">
        <a class="site" routerLink="/guides" routerLinkActive="active">Guides</a>
        <a class="site" routerLink="/blog" routerLinkActive="active">Blog</a>
        <a class="site" routerLink="/about" routerLinkActive="active">About</a>
        <a routerLink="/login">Log in</a>
        <a routerLink="/register" class="cta">Get started</a>
      </nav>
    </header>
  `,
  styles: [`
    .hdr { position: sticky; top: 0; z-index: 10; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; padding: 18px var(--tl-page-pad);
      background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--tl-app-bg); }
    .nav { display: flex; align-items: center; gap: 26px; font-weight: 500; font-size: 15px; }
    .nav a { text-decoration: none; color: var(--tl-ink-soft); }
    .nav a:hover { color: var(--tl-primary-hover); }
    .nav a.active { color: var(--tl-primary); font-weight: 600; }
    .nav .cta { font-weight: 600; color: #fff; background: var(--tl-primary);
      border-radius: 999px; padding: 9px 18px; }
    .nav .cta:hover { background: var(--tl-primary-hover); color: #fff; }
    @media (max-width: 640px) { .nav .site { display: none; } }
  `],
})
export class SiteHeaderComponent {}
