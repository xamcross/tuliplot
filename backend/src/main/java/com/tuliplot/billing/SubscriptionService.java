package com.tuliplot.billing;

import com.tuliplot.auth.SubStatus;
import com.tuliplot.auth.Subscription;
import com.tuliplot.auth.Tier;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.dashboard.Dashboard;
import com.tuliplot.dashboard.DashboardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class SubscriptionService {

  private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

  private final ProcessedBillingEventRepository processedEvents;
  private final FreemiusGateway gateway;
  private final UserRepository userRepository;
  private final DashboardService dashboardService;

  public SubscriptionService(ProcessedBillingEventRepository processedEvents,
                             FreemiusGateway gateway,
                             UserRepository userRepository,
                             DashboardService dashboardService) {
    this.processedEvents = processedEvents;
    this.gateway = gateway;
    this.userRepository = userRepository;
    this.dashboardService = dashboardService;
  }

  // ---- idempotency ----------------------------------------------------------

  public boolean alreadyProcessed(String eventId) {
    return processedEvents.existsById(eventId);
  }

  public void markProcessed(String eventId, String type) {
    ProcessedBillingEvent e = new ProcessedBillingEvent();
    e.setId(eventId);
    e.setType(type);
    e.setProcessedAt(Instant.now());
    processedEvents.save(e);
  }

  // ---- state transitions ----------------------------------------------------

  /**
   * Fetch the license from the Freemius API and resync the user's tier from it.
   * The webhook payload is only a trigger; the API is the source of truth.
   * A 404 means the license was deleted — revoke via the stored license id.
   */
  public void applyLicense(String licenseId) {
    FreemiusLicenseSnapshot license;
    try {
      license = gateway.retrieveLicense(licenseId);
    } catch (FreemiusNotFoundException e) {
      revokeByLicenseId(licenseId);
      return;
    }
    FreemiusSubscriptionSnapshot subscription = gateway.retrieveSubscription(licenseId);
    String email = gateway.retrieveUserEmail(license.userId());

    User user = userRepository.findByEmail(email)
        .or(() -> userRepository.findBySubscriptionFsLicenseId(licenseId))
        .orElse(null);
    if (user == null) {
      // A 4xx would make Freemius retry a permanently unmatchable event; ack and log instead.
      log.warn("freemius license {} matches no account (email from API: {})", licenseId, email);
      return;
    }

    Instant now = Instant.now();
    boolean expired = license.expiration() != null && license.expiration().isBefore(now);
    boolean inTrial = subscription.trialEnds() != null && now.isBefore(subscription.trialEnds());

    SubStatus status;
    if (expired) {
      status = SubStatus.CANCELED;
    } else if (inTrial) {
      status = SubStatus.TRIALING;
    } else {
      status = SubStatus.ACTIVE;
    }
    boolean premium = status == SubStatus.ACTIVE || status == SubStatus.TRIALING;

    Subscription sub = user.getSubscription();
    boolean wasPremium = sub.getTier() == Tier.PREMIUM;
    sub.setStatus(status);
    sub.setTier(premium ? Tier.PREMIUM : Tier.FREE);
    sub.setFsLicenseId(license.licenseId());
    sub.setPriceId(license.planId());
    sub.setCurrentPeriodEnd(license.expiration());
    sub.setCancelAtPeriodEnd(license.cancelled() && !expired);

    reconcileIfTierChanged(user, wasPremium, premium);
    userRepository.save(user);
  }

  /** The license is gone (deleted at Freemius). Revoke premium if we know the license. */
  public void revokeByLicenseId(String licenseId) {
    userRepository.findBySubscriptionFsLicenseId(licenseId).ifPresent(user -> {
      Subscription sub = user.getSubscription();
      boolean wasPremium = sub.getTier() == Tier.PREMIUM;
      sub.setTier(Tier.FREE);
      sub.setStatus(SubStatus.CANCELED);
      sub.setCancelAtPeriodEnd(false);
      reconcileIfTierChanged(user, wasPremium, false);
      userRepository.save(user);
    });
  }

  private void reconcileIfTierChanged(User user, boolean wasPremium, boolean premium) {
    if (wasPremium != premium) {
      // Reconcile on ANY tier change, both directions:
      //  - downgrade PREMIUM->FREE: slot 5 -> AD (a displaced app is parked, never discarded);
      //  - upgrade FREE->PREMIUM: slot 5 AD -> EMPTY, so a premium dashboard never keeps a dead
      //    AD cell (which would also make every later updateCells 400).
      // Persist the WHOLE reconciled Dashboard returned by reconcileForTier — it may set
      // Dashboard.parkedApp when slot 5 held an app and no empty slot was free.
      Dashboard reconciled = dashboardService.reconcileForTier(user.getDashboard(), premium);
      user.setDashboard(reconciled);
    }
  }
}
