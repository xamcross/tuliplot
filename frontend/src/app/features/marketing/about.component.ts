import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';
import { SITE } from '../../core/site-identity';

@Component({
  selector: 'tl-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band">
      <div class="tl-hero-band__inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>About TulipLot</h1>
      </div>
    </div>
    <main class="tl-prose">
      <p class="tl-lead">
        {{ sentence }} It is an independent productivity tool built for people who live
        in a handful of web apps all day. Instead of a wall of browser tabs, you
        get a single fixed grid — a personal cockpit for the sites you actually
        use.
      </p>
      <h2>Why we built it</h2>
      <p>
        Modern work is fragmented across Gmail, calendars, project boards, chat,
        dashboards, and news. Switching between them costs focus. TulipLot keeps
        them all live on one screen, arranged the way you think.
      </p>
      <h2>How it works</h2>
      <p>
        The web app composites embed-friendly sites directly. For sites that
        refuse to be framed, the optional TulipLot Companion (a Chrome extension)
        strips the blocking headers — but only for frames inside your own dashboard, and
        only for sites you explicitly allow.
      </p>
      <h2>Try, Free, and Premium</h2>
      <p>
        Not ready for an account? <a routerLink="/try">Try TulipLot</a> first: two live
        cells, no signup required. The free tier gives you five usable cells plus one
        ad-supported cell. Premium removes the ad and unlocks all six cells. Billing runs
        through Freemius; we never see your card details.
      </p>
      <h2>Contact</h2>
      <p>
        Questions, feedback, or press: email
        <a href="mailto:hello&#64;tuliplot.com">hello&#64;tuliplot.com</a>.
        The code is public on
        <a [href]="github" target="_blank" rel="noopener">GitHub</a>.
      </p>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-bg); }
    main { flex: 1; }
  `],
})
export class AboutComponent {
  protected readonly sentence = SITE.sentence;
  protected readonly github = SITE.sameAs[0];

  constructor() {
    inject(SeoService).set({
      title: 'About TulipLot — why we built a browser dashboard',
      description:
        'Why TulipLot exists: the tab-overload problem, how the single-window 3×2 dashboard works, and what Try, Free, and Premium include. Meet the product.',
      path: '/about',
    });
  }
}
