import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { POSTS } from './content.generated';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="doc-page">
      <a routerLink="/" class="doc-page__back">← DashDash home</a>
      <h1>Blog</h1>
      <p>Product news and thinking on focused, single-window work.</p>
      <ul class="content-list">
        @for (post of posts; track post.slug) {
          <li>
            <a class="content-card" [routerLink]="['/blog', post.slug]">
              <span class="content-card__cat">{{ post.category }}</span>
              <h2>{{ post.title }}</h2>
              <p>{{ post.description }}</p>
              <span class="content-card__meta">{{ post.date }} · {{ post.readingMinutes }} min read</span>
            </a>
          </li>
        }
      </ul>
    </main>
  `,
})
export class BlogListComponent {
  protected readonly posts = POSTS;

  constructor() {
    inject(SeoService).set({
      title: 'Blog',
      description: 'Product news and thinking on focused, single-window work.',
      path: '/blog',
    });
  }
}
