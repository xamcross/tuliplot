package com.tuliplot.billing;

/** Raised when a billing action needs a Stripe customer but the user has none yet. */
public class NoStripeCustomerException extends RuntimeException {
  public NoStripeCustomerException(String userId) {
    super("No Stripe customer for user " + userId);
  }
}
