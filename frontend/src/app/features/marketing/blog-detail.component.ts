import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { POSTS } from './content.generated';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="doc-page">
      <a routerLink="/blog" class="doc-page__back">← All posts</a>
      @if (doc(); as d) {
        <article class="content-article">
          <span class="content-card__cat">{{ d.category }}</span>
          <h1>{{ d.title }}</h1>
          <p class="doc-page__meta">{{ d.date }} · {{ d.readingMinutes }} min read</p>
          <div class="content-article__body" [innerHTML]="d.html"></div>
        </article>
      } @else {
        <p>Post not found. <a routerLink="/blog">Back to the blog</a>.</p>
      }
    </main>
  `,
})
export class BlogDetailComponent {
  private readonly slug = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('slug'))),
    { initialValue: null as string | null },
  );
  protected readonly doc = computed(
    () => POSTS.find((p) => p.slug === this.slug()) ?? null,
  );

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const d = this.doc();
      if (d) {
        seo.set({
          title: d.title,
          description: d.description,
          path: `/blog/${d.slug}`,
        });
      }
    });
  }
}
