import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi } from 'vitest';
import { TryPageComponent } from './try-page.component';
import { provideAnonymousDashboardSource } from './anonymous-dashboard.store';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';

function configure() {
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
}

function render() {
  configure();
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

  it('pings the extension bridge, so installed cells frame instead of asking to install', async () => {
    configure();
    const bridge = TestBed.inject(ExtensionBridgeService);
    const pingSpy = vi.spyOn(bridge, 'ping').mockResolvedValue(true);
    const f = TestBed.createComponent(TryPageComponent);
    f.detectChanges();
    await f.whenStable();
    expect(pingSpy).toHaveBeenCalled();
  });

  it('renders the compact intro strip with the h1 and the register CTA', () => {
    const f = render();
    const strip = f.nativeElement.querySelector('[data-testid="try-strip"]') as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.querySelector('h1')?.textContent).toContain('Try TulipLot without an account');
    expect(strip.querySelector('a[href="/register"]')).not.toBeNull();
  });

  it('wraps the grid in a flex grid area below the strip', () => {
    const f = render();
    const area = f.nativeElement.querySelector('[data-testid="try-grid-area"]') as HTMLElement;
    expect(area).not.toBeNull();
    expect(area.querySelector('tl-grid')).not.toBeNull();
  });
});
