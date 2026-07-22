import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDES } from './content.generated';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'tl-guides-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="doc-page">
      <a routerLink="/" class="doc-page__back">← TulipLot home</a>
      <h1>Guides</h1>
      <p>Step-by-step help getting the most out of TulipLot.</p>
      <ul class="content-list">
        @for (guide of guides; track guide.slug) {
          <li>
            <a class="content-card" [routerLink]="['/guides', guide.slug]">
              <span class="content-card__cat">{{ guide.category }}</span>
              <h2>{{ guide.title }}</h2>
              <p>{{ guide.description }}</p>
              <span class="content-card__meta">{{ guide.readingMinutes }} min read</span>
            </a>
          </li>
        }
      </ul>
    </main>
  `,
})
export class GuidesListComponent {
  protected readonly guides = GUIDES;

  constructor() {
    inject(SeoService).set({
      title: 'Guides',
      description: 'Step-by-step help getting the most out of TulipLot.',
      path: '/guides',
    });
  }
}
