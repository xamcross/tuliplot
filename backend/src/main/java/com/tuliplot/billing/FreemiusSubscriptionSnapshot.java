package com.tuliplot.billing;

import java.time.Instant;

/** Renewal state of the subscription behind a license. Every field is nullable. */
public record FreemiusSubscriptionSnapshot(
    Instant trialEnds, Instant nextPayment, Instant canceledAt) {}
