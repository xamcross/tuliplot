import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { GuideDetailComponent } from './guide-detail.component';
import { GUIDES } from './content.generated';

function render(slug: string) {
  TestBed.configureTestingModule({
    imports: [GuideDetailComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug })) } },
    ],
  });
  const f = TestBed.createComponent(GuideDetailComponent);
  f.detectChanges();
  return f;
}

describe('GuideDetailComponent', () => {
  beforeEach(() => {
    // Each test starts from a clean <head>: SeoService mutates document.head directly
    // (outside Angular's fixture lifecycle), so a stale #tl-jsonld from a prior test
    // would otherwise linger and shadow the one this test creates.
    document.getElementById('tl-jsonld')?.remove();
  });

  it('emits Article JSON-LD for the current guide', () => {
    render(GUIDES[0].slug);
    const script = document.getElementById('tl-jsonld');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const article = data.find((d) => d['@type'] === 'Article');
    expect(article?.['headline']).toBe(GUIDES[0].title);
    expect(article?.['datePublished']).toBe(GUIDES[0].date);
  });

  it('renders Keep reading links excluding the current guide', () => {
    const f = render(GUIDES[0].slug);
    const links = Array.from(f.nativeElement.querySelectorAll('.related a')) as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const a of links) {
      expect(a.getAttribute('href')).not.toContain(GUIDES[0].slug);
    }
  });

  it('emits FAQPage JSON-LD for a guide with question headings', () => {
    const withFaq = GUIDES.find((g) => g.faq.length > 0);
    expect(withFaq, 'expected at least one guide with question h3s').toBeTruthy();
    render(withFaq!.slug);
    const data = JSON.parse(document.getElementById('tl-jsonld')!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const faqBlock = data.find((d) => d['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> } | undefined;
    expect(faqBlock).toBeTruthy();
    expect(faqBlock!.mainEntity[0].name).toBe(withFaq!.faq[0].q);
  });

  it('resets the head when the slug does not exist', () => {
    const stale = document.createElement('script');
    stale.id = 'tl-jsonld';
    stale.setAttribute('type', 'application/ld+json');
    stale.textContent = '[{"@type":"Article"}]';
    document.head.appendChild(stale);

    render('no-such-guide');

    expect(document.title).toBe('Guide not found · TulipLot');
    expect(document.getElementById('tl-jsonld')).toBeNull();
  });

  it('sets article og tags and a BreadcrumbList', () => {
    render(GUIDES[0].slug);
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:type"')?.content).toBe('article');
    expect(meta.getTag('property="article:published_time"')?.content).toBe(GUIDES[0].date);
    expect(meta.getTag('property="article:modified_time"')?.content).toBe(GUIDES[0].updated ?? GUIDES[0].date);
    expect(meta.getTag('property="og:image"')?.content).toBe('https://tuliplot.com/og-card.png');
    const data = JSON.parse(document.getElementById('tl-jsonld')!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList') as { itemListElement: Array<Record<string, unknown>> };
    expect(crumbs.itemListElement.map((i) => i['name'])).toEqual(['Home', 'Guides', GUIDES[0].title]);
  });

  it('uses title for the document title when a guide has no seoTitle', () => {
    const without = GUIDES.find((g) => !g.seoTitle)!;
    render(without.slug);
    expect(document.title).toBe(`${without.title} · TulipLot`);
  });

  it('renders the published date as a <time> element', () => {
    const f = render(GUIDES[0].slug);
    const time = (f.nativeElement as HTMLElement).querySelector('time') as HTMLTimeElement;
    expect(time).toBeTruthy();
    expect(time.getAttribute('datetime')).toBe(GUIDES[0].date);
  });
});
