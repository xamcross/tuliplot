import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { NotFoundComponent } from './not-found.component';

function render() {
  TestBed.configureTestingModule({
    imports: [NotFoundComponent],
    providers: [provideZonelessChangeDetection(), provideRouter([])],
  });
  const f = TestBed.createComponent(NotFoundComponent);
  f.detectChanges();
  return f;
}

describe('NotFoundComponent', () => {
  it('renders the not-found message with a home link', () => {
    const f = render();
    expect(f.nativeElement.textContent).toContain('Page not found');
    expect(f.nativeElement.querySelector('a[href="/"]')).not.toBeNull();
  });

  it('resets the head: title set, stale JSON-LD removed', () => {
    // Simulate arriving from a page that had structured data.
    const stale = document.createElement('script');
    stale.id = 'tl-jsonld';
    stale.setAttribute('type', 'application/ld+json');
    stale.textContent = '[{"@type":"Article"}]';
    document.head.appendChild(stale);

    render();

    expect(TestBed.inject(Title).getTitle()).toBe('Page not found · TulipLot');
    expect(document.getElementById('tl-jsonld')).toBeNull();
  });
});
