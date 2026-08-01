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
});
