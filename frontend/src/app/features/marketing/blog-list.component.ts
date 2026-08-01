import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { POSTS } from './content.generated';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';
import { pillClass, thumbClass } from './pill.util';

@Component({
  selector: 'tl-blog-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band">
      <div class="inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Blog</h1>
        <p>Product news and thinking on focused, single-window work.</p>
      </div>
    </div>
    <main>
      <div class="posts">
        @for (post of posts; track post.slug) {
          <a class="post tl-card" [routerLink]="['/blog', post.slug]">
            <span [class]="'thumb ' + thumbClass(post.category)" aria-hidden="true"></span>
            <span class="body">
              <span [class]="'tl-pill ' + pillClass(post.category)">{{ post.category }}</span>
              <h2>{{ post.title }}</h2>
              <p>{{ post.description }}</p>
              <span class="meta">{{ post.date }} · {{ post.readingMinutes }} min read</span>
            </span>
          </a>
        }
      </div>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-bg); }
    .inner { max-width: 900px; margin: 0 auto; }
    main { flex: 1; max-width: 900px; margin: 0 auto; padding: 48px var(--tl-page-pad); width: 100%; }
    .posts { display: flex; flex-direction: column; gap: 18px; }
    .post { display: flex; gap: 24px; align-items: center; padding: 28px; text-decoration: none; }
    .thumb { flex: none; width: 120px; height: 96px; border-radius: 14px; }
    .thumb--amber { background: var(--tl-thumb-amber); }
    .thumb--sky { background: var(--tl-sky-tint); }
    .thumb--mint { background: var(--tl-mint-tint); }
    .thumb--neutral { background: var(--tl-surface-3); }
    .body { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .post h2 { margin: 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; color: var(--tl-ink); }
    .post p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    .meta { font-family: var(--tl-font-mono); font-size: 12px; color: var(--tl-ink-faint); }
    @media (max-width: 720px) { .post { flex-direction: column; align-items: flex-start; } }
  `],
})
export class BlogListComponent {
  protected readonly posts = POSTS;
  protected readonly pillClass = pillClass;
  protected readonly thumbClass = thumbClass;

  constructor() {
    inject(SeoService).set({
      title: 'Blog — tab overload & focused work',
      description: 'Thinking on tab overload, browser dashboards, and focused single-window work, plus TulipLot product news and layout ideas for your six-cell grid.',
      path: '/blog',
    });
  }
}
