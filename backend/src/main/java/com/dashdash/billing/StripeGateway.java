package com.dashdash.billing;

/**
 * Thin, mockable seam over the stripe-java SDK. All raw Stripe calls live behind this
 * interface so services stay unit-testable. Extended by Tasks 3–5.
 */
public interface StripeGateway {

  /** Create a Stripe Customer and return its id. */
  String createCustomer(String email, String userId);

  /** Create a subscription-mode Checkout Session and return its hosted URL. */
  String createCheckoutSessionUrl(String customerId, String userId, String priceId,
                                  String successUrl, String cancelUrl);
}
