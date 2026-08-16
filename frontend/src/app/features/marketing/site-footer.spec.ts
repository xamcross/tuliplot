import { TestBed } from '@angular/core/testing';
import { UrlSerializer, provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { SiteFooterComponent } from './site-footer.component';
import { TrailingSlashUrlSerializer } from '../../core/trailing-slash-url.serializer';

describe('SiteFooterComponent', () => {
  it('links Guides, Blog, Try, Changelog, About, Contact, Privacy, Terms in that order, with trailing slashes', () => {
    TestBed.configureTestingModule({
      imports: [SiteFooterComponent],
      providers: [provideRouter([]), { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer }],
    });
    const f = TestBed.createComponent(SiteFooterComponent);
    f.detectChanges();
    const hrefs = Array.from((f.nativeElement as HTMLElement).querySelectorAll('nav.links a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/guides/', '/blog/', '/try/', '/changelog/', '/about/', '/contact/', '/privacy/', '/terms/']);
  });
});
