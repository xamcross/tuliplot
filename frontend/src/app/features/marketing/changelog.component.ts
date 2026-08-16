import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHANGELOG } from './content.generated';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

@Component({
  selector: 'tl-changelog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band tl-hero-band--tight">
      <div class="tl-hero-band__inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Changelog</h1>
        <p>What changed on TulipLot, newest first.</p>
      </div>
    </div>
    <article class="tl-article" [innerHTML]="changelog.html"></article>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-bg); }
    article { flex: 1; padding-top: 36px; }
  `],
})
export class ChangelogComponent {
  protected readonly changelog = CHANGELOG;

  constructor() {
    inject(SeoService).set({
      title: 'Changelog — what changed on TulipLot',
      description: CHANGELOG.description,
      path: '/changelog',
    });
  }
}
