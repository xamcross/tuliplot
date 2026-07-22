package com.dashdash.billing;

import com.dashdash.auth.SubStatus;
import com.dashdash.auth.Subscription;
import com.dashdash.auth.Tier;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.dashboard.Dashboard;
import com.dashdash.dashboard.DashboardService;
import com.stripe.model.Event;
import com.stripe.model.StripeObject;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class SubscriptionService {

  private final ProcessedStripeEventRepository processedEvents;
  private final StripeGateway gateway;
  private final UserRepository userRepository;
  private final DashboardService dashboardService;

  public SubscriptionService(ProcessedStripeEventRepository processedEvents,
                             StripeGateway gateway,
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
    ProcessedStripeEvent e = new ProcessedStripeEvent();
    e.setId(eventId);
    e.setType(type);
    e.setProcessedAt(Instant.now());
    processedEvents.save(e);
  }

  // ---- dispatcher -----------------------------------------------------------

  /** Route a verified Stripe event to the right state transition. Unhandled types are ignored. */
  public void handleEvent(Event event) {
    switch (event.getType()) {
      case "checkout.session.completed" -> {
        com.stripe.model.checkout.Session session = (com.stripe.model.checkout.Session) deserialize(event);
        if (session.getSubscription() != null) {
          applyFromStripe(session.getSubscription());
        }
      }
      case "customer.subscription.created",
           "customer.subscription.updated",
           "customer.subscription.deleted",
           "customer.subscription.paused",
           "customer.subscription.resumed" -> {
        com.stripe.model.Subscription sub = (com.stripe.model.Subscription) deserialize(event);
        applyFromStripe(sub.getId());
      }
      case "invoice.paid", "invoice.payment_failed" -> {
        com.stripe.model.Invoice invoice = (com.stripe.model.Invoice) deserialize(event);
        resyncByCustomer(invoice.getCustomer());
      }
      case "charge.dispute.created" -> {
        com.stripe.model.Dispute dispute = (com.stripe.model.Dispute) deserialize(event);
        handleDispute(dispute.getCharge());
      }
      default -> {
        // Event types we do not act on are acknowledged (200) and intentionally ignored.
      }
    }
  }

  // ---- state transitions ----------------------------------------------------

  /** Re-fetch the subscription, recompute premium, persist the user, reconcile on downgrade. */
  public void applyFromStripe(String stripeSubscriptionId) {
    StripeSubscriptionSnapshot snap = gateway.retrieveSubscription(stripeSubscriptionId);
    User user = userRepository.findBySubscriptionStripeCustomerId(snap.customerId()).orElse(null);
    if (user == null) {
      return; // unknown customer -> nothing to update
    }
    Subscription sub = user.getSubscription();
    boolean wasPremium = sub.getTier() == Tier.PREMIUM;

    SubStatus status = mapStatus(snap.status());
    boolean premium = status == SubStatus.ACTIVE || status == SubStatus.TRIALING;

    sub.setStatus(status);
    sub.setTier(premium ? Tier.PREMIUM : Tier.FREE);
    sub.setPriceId(snap.priceId());
    sub.setStripeSubscriptionId(snap.subscriptionId());
    sub.setCurrentPeriodEnd(snap.currentPeriodEnd() == null
        ? null : Instant.ofEpochSecond(snap.currentPeriodEnd()));
    sub.setCancelAtPeriodEnd(snap.cancelAtPeriodEnd());

    if (wasPremium && !premium) {
      // Persist the WHOLE reconciled Dashboard returned by reconcileForTier — it may set
      // Dashboard.parkedApp when slot 5 held an app and no empty slot was free. Never copy out
      // only cells; setDashboard(...) keeps parkedApp so the page can later prompt to place it.
      Dashboard reconciled = dashboardService.reconcileForTier(user.getDashboard(), false);
      user.setDashboard(reconciled);
    }
    userRepository.save(user);
  }

  /** Policy: a dispute revokes premium immediately. */
  public void handleDispute(String chargeId) {
    String customerId = gateway.retrieveChargeCustomerId(chargeId);
    if (customerId == null) {
      return;
    }
    userRepository.findBySubscriptionStripeCustomerId(customerId).ifPresent(user -> {
      Subscription sub = user.getSubscription();
      boolean wasPremium = sub.getTier() == Tier.PREMIUM;
      sub.setTier(Tier.FREE);
      sub.setStatus(SubStatus.CANCELED);
      if (wasPremium) {
        // Same rule as applyFromStripe: save the full reconciled Dashboard (incl. parkedApp).
        Dashboard reconciled = dashboardService.reconcileForTier(user.getDashboard(), false);
        user.setDashboard(reconciled);
      }
      userRepository.save(user);
    });
  }

  // ---- helpers --------------------------------------------------------------

  private void resyncByCustomer(String customerId) {
    if (customerId == null) {
      return;
    }
    userRepository.findBySubscriptionStripeCustomerId(customerId)
        .map(u -> u.getSubscription().getStripeSubscriptionId())
        .filter(id -> id != null && !id.isBlank())
        .ifPresent(this::applyFromStripe);
  }

  static SubStatus mapStatus(String stripeStatus) {
    if (stripeStatus == null) {
      return SubStatus.NONE;
    }
    return switch (stripeStatus) {
      case "active" -> SubStatus.ACTIVE;
      case "trialing" -> SubStatus.TRIALING;
      case "past_due", "unpaid" -> SubStatus.PAST_DUE;
      case "canceled", "incomplete_expired", "paused" -> SubStatus.CANCELED;
      default -> SubStatus.NONE; // incomplete + any unknown
    };
  }

  private StripeObject deserialize(Event event) {
    var deserializer = event.getDataObjectDeserializer();
    if (deserializer.getObject().isPresent()) {
      return deserializer.getObject().get();
    }
    try {
      return deserializer.deserializeUnsafe();
    } catch (com.stripe.exception.EventDataObjectDeserializationException e) {
      throw new StripeGatewayException("event deserialize failed for " + event.getId(), e);
    }
  }
}
