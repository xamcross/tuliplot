import { describe, it, expect } from 'vitest';
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from './article-jsonld';
import { ContentDoc } from './content.model';

const base: ContentDoc = {
  slug: 'demo', title: 'Demo title', description: 'Demo description', date: '2026-08-02',
  category: 'Tips', readingMinutes: 3, faq: [], html: '<p>x</p>',
};

describe('buildArticleJsonLd', () => {
  it('uses date for both dates when updated is absent, and the site card when there is no ogImage', () => {
    const a = buildArticleJsonLd(base, '/blog') as Record<string, unknown>;
    expect(a['datePublished']).toBe('2026-08-02');
    expect(a['dateModified']).toBe('2026-08-02');
    expect(a['image']).toBe('https://tuliplot.com/og-card.png');
    expect(a['mainEntityOfPage']).toBe('https://tuliplot.com/blog/demo/');
  });

  it('uses updated for dateModified and ogImage for image when present', () => {
    const a = buildArticleJsonLd({ ...base, updated: '2026-08-15', ogImage: 'https://tuliplot.com/banners/demo-og.png' }, '/blog') as Record<string, unknown>;
    expect(a['datePublished']).toBe('2026-08-02');
    expect(a['dateModified']).toBe('2026-08-15');
    expect(a['image']).toBe('https://tuliplot.com/banners/demo-og.png');
  });

  it('names the publisher with the org @id and the PNG logo; author stays the Organization', () => {
    const a = buildArticleJsonLd(base, '/guides') as { publisher: Record<string, unknown>; author: Record<string, string> };
    expect(a.publisher['@id']).toBe('https://tuliplot.com/#org');
    expect((a.publisher['logo'] as Record<string, string>)['url']).toBe('https://tuliplot.com/logo-512.png');
    expect(a.author['@type']).toBe('Organization');
    expect(a.author['name']).toBe('TulipLot');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('builds a BreadcrumbList with 1-based positions', () => {
    const b = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://tuliplot.com/' },
      { name: 'Blog', url: 'https://tuliplot.com/blog/' },
      { name: 'Demo title', url: 'https://tuliplot.com/blog/demo/' },
    ]) as { '@type': string; itemListElement: Array<Record<string, unknown>> };
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement.map((i) => i['position'])).toEqual([1, 2, 3]);
    expect(b.itemListElement[2]['name']).toBe('Demo title');
    expect(b.itemListElement[2]['item']).toBe('https://tuliplot.com/blog/demo/');
  });
});
