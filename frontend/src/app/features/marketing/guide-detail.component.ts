import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GUIDES } from './content.generated';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';
import { pillClass } from './pill.util';

@Component({
  selector: 'tl-guide-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    @if (doc(); as d) {
      <div class="tl-hero-band tl-hero-band--tight">
        <div class="inner">
          <a routerLink="/guides" class="tl-back">← All guides</a>
          <div><span [class]="'tl-pill ' + pillClass(d.category)">{{ d.category }} · {{ d.readingMinutes }} min read</span></div>
          <h1>{{ d.title }}</h1>
        </div>
      </div>
      <article class="tl-article" [innerHTML]="d.html"></article>
      <div class="cta-row">
        <a routerLink="/register" class="tl-btn tl-btn--primary tl-btn--sm">Get started free →</a>
        <a routerLink="/guides" class="tl-btn tl-btn--soft tl-btn--sm">More guides</a>
      </div>
    } @else {
      <main class="tl-prose"><p>Guide not found. <a routerLink="/guides">Back to all guides</a>.</p></main>
    }
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: #fff; }
    .inner { max-width: 720px; margin: 0 auto; }
    .inner .tl-pill { margin-top: 14px; }
    .tl-hero-band h1 { font-size: 42px; }
    article { flex: 1; }
    .cta-row { max-width: 720px; margin: 0 auto; padding: 0 var(--tl-page-pad) 44px; width: 100%;
      display: flex; gap: 14px; border-top: 1px solid var(--tl-border); padding-top: 28px; }
    @media (max-width: 720px) { .tl-hero-band h1 { font-size: 30px; } }
  `],
})
export class GuideDetailComponent {
  private readonly slug = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('slug'))),
    { initialValue: null as string | null },
  );
  protected readonly doc = computed(
    () => GUIDES.find((g) => g.slug === this.slug()) ?? null,
  );
  protected readonly pillClass = pillClass;

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
