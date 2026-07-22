import { Injectable } from '@angular/core';

/** Detects whether the current browser is Chromium-based (Chrome/Edge/Chromium). */
@Injectable({ providedIn: 'root' })
export class BrowserDetectService {
  isChromium(): boolean {
    const nav = globalThis.navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand: string }> };
    };
    const brands = nav?.userAgentData?.brands;
    if (brands && brands.length > 0) {
      return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
    }
    const ua = nav?.userAgent ?? '';
    // Firefox/Safari user-agents do not contain "Chrome"/"Chromium".
    return /Chrom(e|ium)/i.test(ua);
  }
}
