import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'tl-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="site-nav">
      <a routerLink="/" class="site-nav__brand">TulipLot</a>
      <nav>
        <a routerLink="/guides">Guides</a>
        <a routerLink="/blog">Blog</a>
        <a routerLink="/about">About</a>
        <a routerLink="/login">Log in</a>
      </nav>
    </header>

    <main class="landing">
      <section class="hero">
        <h1>Turn one browser window into your dashboard</h1>
        <p>
          TulipLot gives you a fixed 3×2 grid where every cell hosts a live web
          app — Gmail, Trello, your favorite news site, any URL you choose.
          Everything you check all day, on one screen.
        </p>
        <div class="hero__cta">
          <a routerLink="/register" class="btn btn--primary">Get started free</a>
          <a routerLink="/guides" class="btn btn--ghost">Read the guides</a>
        </div>
        <p class="hero__note">
          Free forever with 5 cells and one ad slot. Go Premium for 6 cells and
          no ads.
        </p>
      </section>

      <section class="features">
        <article>
          <h2>Six apps, one glance</h2>
          <p>
            A stable 3×2 grid you arrange once. Drag any two cells to swap them.
            No tab-hunting, no window juggling.
          </p>
        </article>
        <article>
          <h2>Any site, framed safely</h2>
          <p>
            TulipLot validates every URL as HTTPS and sandboxes each frame. Our
            optional Chrome companion unlocks sites that normally refuse to be
            embedded.
          </p>
        </article>
        <article>
          <h2>Yours, private, portable</h2>
          <p>
            One dashboard per account, synced to your login. Upgrade or cancel
            anytime through Stripe’s billing portal.
          </p>
        </article>
      </section>
    </main>

    <footer class="site-footer">
      <a routerLink="/about">About</a>
      <a routerLink="/privacy">Privacy</a>
      <a routerLink="/terms">Terms</a>
      <span>© 2026 TulipLot</span>
    </footer>
  `,
})
export class LandingComponent {
  constructor() {
    inject(SeoService).set({
      title: 'TulipLot — your apps on one screen',
      description:
        'Turn one browser window into a personal dashboard: a fixed 3×2 grid of the web apps you use all day.',
      path: '/',
    });
  }
}
