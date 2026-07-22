import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  it('sets the document title and meta description + canonical', () => {
    const seo = TestBed.inject(SeoService);
    seo.set({
      title: 'Guides',
      description: 'How to get the most out of DashDash.',
      path: '/guides',
    });

    expect(TestBed.inject(Title).getTitle()).toBe('Guides · DashDash');
    const desc = TestBed.inject(Meta).getTag('name="description"');
    expect(desc?.content).toBe('How to get the most out of DashDash.');
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://dashdash.app/guides');
  });
});
