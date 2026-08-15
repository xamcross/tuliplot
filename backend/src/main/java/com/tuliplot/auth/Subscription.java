package com.tuliplot.auth;

import java.time.Instant;

public class Subscription {

    private Tier tier = Tier.FREE;
    private String fsLicenseId;
    private SubStatus status = SubStatus.NONE;
    private String priceId;
    private Instant currentPeriodEnd;
    private boolean cancelAtPeriodEnd = false;

    public Tier getTier() { return tier; }
    public void setTier(Tier tier) { this.tier = tier; }

    public String getFsLicenseId() { return fsLicenseId; }
    public void setFsLicenseId(String fsLicenseId) { this.fsLicenseId = fsLicenseId; }

    public SubStatus getStatus() { return status; }
    public void setStatus(SubStatus status) { this.status = status; }

    public String getPriceId() { return priceId; }
    public void setPriceId(String priceId) { this.priceId = priceId; }

    public Instant getCurrentPeriodEnd() { return currentPeriodEnd; }
    public void setCurrentPeriodEnd(Instant currentPeriodEnd) { this.currentPeriodEnd = currentPeriodEnd; }

    public boolean isCancelAtPeriodEnd() { return cancelAtPeriodEnd; }
    public void setCancelAtPeriodEnd(boolean cancelAtPeriodEnd) { this.cancelAtPeriodEnd = cancelAtPeriodEnd; }
}
