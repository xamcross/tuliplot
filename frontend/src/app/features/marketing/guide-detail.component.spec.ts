import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
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
  it('emits Article JSON-LD for the current guide', () => {
    render(GUIDES[0].slug);
    const script = document.getElementById('tl-jsonld');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const article = data.find((d) => d['@type'] === 'Article');
    expect(article?.['headline']).toBe(GUIDES[0].title);
    expect(article?.['datePublished']).toBe(GUIDES[0].date);
  });
});
