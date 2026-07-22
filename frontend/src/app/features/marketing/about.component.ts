import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'tl-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="doc-page">
      <a routerLink="/" class="doc-page__back">← DashDash home</a>
      <h1>About DashDash</h1>
      <p>
        DashDash is an independent productivity tool built for people who live
        in a handful of web apps all day. Instead of a wall of browser tabs, you
        get a single fixed grid — a personal cockpit for the sites you actually
        use.
      </p>
      <h2>Why we built it</h2>
      <p>
        Modern work is fragmented across Gmail, calendars, project boards, chat,
        dashboards, and news. Switching between them costs focus. DashDash keeps
        them all live on one screen, arranged the way you think.
      </p>
      <h2>How it works</h2>
      <p>
        The web app composites embed-friendly sites directly. For sites that
        refuse to be framed, an optional Chrome MV3 companion extension strips
        the blocking headers — but only for frames inside your own dashboard, and
        only for sites you explicitly allow.
      </p>
      <h2>Free and Premium</h2>
      <p>
        The free tier gives you five usable cells plus one ad-supported cell.
        Premium removes the ad and unlocks all six cells. Billing runs through
        Stripe; we never see your card details.
      </p>
      <h2>Contact</h2>
      <p>
        Questions, feedback, or press: email
        <a href="mailto:hello&#64;dashdash.app">hello&#64;dashdash.app</a>.
      </p>
    </main>
  `,
})
export class AboutComponent {
  constructor() {
    inject(SeoService).set({
      title: 'About',
      description: 'Why DashDash exists and how the single-window dashboard works.',
      path: '/about',
    });
  }
}
