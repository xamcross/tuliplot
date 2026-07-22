import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

// EEA + UK + Switzerland: regions where Consent Mode v2 defaults to denied and
// the CMP must collect consent before advertising loads.
const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
];

interface TcData {
  gdprApplies?: boolean;
  eventStatus?: string;
  purpose?: { consents?: Record<number, boolean> };
}

type Win = typeof window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __tcfapi?: (
    command: string,
    version: number,
    cb: (data: TcData, success: boolean) => void,
  ) => void;
  adsbygoogle?: unknown[];
};

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly _granted = signal(false);
  readonly consentGranted = this._granted.asReadonly();

  private initialized = false;
  private adsScriptLoaded = false;
  private tcfPollTimer: ReturnType<typeof setInterval> | null = null;

  /** Idempotent; no-op during prerender (no document/window). */
  init(): void {
    if (
      this.initialized ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return;
    }
    this.initialized = true;
    this.setConsentDefaults();
    this.loadCmp();
    this.registerTcfListener();
  }

  private setConsentDefaults(): void {
    const w = window as Win;
    w.dataLayer = w.dataLayer || [];
    const gtag =
      w.gtag ?? ((...args: unknown[]) => (w.dataLayer as unknown[]).push(args));
    w.gtag = gtag;
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500,
      region: CONSENT_REGIONS,
    });
  }

  private loadCmp(): void {
    if (!environment.adsenseClient) return;
    const s = document.createElement('script');
    s.async = true;
    s.src =
      `https://fundingchoicesmessages.google.com/i/` +
      `${environment.adsenseClient}?ers=1`;
    document.head.appendChild(s);
  }

  private registerTcfListener(): void {
    const w = window as Win;
    if (typeof w.__tcfapi === 'function') {
      this.addTcfListener();
      return;
    }
    // CMP not ready yet — poll briefly for the __tcfapi stub.
    let tries = 0;
    this.tcfPollTimer = setInterval(() => {
      tries += 1;
      if (typeof (window as Win).__tcfapi === 'function') {
        this.clearPoll();
        this.addTcfListener();
      } else if (tries > 40) {
        this.clearPoll();
      }
    }, 250);
  }

  private clearPoll(): void {
    if (this.tcfPollTimer !== null) {
      clearInterval(this.tcfPollTimer);
      this.tcfPollTimer = null;
    }
  }

  private addTcfListener(): void {
    const w = window as Win;
    w.__tcfapi?.('addEventListener', 2, (data, success) => {
      if (success) this.handleTcData(data);
    });
  }

  /** Public for testability; decides whether the TCF signal grants consent. */
  handleTcData(tcData: TcData | null | undefined): void {
    if (!tcData) return;
    if (tcData.gdprApplies === false) {
      this.grantConsent();
      return;
    }
    const done =
      tcData.eventStatus === 'tcloaded' ||
      tcData.eventStatus === 'useractioncomplete';
    const purpose1 = !!tcData.purpose?.consents?.[1];
    if (done && purpose1) this.grantConsent();
  }

  grantConsent(): void {
    if (!this._granted()) this._granted.set(true);
    const w = window as Win;
    w.gtag?.('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    this.loadAdsScript();
  }

  private loadAdsScript(): void {
    if (this.adsScriptLoaded || !environment.adsenseClient) return;
    if (typeof document === 'undefined') return;
    this.adsScriptLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src =
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=` +
      `${environment.adsenseClient}`;
    document.head.appendChild(s);
  }
}
