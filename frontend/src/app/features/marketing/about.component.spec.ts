import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { AboutComponent } from './about.component';
import { SITE } from '../../core/site-identity';

describe('AboutComponent', () => {
  it('opens with the canonical sentence and links the GitHub repository', async () => {
    await TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(AboutComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.tl-lead')?.textContent?.replace(/\s+/g, ' ').trim().startsWith(SITE.sentence)).toBe(true);
    const gh = el.querySelector('a[href="https://github.com/xamcross/tuliplot"]');
    expect(gh).toBeTruthy();
    expect(gh?.getAttribute('rel')).toBe('noopener');
  });
});
