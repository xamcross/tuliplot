import { Injectable, signal } from '@angular/core';

/** Chrome Web Store listing for the DashDash Companion extension. */
export const EXTENSION_WEBSTORE_URL = 'https://chromewebstore.google.com/search/DashDash%20Companion';

interface ExtMessage {
  source?: string;
  type?: string;
  version?: string;
  origin?: string;
  granted?: boolean;
}

const PING_TIMEOUT_MS = 500;

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
        if (event.source !== window || !data || data.source !== 'dashdash-ext' || data.type !== 'PONG') {
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
      window.postMessage({ source: 'dashdash', type: 'PING' }, window.location.origin);
    });
  }

  /** Posts REQUEST_HOST for `origin`; resolves with the granted flag from HOST_RESULT. */
  requestHost(origin: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const listener = (event: MessageEvent): void => {
        const data = event.data as ExtMessage;
        if (
          event.source !== window ||
          !data ||
          data.source !== 'dashdash-ext' ||
          data.type !== 'HOST_RESULT' ||
          data.origin !== origin
        ) {
          return;
        }
        window.removeEventListener('message', listener);
        resolve(!!data.granted);
      };

      window.addEventListener('message', listener);
      window.postMessage({ source: 'dashdash', type: 'REQUEST_HOST', origin }, window.location.origin);
    });
  }
}
