package com.tuliplot.billing;

import java.time.Instant;

/** License state fetched from the Freemius API. expiration == null means lifetime. */
public record FreemiusLicenseSnapshot(
    String licenseId, String planId, String userId, Instant expiration, boolean cancelled) {}
