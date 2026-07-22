import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

@Component({
  selector: 'tl-privacy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band tl-hero-band--tight">
      <div class="tl-hero-band__inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Privacy Policy</h1>
        <span class="tl-updated">Last updated: 21 July 2026</span>
      </div>
    </div>
    <main class="tl-prose tl-prose--legal">
      <p>
        This policy explains what TulipLot collects, why, and the choices you
        have. It covers the TulipLot web app, the public content site, and the
        optional Chrome companion extension.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email address, display name, and (for
          password accounts) a bcrypt hash of your password. If you sign in with
          Google, we store your Google subject identifier.
        </li>
        <li>
          <strong>Dashboard data:</strong> the cells you configure — the URLs,
          titles, and icons you add to your grid.
        </li>
        <li>
          <strong>Billing data:</strong> a Stripe customer and subscription
          identifier. Card numbers are handled entirely by Stripe; TulipLot never
          receives them.
        </li>
        <li>
          <strong>Session data:</strong> a first-party, httpOnly session cookie
          scoped to <code>.tuliplot.com</code> that keeps you signed in.
        </li>
      </ul>

      <h2>Advertising and cookies</h2>
      <p>
        The free tier shows a single advertisement in the bottom-right cell of
        your dashboard. These ads are served by <strong>Google AdSense</strong>.
        Google and its partners use cookies and similar technologies — including
        the DoubleClick/Google advertising cookie — to serve ads, measure
        performance, and, where you consent, personalize the ads you see.
      </p>
      <ul>
        <li>
          Third-party vendors, including Google, use cookies to serve ads based on
          your prior visits to TulipLot and other websites.
        </li>
        <li>
          In the EEA, the UK, and Switzerland we present a Google-certified consent
          management platform (Consent Mode v2 / IAB TCF v2.2). Advertising and its
          cookies load <em>only</em> after you grant consent. Until then, no
          AdSense script runs.
        </li>
        <li>
          You can review and change your advertising choices at
          <a href="https://adssettings.google.com" rel="noopener" target="_blank"
            >Google Ads Settings</a
          >, and opt out of personalized advertising from participating vendors at
          <a href="https://www.aboutads.info/choices" rel="noopener" target="_blank"
            >aboutads.info/choices</a
          >
          and
          <a href="https://www.youronlinechoices.eu" rel="noopener" target="_blank"
            >youronlinechoices.eu</a
          >.
        </li>
        <li>
          <strong>Premium subscribers see no ads and no advertising cookies.</strong>
        </li>
      </ul>

      <h2>How we use your data</h2>
      <p>
        We use your data to operate the service: authenticate you, store and render
        your dashboard, process subscriptions, and serve (for free accounts)
        advertising. We do not sell your personal data.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        Account and dashboard data persist until you delete your account. Stripe
        webhook events are retained briefly for idempotency and then expire
        automatically. To request deletion, email
        <a href="mailto:privacy&#64;tuliplot.com">privacy&#64;tuliplot.com</a>.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct,
        export, or delete your personal data, and to withdraw advertising consent
        at any time via the consent controls on the site.
      </p>

      <h2>Changes</h2>
      <p>
        We will update this page when our practices change and revise the “last
        updated” date above.
      </p>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: #fff; }
    main { flex: 1; }
    .tl-hero-band h1 { font-size: 44px; }
  `],
})
export class PrivacyComponent {
  constructor() {
    inject(SeoService).set({
      title: 'Privacy Policy',
      description: 'What TulipLot collects, how ads and cookies work, and your choices.',
      path: '/privacy',
    });
  }
}
