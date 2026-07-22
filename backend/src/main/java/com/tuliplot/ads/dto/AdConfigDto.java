package com.tuliplot.ads.dto;

/**
 * Ad configuration for the current user.
 * showAd == !UserService.isPremium(user) (premium == subscription status in
 * {ACTIVE, TRIALING}; computed from status, not the denormalized tier field).
 * adClient/adSlot come from ADSENSE_CLIENT/ADSENSE_SLOT (bound in application.yml),
 * empty strings until AdSense is approved.
 */
public record AdConfigDto(boolean showAd, String adClient, String adSlot) {}
