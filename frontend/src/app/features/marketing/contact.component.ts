import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

@Component({
  selector: 'tl-contact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band">
      <div class="tl-hero-band__inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Contact TulipLot</h1>
      </div>
    </div>
    <main class="tl-prose">
      <p class="tl-lead">
        We are a small, independent team and we read every message. Whether you
        have found a bug, want a site added to the catalog, need help with
        billing, or just want to say hello — get in touch.
      </p>

      <h2>Email us</h2>
      <div class="cards">
        <div class="card">
          <div class="sw" style="background: var(--tl-peach)"></div>
          <h3>General &amp; feedback</h3>
          <a href="mailto:hello&#64;tuliplot.com">hello&#64;tuliplot.com</a>
        </div>
        <div class="card">
          <div class="sw" style="background: var(--tl-sky)"></div>
          <h3>Support &amp; billing</h3>
          <a href="mailto:support&#64;tuliplot.com">support&#64;tuliplot.com</a>
        </div>
        <div class="card">
          <div class="sw" style="background: var(--tl-mint)"></div>
          <h3>Privacy &amp; data</h3>
          <a href="mailto:privacy&#64;tuliplot.com">privacy&#64;tuliplot.com</a>
        </div>
      </div>

      <h2>Response times</h2>
      <p>
        We aim to reply within two business days. For account-specific
        questions, please email us from the address on your TulipLot account so
        we can verify you quickly. Premium billing issues are prioritised.
      </p>

      <h2>Company</h2>
      <p>
        TulipLot is an independent product. Postal and press enquiries can be
        sent to the general address above and we will route them to the right
        person.
      </p>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: #fff; }
    main { flex: 1; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0 8px; }
    .card { background: var(--tl-surface); border: 1px solid var(--tl-border); border-radius: 16px; padding: 22px; }
    .sw { width: 38px; height: 38px; border-radius: 11px; margin-bottom: 14px; }
    .card h3 { margin: 0 0 6px; font-family: var(--tl-font-display); font-weight: 600; font-size: 16px; color: var(--tl-ink); }
    .card a { font-size: 14px; }
    @media (max-width: 960px) { .cards { grid-template-columns: 1fr; } }
  `],
})
export class ContactComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Contact',
      description: 'How to reach the TulipLot team for support, billing, feedback, and privacy requests.',
      path: '/contact',
    });
  }
}
