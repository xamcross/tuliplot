import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FreemiusCheckoutService } from './freemius-checkout.service';

describe('FreemiusCheckoutService', () => {
  let service: FreemiusCheckoutService;
  const openSpy = vi.fn();
  const ctorSpy = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FreemiusCheckoutService);
    ctorSpy.mockClear();
    openSpy.mockClear();
    (window as any).FS = {
      Checkout: class {
        constructor(opts: unknown) { ctorSpy(opts); }
        open(opts: unknown) { openSpy(opts); }
      },
    };
  });

  afterEach(() => {
    delete (window as any).FS;
    document.querySelectorAll('script[src*="checkout.freemius.com"]').forEach(tag => tag.remove());
  });

  it('constructs FS.Checkout with the product, plan, and public key, and locks the email', async () => {
    await service.open('user@example.com', () => {});
    expect(ctorSpy).toHaveBeenCalledWith({
      product_id: 37109,
      plan_id: 61603,
      public_key: 'pk_dd68d3c56014484d645d69d91d734',
    });
    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_email: 'user@example.com',
      readonly_user: true,
      success: expect.any(Function),
    }));
  });

  it('does not inject the script tag when FS is already present', async () => {
    const before = document.querySelectorAll('script[src*="checkout.freemius.com"]').length;
    await service.open('user@example.com', () => {});
    const after = document.querySelectorAll('script[src*="checkout.freemius.com"]').length;
    expect(after).toBe(before);
  });

  it('invokes the success callback from the overlay success handler', async () => {
    const onSuccess = vi.fn();
    await service.open('user@example.com', onSuccess);
    const opts = openSpy.mock.calls[0][0] as { success: () => void };
    opts.success();
    expect(onSuccess).toHaveBeenCalled();
  });

  describe('script injection', () => {
    let injectionService: FreemiusCheckoutService;

    beforeEach(() => {
      // Create a fresh service instance (not singleton) for testing script injection
      injectionService = new FreemiusCheckoutService();
      // Do NOT set up window.FS for these tests
      if ((window as any).FS) {
        delete (window as any).FS;
      }
    });

    afterEach(() => {
      if ((window as any).FS) {
        delete (window as any).FS;
      }
      document.querySelectorAll('script[src*="checkout.freemius.com"]').forEach(tag => tag.remove());
    });

    it('injects the script once and resolves when it loads', async () => {
      const openPromise = injectionService.open('user@example.com', () => {});

      // Verify script was injected
      let scriptElements = document.querySelectorAll('script[src*="checkout.freemius.com"]');
      expect(scriptElements.length).toBe(1);
      const scriptElement = scriptElements[0] as HTMLScriptElement;

      // Start a second call while the first is pending to test single-flight
      const openPromise2 = injectionService.open('user2@example.com', () => {});

      // Assert no second tag was appended (single-flight caching)
      scriptElements = document.querySelectorAll('script[src*="checkout.freemius.com"]');
      expect(scriptElements.length).toBe(1);

      // Set up the fake FS
      const ctorSpy2 = vi.fn();
      const openSpy2 = vi.fn();
      (window as any).FS = {
        Checkout: class {
          constructor(opts: unknown) { ctorSpy2(opts); }
          open(opts: unknown) { openSpy2(opts); }
        },
      };

      // Trigger the load event on the script element
      try {
        scriptElement.dispatchEvent(new Event('load'));
      } catch {
        // If dispatchEvent doesn't trigger onload in this environment, call it directly
        if (scriptElement.onload) {
          scriptElement.onload(new Event('load'));
        }
      }

      // Wait for both promises to resolve
      await openPromise;
      await openPromise2;

      // Verify FS.Checkout was constructed and opened
      expect(ctorSpy2).toHaveBeenCalledWith({
        product_id: 37109,
        plan_id: 61603,
        public_key: 'pk_dd68d3c56014484d645d69d91d734',
      });
      expect(openSpy2.mock.calls.length).toBe(2); // Called for both open() calls
    });

    it('removes the failed tag so a retry injects a fresh one', async () => {
      const openPromise = injectionService.open('user@example.com', () => {});

      // Verify script was injected
      let scriptElements = document.querySelectorAll('script[src*="checkout.freemius.com"]');
      expect(scriptElements.length).toBe(1);
      const scriptElement = scriptElements[0] as HTMLScriptElement;

      // Trigger the error event
      try {
        scriptElement.dispatchEvent(new Event('error'));
      } catch {
        // If dispatchEvent doesn't trigger onerror in this environment, call it directly
        if (scriptElement.onerror) {
          scriptElement.onerror(new Event('error'));
        }
      }

      // Wait for the promise to reject
      await expect(openPromise).rejects.toThrow('freemius checkout script failed to load');

      // Assert the failed tag was removed
      scriptElements = document.querySelectorAll('script[src*="checkout.freemius.com"]');
      expect(scriptElements.length).toBe(0);

      // Retry without FS: script should be injected again (fresh single tag)
      const retryPromise = injectionService.open('user@example.com', () => {});

      // Verify a fresh single tag was injected (not two)
      scriptElements = document.querySelectorAll('script[src*="checkout.freemius.com"]');
      expect(scriptElements.length).toBe(1);

      const freshScriptElement = scriptElements[0] as HTMLScriptElement;

      // Now set up FS to simulate successful load
      const ctorSpy2 = vi.fn();
      const openSpy2 = vi.fn();
      (window as any).FS = {
        Checkout: class {
          constructor(opts: unknown) { ctorSpy2(opts); }
          open(opts: unknown) { openSpy2(opts); }
        },
      };

      // Trigger load on the fresh tag
      try {
        freshScriptElement.dispatchEvent(new Event('load'));
      } catch {
        if (freshScriptElement.onload) {
          freshScriptElement.onload(new Event('load'));
        }
      }

      await retryPromise;

      // Verify FS.Checkout was constructed and opened on the retry
      expect(ctorSpy2).toHaveBeenCalledWith({
        product_id: 37109,
        plan_id: 61603,
        public_key: 'pk_dd68d3c56014484d645d69d91d734',
      });
      expect(openSpy2).toHaveBeenCalled();
    });
  });
});
