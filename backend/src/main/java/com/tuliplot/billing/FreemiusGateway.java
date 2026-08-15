package com.tuliplot.billing;

public interface FreemiusGateway {
  FreemiusLicenseSnapshot retrieveLicense(String licenseId);
  FreemiusSubscriptionSnapshot retrieveSubscription(String licenseId);
  String retrieveUserEmail(String userId);
  String createPortalLoginUrl(String email);
}
