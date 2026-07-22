import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GUIDES } from './content.generated';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'tl-guide-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="doc-page">
      <a routerLink="/guides" class="doc-page__back">← All guides</a>
      @if (doc(); as d) {
        <article class="content-article">
          <span class="content-card__cat">{{ d.category }}</span>
          <h1>{{ d.title }}</h1>
          <p class="doc-page__meta">{{ d.readingMinutes }} min read</p>
          <div class="content-article__body" [innerHTML]="d.html"></div>
        </article>
      } @else {
        <p>Guide not found. <a routerLink="/guides">Back to all guides</a>.</p>
      }
    </main>
  `,
})
export class GuideDetailComponent {
  private readonly slug = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('slug'))),
    { initialValue: null as string | null },
  );
  protected readonly doc = computed(
    () => GUIDES.find((g) => g.slug === this.slug()) ?? null,
  );

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const d = this.doc();
      if (d) {
        seo.set({
          title: d.title,
          description: d.description,
          path: `/guides/${d.slug}`,
        });
      }
    });
  }
}
