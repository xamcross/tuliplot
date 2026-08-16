import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE } from '../site-identity';

export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  jsonLd?: object[];
  /** og:type. 'article' also emits article:published_time / article:modified_time. Default 'website'. */
  type?: 'website' | 'article';
  /** Absolute URL of a 1200×630 image. Default: the site card. */
  image?: string;
  /** ISO date (YYYY-MM-DD). Used only when type === 'article'. */
  published?: string;
  /** ISO date (YYYY-MM-DD). Falls back to `published`. */
  modified?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  set(opts: SeoOptions): void {
    const fullTitle = `${opts.title} · ${SITE.name}`;
    const url = opts.path === '/' ? SITE.url : `https://tuliplot.com${opts.path}/`;
    const type = opts.type ?? 'website';
    const image = opts.image ?? SITE.ogImage;
    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: opts.description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: opts.description });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: opts.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    if (type === 'article' && opts.published) {
      this.meta.updateTag({ property: 'article:published_time', content: opts.published });
      this.meta.updateTag({ property: 'article:modified_time', content: opts.modified ?? opts.published });
    } else {
      // Head reset rule: a website page after an article must not keep article tags.
      this.meta.removeTag('property="article:published_time"');
      this.meta.removeTag('property="article:modified_time"');
    }
    this.setCanonical(url);
    this.setJsonLd(opts.jsonLd);
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: object[] | undefined): void {
    const existing = this.doc.getElementById('tl-jsonld');
    if (!data?.length) {
      existing?.remove();
      return;
    }
    const script = (existing as HTMLScriptElement | null) ?? this.doc.createElement('script');
    script.id = 'tl-jsonld';
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(data);
    if (!existing) {
      this.doc.head.appendChild(script);
    }
  }
}
