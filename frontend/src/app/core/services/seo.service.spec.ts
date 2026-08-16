import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  it('sets the document title and meta description + canonical', () => {
    const seo = TestBed.inject(SeoService);
    seo.set({
      title: 'Guides',
      description: 'How to get the most out of TulipLot.',
      path: '/guides',
    });

    expect(TestBed.inject(Title).getTitle()).toBe('Guides · TulipLot');
    const desc = TestBed.inject(Meta).getTag('name="description"');
    expect(desc?.content).toBe('How to get the most out of TulipLot.');
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://tuliplot.com/guides/');
  });

  it('emits trailing-slash og:url and root canonical for path "/"', () => {
    const seo = TestBed.inject(SeoService);
    seo.set({ title: 'Home', description: 'd', path: '/' });
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://tuliplot.com/');
    expect(TestBed.inject(Meta).getTag('property="og:url"')?.content).toBe('https://tuliplot.com/');
  });

  it('sets og:image and twitter card tags', () => {
    const seo = TestBed.inject(SeoService);
    seo.set({ title: 'Guides', description: 'd', path: '/guides' });
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:image"')?.content).toBe('https://tuliplot.com/og-card.png');
    expect(meta.getTag('property="og:image:width"')?.content).toBe('1200');
    expect(meta.getTag('property="og:image:height"')?.content).toBe('630');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
    expect(meta.getTag('name="twitter:title"')?.content).toBe('Guides · TulipLot');
    expect(meta.getTag('name="twitter:description"')?.content).toBe('d');
  });

  it('upserts JSON-LD when provided and removes it when absent', () => {
    const seo = TestBed.inject(SeoService);
    seo.set({ title: 'A', description: 'd', path: '/a', jsonLd: [{ '@type': 'FAQPage' }] });
    const script = document.getElementById('tl-jsonld');
    expect(script?.getAttribute('type')).toBe('application/ld+json');
    expect(script?.textContent).toContain('"@type":"FAQPage"');

    seo.set({ title: 'B', description: 'd', path: '/b', jsonLd: [{ '@type': 'Article' }] });
    expect(document.querySelectorAll('#tl-jsonld').length).toBe(1);
    expect(document.getElementById('tl-jsonld')?.textContent).toContain('"@type":"Article"');

    seo.set({ title: 'C', description: 'd', path: '/c' });
    expect(document.getElementById('tl-jsonld')).toBeNull();
  });

  it('emits og:type=article with published and modified times, and removes them on the next website call', () => {
    const seo = TestBed.inject(SeoService);
    const meta = TestBed.inject(Meta);
    seo.set({ title: 'Post', description: 'd', path: '/blog/post', type: 'article', published: '2026-08-02', modified: '2026-08-15' });
    expect(meta.getTag('property="og:type"')?.content).toBe('article');
    expect(meta.getTag('property="article:published_time"')?.content).toBe('2026-08-02');
    expect(meta.getTag('property="article:modified_time"')?.content).toBe('2026-08-15');

    seo.set({ title: 'Blog', description: 'd', path: '/blog' });
    expect(meta.getTag('property="og:type"')?.content).toBe('website');
    expect(meta.getTag('property="article:published_time"')).toBeNull();
    expect(meta.getTag('property="article:modified_time"')).toBeNull();
  });

  it('falls back modified_time to published_time when modified is absent', () => {
    const seo = TestBed.inject(SeoService);
    const meta = TestBed.inject(Meta);
    seo.set({ title: 'Post', description: 'd', path: '/blog/post', type: 'article', published: '2026-08-02' });
    expect(meta.getTag('property="article:modified_time"')?.content).toBe('2026-08-02');
  });

  it('uses the given image for og:image and twitter:image, and the site card by default', () => {
    const seo = TestBed.inject(SeoService);
    const meta = TestBed.inject(Meta);
    seo.set({ title: 'Post', description: 'd', path: '/blog/post', image: 'https://tuliplot.com/banners/post-og.png' });
    expect(meta.getTag('property="og:image"')?.content).toBe('https://tuliplot.com/banners/post-og.png');
    expect(meta.getTag('name="twitter:image"')?.content).toBe('https://tuliplot.com/banners/post-og.png');

    seo.set({ title: 'Blog', description: 'd', path: '/blog' });
    expect(meta.getTag('property="og:image"')?.content).toBe('https://tuliplot.com/og-card.png');
    expect(meta.getTag('name="twitter:image"')?.content).toBe('https://tuliplot.com/og-card.png');
  });
});
