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

  /** Create a Billing Portal session and return its hosted URL. */
  String createPortalSessionUrl(String customerId, String returnUrl);

  /** Verify the raw webhook body against the signature and parse it into an Event. */
  com.stripe.model.Event constructEvent(byte[] payload, String signatureHeader, String webhookSecret)
      throws com.stripe.exception.SignatureVerificationException;

  /** Re-fetch the subscription and project the fields we persist. */
  StripeSubscriptionSnapshot retrieveSubscription(String subscriptionId);

  /** Resolve the Stripe customer id that owns a charge (for dispute handling); null if none. */
  String retrieveChargeCustomerId(String chargeId);
}
