import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

@Component({
  selector: 'tl-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <main class="nf">
      <span class="code" aria-hidden="true">404</span>
      <h1>Page not found</h1>
      <p>That page doesn't exist — maybe the link is old, or the address has a typo.</p>
      <div class="links">
        <a routerLink="/" class="tl-btn tl-btn--primary tl-btn--sm">Back to the homepage</a>
        <a routerLink="/guides" class="tl-btn tl-btn--soft tl-btn--sm">Browse the guides</a>
      </div>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-bg); }
    .nf { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; padding: 64px var(--tl-page-pad); text-align: center; }
    .code { font-family: var(--tl-font-mono); font-weight: 700; font-size: 15px; letter-spacing: 0.08em;
      color: var(--tl-primary); background: var(--tl-primary-tint); border-radius: 999px; padding: 6px 14px; }
    h1 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 40px; color: var(--tl-ink); }
    p { margin: 0; font-size: 16px; color: var(--tl-ink-soft); max-width: 420px; line-height: 1.5; }
    .links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
  `],
})
export class NotFoundComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Page not found',
      description: 'That page does not exist on TulipLot.',
      path: '/404',
    });
  }
}
