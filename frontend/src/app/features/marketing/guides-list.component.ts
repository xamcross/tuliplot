import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDES } from './content.generated';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';
import { pillClass } from './pill.util';

@Component({
  selector: 'tl-guides-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band">
      <div class="inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Guides</h1>
        <p>Step-by-step help getting the most out of TulipLot.</p>
      </div>
    </div>
    <main>
      <div class="cards">
        @for (guide of guides; track guide.slug) {
          <a class="card tl-card" [routerLink]="['/guides', guide.slug]">
            <span [class]="'tl-pill ' + pillClass(guide.category)">{{ guide.category }}</span>
            <h2>{{ guide.title }}</h2>
            <p>{{ guide.description }}</p>
            <span class="meta">{{ guide.readingMinutes }} min read</span>
          </a>
        }
      </div>
    </main>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: #fff; }
    .inner { max-width: 900px; margin: 0 auto; }
    main { flex: 1; max-width: 900px; margin: 0 auto; padding: 48px var(--tl-page-pad); width: 100%; }
    .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .card { padding: 26px; display: flex; flex-direction: column; gap: 10px; text-decoration: none; }
    .card h2 { margin: 4px 0 0; font-family: var(--tl-font-display); font-weight: 700; font-size: 21px; color: var(--tl-ink); }
    .card p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--tl-ink-soft); }
    .meta { margin-top: auto; font-family: var(--tl-font-mono); font-size: 12px; color: var(--tl-ink-faint); }
    @media (max-width: 960px) { .cards { grid-template-columns: 1fr; } }
  `],
})
export class GuidesListComponent {
  protected readonly guides = GUIDES;
  protected readonly pillClass = pillClass;

  constructor() {
    inject(SeoService).set({
      title: 'Guides',
      description: 'Step-by-step help getting the most out of TulipLot.',
      path: '/guides',
    });
  }
}
