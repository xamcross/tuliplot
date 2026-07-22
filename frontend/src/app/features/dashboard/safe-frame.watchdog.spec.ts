import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SafeFrameComponent } from './safe-frame.component';

describe('SafeFrameComponent load watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits loadFailed when no load event arrives within 4s', () => {
    const fixture = TestBed.createComponent(SafeFrameComponent);
    fixture.componentRef.setInput('url', 'https://example.com');
    fixture.componentRef.setInput('asleep', false);
    let failed = 0;
    fixture.componentInstance.loadFailed.subscribe(() => (failed += 1));

    fixture.detectChanges(); // runs the constructor effect → starts the watchdog
    vi.advanceTimersByTime(4000);

    expect(failed).toBe(1);
  });

  it('does not emit loadFailed when the frame reports load in time', () => {
    const fixture = TestBed.createComponent(SafeFrameComponent);
    fixture.componentRef.setInput('url', 'https://example.com');
    fixture.componentRef.setInput('asleep', false);
    let failed = 0;
    fixture.componentInstance.loadFailed.subscribe(() => (failed += 1));

    fixture.detectChanges();
    fixture.componentInstance.onFrameLoad();
    vi.advanceTimersByTime(4000);

    expect(failed).toBe(0);
  });

  it('does not start a watchdog while asleep', () => {
    const fixture = TestBed.createComponent(SafeFrameComponent);
    fixture.componentRef.setInput('url', 'https://example.com');
    fixture.componentRef.setInput('asleep', true);
    let failed = 0;
    fixture.componentInstance.loadFailed.subscribe(() => (failed += 1));

    fixture.detectChanges();
    vi.advanceTimersByTime(4000);

    expect(failed).toBe(0);
  });
});
