import { Injectable, signal } from '@angular/core';

/** Chrome Web Store listing for the TulipLot Companion extension. */
export const EXTENSION_WEBSTORE_URL = 'https://chromewebstore.google.com/search/TulipLot%20Companion';

interface ExtMessage {
  source?: string;
  type?: string;
  version?: string;
  origin?: string;
  granted?: boolean;
}

const PING_TIMEOUT_MS = 500;
// Host-permission prompts require a user gesture and can be slow to answer.
const REQUEST_HOST_TIMEOUT_MS = 60000;
// A 1.0.x extension does not answer CHECK_HOST; time out fast and treat as not granted.
const CHECK_HOST_TIMEOUT_MS = 1000;

@Injectable({ providedIn: 'root' })
export class ExtensionBridgeService {
  readonly installed = signal<boolean>(false);
  readonly version = signal<string | null>(null);

  /** Posts PING; resolves true on PONG, or false after 500ms with no PONG. */
  ping(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const listener = (event: MessageEvent): void => {
        const data = event.data as ExtMessage;
        if (event.source !== window || !data || data.source !== 'tuliplot-ext' || data.type !== 'PONG') {
          return;
        }
        settled = true;
        window.removeEventListener('message', listener);
        clearTimeout(timer);
        this.installed.set(true);
        this.version.set(data.version ?? null);
        resolve(true);
      };

      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        window.removeEventListener('message', listener);
        this.installed.set(false);
        resolve(false);
      }, PING_TIMEOUT_MS);

      window.addEventListener('message', listener);
      window.postMessage({ source: 'tuliplot', type: 'PING' }, window.location.origin);
    });
  }

  /** Posts REQUEST_HOST for `origin`; resolves with the granted flag from HOST_RESULT. */
  requestHost(origin: string): Promise<boolean> {
    return this.askGranted('REQUEST_HOST', 'HOST_RESULT', origin, REQUEST_HOST_TIMEOUT_MS);
  }

  /** Posts CHECK_HOST for `origin`; resolves with the granted flag from HOST_STATUS. */
  checkHost(origin: string): Promise<boolean> {
    return this.askGranted('CHECK_HOST', 'HOST_STATUS', origin, CHECK_HOST_TIMEOUT_MS);
  }

  /** Posts `type` for `origin`; resolves the granted flag from `responseType`, or false on timeout. */
  private askGranted(type: string, responseType: string, origin: string, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const listener = (event: MessageEvent): void => {
        const data = event.data as ExtMessage;
        if (
          event.source !== window ||
          !data ||
          data.source !== 'tuliplot-ext' ||
          data.type !== responseType ||
          data.origin !== origin
        ) {
          return;
        }
        settled = true;
        window.removeEventListener('message', listener);
        clearTimeout(timer);
        resolve(!!data.granted);
      };

      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        window.removeEventListener('message', listener);
        resolve(false);
      }, timeoutMs);

      window.addEventListener('message', listener);
      window.postMessage({ source: 'tuliplot', type, origin }, window.location.origin);
    });
  }
}
