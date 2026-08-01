import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { BlogDetailComponent } from './blog-detail.component';
import { POSTS } from './content.generated';

function render(slug: string) {
  TestBed.configureTestingModule({
    imports: [BlogDetailComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug })) } },
    ],
  });
  const f = TestBed.createComponent(BlogDetailComponent);
  f.detectChanges();
  return f;
}

describe('BlogDetailComponent', () => {
  beforeEach(() => {
    // Each test starts from a clean <head>: SeoService mutates document.head directly
    // (outside Angular's fixture lifecycle), so a stale #tl-jsonld from a prior test
    // would otherwise linger and shadow the one this test creates.
    document.getElementById('tl-jsonld')?.remove();
  });

  it('emits Article JSON-LD for the current post', () => {
    render(POSTS[0].slug);
    const data = JSON.parse(document.getElementById('tl-jsonld')!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const article = data.find((d) => d['@type'] === 'Article');
    expect(article?.['headline']).toBe(POSTS[0].title);
    expect(article?.['mainEntityOfPage']).toBe(`https://tuliplot.com/blog/${POSTS[0].slug}/`);
  });

  it('resets the head when the slug does not exist', () => {
    const stale = document.createElement('script');
    stale.id = 'tl-jsonld';
    stale.setAttribute('type', 'application/ld+json');
    stale.textContent = '[{"@type":"Article"}]';
    document.head.appendChild(stale);
    render('no-such-post');
    expect(document.title).toBe('Post not found · TulipLot');
    expect(document.getElementById('tl-jsonld')).toBeNull();
  });

  it('renders Keep reading links excluding the current post', () => {
    const f = render(POSTS[0].slug);
    const links = Array.from(f.nativeElement.querySelectorAll('.related a')) as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const a of links) {
      expect(a.getAttribute('href')).not.toContain(POSTS[0].slug);
    }
  });

  it('renders the per-post banner image', () => {
    const f = render(POSTS[0].slug);
    const img = f.nativeElement.querySelector('img.banner') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(`/banners/${POSTS[0].slug}.png`);
    expect(img.getAttribute('alt')).toBe('');
  });
});
