import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

@Component({
  selector: 'tl-terms',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band tl-hero-band--tight">
      <div class="tl-hero-band__inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Terms of Service</h1>
        <span class="tl-updated">Last updated: 21 July 2026</span>
      </div>
    </div>
    <main class="tl-prose tl-prose--legal">
      <h2>1. Acceptance</h2>
      <p>
        By creating a TulipLot account or using the service you agree to these
        terms. If you do not agree, do not use TulipLot.
      </p>

      <h2>2. The service</h2>
      <p>
        TulipLot provides a configurable dashboard that embeds third-party web
        apps you choose. We do not own or control those third-party sites and are
        not responsible for their content, availability, or terms. Some sites
        cannot be embedded and will open in a separate window.
      </p>

      <h2>3. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your login and
        for all activity under your account. You must provide accurate information
        and be old enough to form a binding contract in your jurisdiction.
      </p>

      <h2>4. Free and Premium plans</h2>
      <p>
        The free plan includes five usable cells and one advertising cell.
        Premium removes advertising and unlocks all six cells. Subscriptions are
        billed through Stripe and renew until cancelled. You may cancel anytime
        through the billing portal; access continues until the end of the paid
        period.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        You may not use TulipLot to embed unlawful content, to circumvent the
        security of third-party sites, or to disrupt the service. We validate
        embedded URLs as HTTPS and may refuse content that violates these terms.
      </p>

      <h2>6. Disclaimer and liability</h2>
      <p>
        TulipLot is provided “as is,” without warranties of any kind. To the
        maximum extent permitted by law, TulipLot is not liable for indirect or
        consequential damages arising from your use of the service or embedded
        third-party sites.
      </p>

      <h2>7. Changes and termination</h2>
      <p>
        We may modify these terms or the service and will post changes here. We may
        suspend accounts that violate these terms. You may stop using TulipLot and
        delete your account at any time.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about these terms:
        <a href="mailto:legal&#64;tuliplot.com">legal&#64;tuliplot.com</a>.
      </p>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-bg); }
    main { flex: 1; }
    .tl-hero-band h1 { font-size: 44px; }
  `],
})
export class TermsComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Terms of Service',
      description: 'The terms that govern your use of TulipLot.',
      path: '/terms',
    });
  }
}
