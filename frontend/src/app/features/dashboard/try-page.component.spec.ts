import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect } from 'vitest';
import { TryPageComponent } from './try-page.component';
import { provideAnonymousDashboardSource } from './anonymous-dashboard.store';

function render() {
  TestBed.configureTestingModule({
    imports: [TryPageComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnonymousDashboardSource(),
    ],
  });
  const f = TestBed.createComponent(TryPageComponent);
  f.detectChanges();
  return f;
}

describe('TryPageComponent', () => {
  it('renders a six-cell grid with three locked cells', () => {
    const f = render();
    expect(f.nativeElement.querySelectorAll('tl-cell').length).toBe(6);
    expect(f.nativeElement.querySelectorAll('[data-testid="locked-cell"]').length).toBe(3);
  });

  it('sets its own page title', () => {
    render();
    expect(document.title).toBe('Try TulipLot — no account needed · TulipLot');
  });
});
