import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  { q: 'Can I embed any website?', a: 'Any HTTPS URL. Some sites block embedding, and the optional TulipLot Companion (a Chrome extension) unlocks many of them. A few, like Gmail and Google Calendar, never embed anywhere and become one-click launchers instead.' },
  { q: 'Can I try TulipLot without creating an account?', a: 'Yes. The try page gives you two live cells with no signup — add any HTTPS site or pick from the catalog and it loads in the grid. Your cells stay in that browser, and they move into your dashboard if you create a free account, which raises you to five usable cells.' },
  { q: 'Is my data private?', a: 'Your dashboard is tied to your login and synced only to your account. Frames are sandboxed.' },
  { q: 'What happens if I cancel Premium?', a: 'You drop back to the free 5-cell layout. If all six cells were full, the sixth app is parked so you can re-place or discard it — nothing is deleted.' },
];

@Component({
  selector: 'tl-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />

    <main>
      <section class="hero">
        <span class="tl-eyebrow">One window · six apps</span>
        <h1>Everything you check all day, on <span class="hl">one calm screen</span></h1>
        <p class="sub">
          A browser dashboard: a fixed 3×2 grid where every cell hosts a live web app — Trello, Notion, your news, any URL you choose.
        </p>
        <div class="cta-row">
          <a routerLink="/register" class="tl-btn tl-btn--primary">Get started free →</a>
          <a routerLink="/guides" class="tl-btn tl-btn--soft">Read the guides</a>
        </div>
        <p class="tl-mono-note">Free forever · 5 cells + 1 ad slot · Premium = 6 cells, no ads</p>
      </section>

      <section class="preview">
        <div class="preview-grid" aria-hidden="true">
          <div class="tile tile--pink">Mail</div>
          <div class="tile tile--peach">Boards</div>
          <div class="tile tile--sky">Calendar</div>
          <div class="tile tile--mint">News</div>
          <div class="tile tile--lilac">Music</div>
          <div class="tile tile--ad">AD SLOT<br>(free)</div>
        </div>
      </section>

      <section class="features">
        <h2>Why it clicks</h2>
        <div class="cards">
          <article class="tl-card"><div class="swatch swatch--peach"></div>
            <h3>Six apps, one glance</h3>
            <p>A stable 3×2 grid you arrange once. Drag any two cells to swap them.</p>
          </article>
          <article class="tl-card"><div class="swatch swatch--sky"></div>
            <h3>Any site, framed safely</h3>
            <p>Every URL is validated as HTTPS and sandboxed. The optional TulipLot Companion (a Chrome extension) unlocks most stubborn sites.</p>
          </article>
          <article class="tl-card"><div class="swatch swatch--mint"></div>
            <h3>Yours, private, portable</h3>
            <p>One dashboard per account, synced to your login. Upgrade or cancel anytime.</p>
          </article>
        </div>
      </section>

      <section class="steps">
        <h2>Up in three moves</h2>
        <div class="cards">
          <div class="step"><span class="num num--pink">1</span>
            <h3>Sign up free</h3><p>One account, one dashboard. No credit card.</p></div>
          <div class="step"><span class="num num--peach">2</span>
            <h3>Fill your cells</h3><p>Pick from the catalog or paste any URL into a slot.</p></div>
          <div class="step"><span class="num num--mint">3</span>
            <h3>Glance all day</h3><p>Everything live in one window. Focus any cell full-screen.</p></div>
        </div>
      </section>

      <section class="pricing">
        <h2>Simple pricing</h2>
        <div class="plans">
          <div class="plan tl-card">
            <span class="plan-tag">Free</span>
            <div class="price">$0<span>/forever</span></div>
            <ul>
              <li>✓ 5 usable cells</li>
              <li>✓ Full catalog + custom URLs</li>
              <li>✓ Drag to rearrange</li>
              <li class="dim">• One ad in the 6th cell</li>
            </ul>
            <a routerLink="/register" class="tl-btn tl-btn--soft plan-cta">Start free</a>
          </div>
          <div class="plan plan--premium">
            <span class="plan-tag plan-tag--premium">Premium</span>
            <div class="price">$4<span>/month</span></div>
            <ul>
              <li>✓ All 6 cells unlocked</li>
              <li>✓ Zero ads, ever</li>
              <li>✓ Everything in Free</li>
              <li>✓ Cancel anytime via Stripe</li>
            </ul>
            <a routerLink="/register" class="tl-btn tl-btn--primary plan-cta">Go Premium</a>
          </div>
        </div>
      </section>

      <section class="faq">
        <h2>Questions</h2>
        @for (item of faq; track item.q) {
          <details>
            <summary>{{ item.q }}</summary>
            <p>{{ item.a }}</p>
          </details>
        }
      </section>
    </main>

    <tl-site-footer />
  `,
  styles: [`
    section h2 { margin: 0 0 32px; text-align: center; font-family: var(--tl-font-display);
      font-weight: 700; font-size: 34px; color: var(--tl-ink); }
    .hero { text-align: center; padding: 72px var(--tl-page-pad) 24px;
      display: flex; flex-direction: column; align-items: center; gap: 22px; }
    .hero h1 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 60px;
      line-height: 1.05; letter-spacing: -0.02em; max-width: 760px; }
    .hero .hl { color: var(--tl-primary); }
    .hero .sub { margin: 0; font-size: 19px; line-height: 1.55; color: var(--tl-ink-soft); max-width: 560px; }
    .cta-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
    .preview { padding: 20px var(--tl-page-pad) 72px; max-width: 1120px; margin: 0 auto; width: 100%; }
    .preview-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
      gap: 16px; aspect-ratio: 3 / 1.35; background: var(--tl-surface-2); border-radius: 24px; padding: 16px; }
    .tile { border-radius: 16px; padding: 14px; display: flex; align-items: flex-end;
      font-family: var(--tl-font-mono); font-size: 12px; font-weight: 700; }
    .tile--pink { background: var(--tl-pink); color: var(--tl-on-pink); }
    .tile--peach { background: var(--tl-peach); color: var(--tl-on-peach); }
    .tile--sky { background: var(--tl-sky); color: var(--tl-on-sky); }
    .tile--mint { background: var(--tl-mint); color: var(--tl-on-mint); }
    .tile--lilac { background: var(--tl-lilac); color: var(--tl-on-lilac); }
    .tile--ad { background: repeating-linear-gradient(45deg, var(--tl-tile-stripe-a), var(--tl-tile-stripe-a) 8px, var(--tl-tile-stripe-b) 8px, var(--tl-tile-stripe-b) 16px);
      border: 1.5px dashed var(--tl-border-dashed); align-items: center; justify-content: center;
      text-align: center; font-size: 11px; color: var(--tl-ink-faint); }
    .features { padding: 56px var(--tl-page-pad); background: var(--tl-surface); }
    .features .cards, .steps .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
      max-width: 1120px; margin: 0 auto; }
    .features article { padding: 26px; }
    .swatch { width: 46px; height: 46px; border-radius: 14px; margin-bottom: 16px; }
    .swatch--peach { background: var(--tl-peach); }
    .swatch--sky { background: var(--tl-sky); }
    .swatch--mint { background: var(--tl-mint); }
    .features h3, .steps h3 { margin: 0 0 8px; font-family: var(--tl-font-display); font-size: 20px; color: var(--tl-ink); }
    .features p, .steps p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    .steps { padding: 56px var(--tl-page-pad); max-width: 1232px; margin: 0 auto; width: 100%; }
    .step { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .num { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
      font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; border-radius: 999px; }
    .num--pink { background: var(--tl-pink); color: var(--tl-on-pink); }
    .num--peach { background: var(--tl-peach); color: var(--tl-on-peach); }
    .num--mint { background: var(--tl-mint); color: var(--tl-on-mint); }
    .pricing { padding: 56px var(--tl-page-pad); background: var(--tl-surface); }
    .plans { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 760px; margin: 0 auto; }
    .plan { padding: 32px; border-radius: 22px; }
    .plan--premium { background: var(--tl-primary-tint); border: 1.5px solid var(--tl-primary); }
    .plan-tag { font-family: var(--tl-font-mono); font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; font-size: 13px; color: var(--tl-ink-faint); }
    .plan-tag--premium { color: var(--tl-primary); }
    .price { font-family: var(--tl-font-display); font-weight: 700; font-size: 46px; margin: 6px 0 16px; }
    .price span { font-size: 18px; color: var(--tl-ink-faint); }
    .plan ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;
      font-size: 15px; color: var(--tl-ink-soft); }
    .plan .dim { color: var(--tl-ink-faint); }
    .plan-cta { display: flex; margin-top: 24px; padding: 12px; }
    .faq { padding: 56px var(--tl-page-pad); max-width: 932px; margin: 0 auto; width: 100%; }
    .faq h2 { margin-bottom: 28px; }
    .faq details { background: var(--tl-surface); border: 1px solid var(--tl-border);
      border-radius: 16px; padding: 18px 22px; margin-bottom: 12px; }
    .faq summary { font-family: var(--tl-font-display); font-weight: 600; font-size: 17px; color: var(--tl-ink); }
    .faq p { margin: 12px 0 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    @media (max-width: 960px) {
      .features .cards, .steps .cards, .plans { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .hero h1 { font-size: 42px; }
      section h2 { font-size: 28px; }
    }
  `],
})
export class LandingComponent {
  protected readonly faq = FAQ;

  constructor() {
    inject(SeoService).set({
      title: 'Browser dashboard — your apps on one calm screen',
      description:
        'Turn one tab into a browser dashboard: a fixed 3×2 grid of live web apps — Trello, Notion, news, any URL — side by side on one calm screen. Free to start.',
      path: '/',
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Organization', name: 'TulipLot', url: 'https://tuliplot.com/', logo: 'https://tuliplot.com/favicon.svg' },
        { '@context': 'https://schema.org', '@type': 'WebSite', name: 'TulipLot', url: 'https://tuliplot.com/' },
        {
          '@context': 'https://schema.org', '@type': 'SoftwareApplication',
          name: 'TulipLot', applicationCategory: 'BrowserApplication', operatingSystem: 'Web',
          description: 'A browser dashboard: a fixed 3×2 grid of live web apps in one tab.',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
        {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: FAQ.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
      ],
    });
  }
}
