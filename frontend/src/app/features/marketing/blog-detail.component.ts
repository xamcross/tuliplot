import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { POSTS, GUIDES } from './content.generated';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';
import { pillClass } from './pill.util';

@Component({
  selector: 'tl-blog-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    @if (doc(); as d) {
      <div class="tl-hero-band tl-hero-band--tight">
        <div class="inner">
          <a routerLink="/blog" class="tl-back">← All posts</a>
          <div><span [class]="'tl-pill ' + pillClass(d.category)">{{ d.category }} · {{ d.date }} · {{ d.readingMinutes }} min read</span></div>
          <h1>{{ d.title }}</h1>
        </div>
      </div>
      <div class="banner" aria-hidden="true"></div>
      <article class="tl-article" [innerHTML]="d.html"></article>
      <nav class="related" aria-labelledby="related-h">
        <h2 id="related-h">Keep reading</h2>
        <ul>
          @for (r of related(); track r.path) {
            <li><a [routerLink]="r.path">{{ r.title }}</a></li>
          }
        </ul>
      </nav>
      <div class="cta-row">
        <a routerLink="/register" class="tl-btn tl-btn--primary tl-btn--sm">Try TulipLot free →</a>
        <a routerLink="/blog" class="tl-btn tl-btn--soft tl-btn--sm">More posts</a>
      </div>
    } @else {
      <main class="tl-prose"><p>Post not found. <a routerLink="/blog">Back to the blog</a>.</p></main>
    }
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-bg); }
    .inner { max-width: 720px; margin: 0 auto; }
    .inner .tl-pill { margin-top: 14px; }
    .tl-hero-band h1 { font-size: 42px; }
    article { flex: 1; padding-top: 36px; }
    .banner { max-width: 720px; margin: 44px auto 0; height: 260px; border-radius: 20px;
      background: var(--tl-sky-tint); width: calc(100% - 2 * var(--tl-page-pad)); }
    .cta-row { max-width: 720px; margin: 0 auto; padding: 0 var(--tl-page-pad) 44px; width: 100%;
      display: flex; gap: 14px; border-top: 1px solid var(--tl-border); padding-top: 28px; }
    .related { max-width: 720px; margin: 0 auto; padding: 8px var(--tl-page-pad) 28px; width: 100%; }
    .related h2 { margin: 0 0 10px; font-family: var(--tl-font-display); font-size: 20px; color: var(--tl-ink); }
    .related ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .related a { color: var(--tl-primary); text-decoration: none; font-weight: 600; }
    .related a:hover { text-decoration: underline; }
    @media (max-width: 720px) { .tl-hero-band h1 { font-size: 30px; } }
  `],
})
export class BlogDetailComponent {
  private readonly slug = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('slug'))),
    { initialValue: null as string | null },
  );
  protected readonly doc = computed(
    () => POSTS.find((p) => p.slug === this.slug()) ?? null,
  );
  protected readonly related = computed(() => {
    const current = this.slug();
    const posts = POSTS.filter((p) => p.slug !== current)
      .slice(0, 2)
      .map((p) => ({ path: `/blog/${p.slug}`, title: p.title }));
    const guides = GUIDES.slice(0, 2).map((g) => ({ path: `/guides/${g.slug}`, title: g.title }));
    return [...posts, ...guides];
  });
  protected readonly pillClass = pillClass;

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const d = this.doc();
      if (d) {
        seo.set({
          title: d.title,
          description: d.description,
          path: `/blog/${d.slug}`,
          jsonLd: [{
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: d.title,
            description: d.description,
            datePublished: d.date,
            dateModified: d.date,
            mainEntityOfPage: `https://tuliplot.com/blog/${d.slug}/`,
            image: 'https://tuliplot.com/og-card.png',
            author: { '@type': 'Organization', name: 'TulipLot' },
            publisher: { '@type': 'Organization', name: 'TulipLot', logo: { '@type': 'ImageObject', url: 'https://tuliplot.com/og-card.png' } },
          }],
        });
      } else if (this.slug()) {
        seo.set({
          title: 'Post not found',
          description: 'That post does not exist.',
          path: '/blog',
        });
      }
    });
  }
}
