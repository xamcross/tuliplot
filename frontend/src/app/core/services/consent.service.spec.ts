import { TestBed } from '@angular/core/testing';
import { ConsentService } from './consent.service';
import { environment } from '../../../environments/environment';

function adsScript(): Element | null {
  return document.head.querySelector('script[src*="adsbygoogle.js"]');
}

describe('ConsentService', () => {
  let originalClient: string;

  beforeEach(() => {
    originalClient = environment.adsenseClient;
    (environment as { adsenseClient: string }).adsenseClient = 'ca-pub-test';
    document.head
      .querySelectorAll('script')
      .forEach((s) => s.remove());
    (window as unknown as { adsbygoogle?: unknown }).adsbygoogle = undefined;
  });

  afterEach(() => {
    (environment as { adsenseClient: string }).adsenseClient = originalClient;
  });

  it('does not load adsbygoogle before consent', () => {
    const svc = TestBed.inject(ConsentService);
    svc.init();
    expect(adsScript()).toBeNull();
    expect(svc.consentGranted()).toBe(false);
  });

  it('loads adsbygoogle after consent is granted', () => {
    const svc = TestBed.inject(ConsentService);
    svc.grantConsent();
    expect(svc.consentGranted()).toBe(true);
    expect(adsScript()).not.toBeNull();
  });

  it('loads adsbygoogle only once even if consent is granted twice', () => {
    const svc = TestBed.inject(ConsentService);
    svc.grantConsent();
    svc.grantConsent();
    expect(
      document.head.querySelectorAll('script[src*="adsbygoogle.js"]').length,
    ).toBe(1);
  });

  it('grants consent when the TCF signal reports GDPR does not apply', () => {
    const svc = TestBed.inject(ConsentService);
    svc.handleTcData({ gdprApplies: false });
    expect(svc.consentGranted()).toBe(true);
  });

  it('grants consent when purpose 1 is consented after a user action', () => {
    const svc = TestBed.inject(ConsentService);
    svc.handleTcData({
      gdprApplies: true,
      eventStatus: 'useractioncomplete',
      purpose: { consents: { 1: true } },
    });
    expect(svc.consentGranted()).toBe(true);
  });
});
