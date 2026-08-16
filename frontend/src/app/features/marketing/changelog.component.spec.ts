import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { ChangelogComponent } from './changelog.component';
import { CHANGELOG } from './content.generated';

describe('ChangelogComponent', () => {
  it('renders the H1, every entry heading with a <time>, and sets the title', async () => {
    await TestBed.configureTestingModule({
      imports: [ChangelogComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(ChangelogComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toBe('Changelog');
    const times = Array.from(el.querySelectorAll('article h2 time')).map((t) => t.getAttribute('datetime'));
    expect(times[0]).toBe(CHANGELOG.updated);
    expect(times.length).toBeGreaterThanOrEqual(2);
    expect(document.title).toBe('Changelog — what changed on TulipLot · TulipLot');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://tuliplot.com/changelog/');
  });
});
