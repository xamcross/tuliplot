import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  it('renders the hero headline and a CTA to sign up', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Everything you check all day, on one calm screen');
    expect(fixture.nativeElement.querySelector('a[href="/register"]'))
      .toBeTruthy();
  });

  it('emits JSON-LD with FAQPage and SoftwareApplication', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const script = document.getElementById('tl-jsonld');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? '[]') as Array<{ '@type': string }>;
    const types = data.map((d) => d['@type']);
    expect(types).toContain('FAQPage');
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
  });

  it('renders the FAQ from the same source as the FAQPage JSON-LD', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const summaries = Array.from(document.querySelectorAll('.faq summary')).map((s) => s.textContent?.trim());
    const jsonLd = JSON.parse(document.getElementById('tl-jsonld')!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const faq = jsonLd.find((d) => d['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string }> };
    expect(summaries.length).toBe(4);
    expect(faq.mainEntity.map((m) => m.name)).toEqual(summaries);
  });

  it('emits an Organization with @id, sameAs, PNG logo, and description; WebSite and SoftwareApplication reference it', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const data = JSON.parse(document.getElementById('tl-jsonld')!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const org = data.find((d) => d['@type'] === 'Organization')!;
    expect(org['@id']).toBe('https://tuliplot.com/#org');
    expect(org['logo']).toBe('https://tuliplot.com/logo-512.png');
    expect(org['sameAs']).toEqual(['https://github.com/xamcross/tuliplot']);
    expect(org['description']).toContain('browser dashboard');
    expect((org['contactPoint'] as Array<Record<string, string>>)[0]['url']).toBe('https://tuliplot.com/contact/');

    const site = data.find((d) => d['@type'] === 'WebSite')!;
    expect((site['publisher'] as Record<string, string>)['@id']).toBe('https://tuliplot.com/#org');

    const app = data.find((d) => d['@type'] === 'SoftwareApplication')!;
    expect(app['url']).toBe('https://tuliplot.com/');
    expect(app['image']).toBe('https://tuliplot.com/og-card.png');
    const offers = app['offers'] as Array<Record<string, string>>;
    expect(offers.map((o) => o['name'])).toEqual(['Free', 'Premium']);
    expect(offers[1]['price']).toBe('4');
    expect(offers[1]['priceCurrency']).toBe('USD');
  });
});
