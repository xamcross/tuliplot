import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AdCellComponent } from './ad-cell.component';
import { ConsentService } from '../../core/services/consent.service';
import { AuthStore } from '../../stores/auth.store';

function consentStub(granted: boolean) {
  return { provide: ConsentService, useValue: { consentGranted: signal(granted) } };
}

// AdCellComponent is shared verbatim between /app (always authenticated, authGuard-protected)
// and /try (always anonymous, no login flow exists there). Existing tests below predate the
// auth-aware promo and implicitly exercised the /app case, so they now pin that explicitly.
function authStub(authenticated: boolean) {
  return { provide: AuthStore, useValue: { isAuthenticated: signal(authenticated) } };
}

describe('AdCellComponent', () => {
  it('renders nothing when showAd is false (Premium)', async () => {
    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(true), authStub(true)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: false, adClient: 'ca-pub-1', adSlot: '5',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ad-cell')).toBeNull();
  });

  it('shows the house upgrade promo when adClient is empty', async () => {
    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(true), authStub(true)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: true, adClient: '', adSlot: '',
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Remove ad — go Premium');
    expect(el.querySelector('ins.adsbygoogle')).toBeNull();
    expect(el.querySelector('[aria-label="Advertisements"]')).toBeTruthy();
  });

  it('shows the house promo when consent is absent even with an adClient', async () => {
    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(false), authStub(true)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: true, adClient: 'ca-pub-1', adSlot: '5',
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ins.adsbygoogle')).toBeNull();
    expect(el.textContent).toContain('Remove ad — go Premium');
  });

  it('creates an <ins> and pushes exactly once when adClient present + consent granted', async () => {
    const pushSpy = vi.fn();
    (window as unknown as { adsbygoogle?: unknown }).adsbygoogle = { push: pushSpy };

    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(true), authStub(true)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: true, adClient: 'ca-pub-1', adSlot: '5',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const ins = fixture.nativeElement.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins).toBeTruthy();
    expect(ins.getAttribute('data-ad-client')).toBe('ca-pub-1');
    expect(ins.getAttribute('data-ad-slot')).toBe('5');
    expect(ins.getAttribute('data-full-width-responsive')).toBe('false');
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  describe('signed-out visitor (/try)', () => {
    it('shows a /register CTA instead of /app/upgrade, and never mentions Premium', async () => {
      await TestBed.configureTestingModule({
        imports: [AdCellComponent],
        providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(true), authStub(false)],
      }).compileComponents();

      const fixture = TestBed.createComponent(AdCellComponent);
      fixture.componentRef.setInput('config', {
        showAd: true, adClient: '', adSlot: '',
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const link = el.querySelector('a.ad-cell__promo') as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/register');
      expect(el.textContent).toContain('Get all five cells free');
      expect(el.textContent).not.toContain('Remove ad — go Premium');
      expect(el.querySelector('a[href="/app/upgrade"]')).toBeNull();
    });

    it('still shows the house promo (not a live ad) when consent is absent', async () => {
      await TestBed.configureTestingModule({
        imports: [AdCellComponent],
        providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(false), authStub(false)],
      }).compileComponents();

      const fixture = TestBed.createComponent(AdCellComponent);
      fixture.componentRef.setInput('config', {
        showAd: true, adClient: 'ca-pub-1', adSlot: '5',
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('ins.adsbygoogle')).toBeNull();
      expect(el.querySelector('a[href="/register"]')).toBeTruthy();
    });
  });
});
