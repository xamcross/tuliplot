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

  afterEach(() => { delete (window as any).FS; });

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
});
