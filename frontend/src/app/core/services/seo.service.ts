import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  set(opts: { title: string; description: string; path: string; jsonLd?: object[] }): void {
    const fullTitle = `${opts.title} · TulipLot`;
    const url = opts.path === '/' ? 'https://tuliplot.com/' : `https://tuliplot.com${opts.path}/`;
    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: opts.description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: opts.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: 'https://tuliplot.com/og-card.png' });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: opts.description });
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
