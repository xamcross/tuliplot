package com.tuliplot.billing;

/** Immutable projection of the Stripe fields we persist, decoupling services from SDK model shape. */
public record StripeSubscriptionSnapshot(
    String subscriptionId,
    String customerId,
    String status,             // raw Stripe status string, e.g. "active"
    String priceId,
    Long currentPeriodEnd,     // epoch seconds; may be null
    boolean cancelAtPeriodEnd) {
}
