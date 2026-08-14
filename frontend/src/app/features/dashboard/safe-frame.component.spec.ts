import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { SafeFrameComponent } from './safe-frame.component';

function setup(url: string, asleep = false) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const f = TestBed.createComponent(SafeFrameComponent);
  f.componentRef.setInput('url', url);
  f.componentRef.setInput('asleep', asleep);
  return f;
}

describe('SafeFrameComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not render an iframe for an unsafe url', () => {
    const f = setup('javascript:alert(1)');
    vi.advanceTimersByTime(300);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();
  });

  it('renders an iframe for a safe https url only after the staggered mount', () => {
    const f = setup('https://example.com');
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();

    vi.advanceTimersByTime(300);
    f.detectChanges();
    const iframe = f.nativeElement.querySelector('[data-testid="app-iframe"]') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads',
    );
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation');
  });

  it('removes the iframe when asleep and shows a placeholder', () => {
    const f = setup('https://example.com', true);
    vi.advanceTimersByTime(300);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="asleep-placeholder"]')).not.toBeNull();
  });

  it('reload() changes the iframe src', () => {
    const f = setup('https://example.com');
    vi.advanceTimersByTime(300);
    f.detectChanges();
    const before = f.nativeElement.querySelector('[data-testid="app-iframe"]').getAttribute('src');

    f.componentInstance.reload();
    f.detectChanges();
    const after = f.nativeElement.querySelector('[data-testid="app-iframe"]').getAttribute('src');

    expect(after).not.toBe(before);
    expect(after).toContain('_tl=1');
  });
});
