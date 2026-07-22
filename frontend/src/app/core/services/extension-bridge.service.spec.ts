import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExtensionBridgeService } from './extension-bridge.service';

describe('ExtensionBridgeService', () => {
  let service: ExtensionBridgeService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ExtensionBridgeService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('ping() resolves true and records installed + version on PONG', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      if ((msg as { type: string }).type === 'PING') {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'PONG', version: '1.0.0' },
            source: window,
          }),
        );
      }
    }) as typeof window.postMessage);

    const result = await service.ping();

    expect(result).toBe(true);
    expect(service.installed()).toBe(true);
    expect(service.version()).toBe('1.0.0');
  });

  it('ping() resolves false and clears installed after the 500ms timeout', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((() => {
      /* no PONG ever arrives */
    }) as typeof window.postMessage);

    const pending = service.ping();
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;

    expect(result).toBe(false);
    expect(service.installed()).toBe(false);
  });

  it('ping() ignores the page echo of its own PING message', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      // Echo the page->ext PING back on the bus (source 'dashdash'); must be ignored.
      window.dispatchEvent(new MessageEvent('message', { data: msg, source: window }));
    }) as typeof window.postMessage);

    const pending = service.ping();
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBe(false);
  });

  it('requestHost() resolves with granted from HOST_RESULT', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      const m = msg as { type: string; origin: string };
      if (m.type === 'REQUEST_HOST') {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'HOST_RESULT', origin: m.origin, granted: true },
            source: window,
          }),
        );
      }
    }) as typeof window.postMessage);

    const result = await service.requestHost('https://mail.google.com');
    expect(result).toBe(true);
  });

  it('requestHost() resolves false and removes its listener after the timeout', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((() => {
      /* no HOST_RESULT ever arrives */
    }) as typeof window.postMessage);
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const pending = service.requestHost('https://mail.google.com');
    await vi.advanceTimersByTimeAsync(60000);
    const result = await pending;

    expect(result).toBe(false);
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('requestHost() only resolves for its own origin', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(((msg: unknown) => {
      const m = msg as { type: string; origin: string };
      if (m.type === 'REQUEST_HOST') {
        // Response for a DIFFERENT origin must be ignored.
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'HOST_RESULT', origin: 'https://other.example', granted: true },
            source: window,
          }),
        );
        // Then the correct one.
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { source: 'dashdash-ext', type: 'HOST_RESULT', origin: m.origin, granted: false },
            source: window,
          }),
        );
      }
    }) as typeof window.postMessage);

    const result = await service.requestHost('https://mail.google.com');
    expect(result).toBe(false);
  });
});
