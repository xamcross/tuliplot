import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  it('links Guides, Blog, Try, Changelog, About, Contact, Privacy, Terms in that order', () => {
    TestBed.configureTestingModule({ imports: [SiteFooterComponent], providers: [provideRouter([])] });
    const f = TestBed.createComponent(SiteFooterComponent);
    f.detectChanges();
    const hrefs = Array.from((f.nativeElement as HTMLElement).querySelectorAll('nav.links a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/guides', '/blog', '/try', '/changelog', '/about', '/contact', '/privacy', '/terms']);
  });
});
