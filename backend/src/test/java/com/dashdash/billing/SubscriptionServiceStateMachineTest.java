package com.dashdash.billing;

import com.dashdash.auth.SubStatus;
import com.dashdash.auth.Subscription;
import com.dashdash.auth.Tier;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.dashboard.Cell;
import com.dashdash.dashboard.CellType;
import com.dashdash.dashboard.Dashboard;
import com.dashdash.dashboard.DashboardService;
import com.dashdash.dashboard.OpenMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubscriptionServiceStateMachineTest {

  private StripeGateway gateway;
  private UserRepository userRepository;
  private DashboardService dashboardService;
  private SubscriptionService service;

  @BeforeEach
  void setup() {
    gateway = mock(StripeGateway.class);
    userRepository = mock(UserRepository.class);
    dashboardService = mock(DashboardService.class);
    ProcessedStripeEventRepository processedEvents = mock(ProcessedStripeEventRepository.class);
    service = new SubscriptionService(processedEvents, gateway, userRepository, dashboardService);
  }

  private User user(Tier tier, SubStatus status, String customerId) {
    User u = new User();
    u.setId("u_" + customerId);
    Subscription sub = new Subscription();
    sub.setTier(tier);
    sub.setStatus(status);
    sub.setStripeCustomerId(customerId);
    sub.setStripeSubscriptionId("sub_pre");
    u.setSubscription(sub);
    u.setDashboard(Dashboard.defaultFor(tier == Tier.PREMIUM));
    return u;
  }

  @Test
  void activateReconcilesDashboardOnUpgrade() {
    User u = user(Tier.FREE, SubStatus.NONE, "cus_1");
    // A FREE dashboard has an AD cell in slot 5; the premium reconcile turns it into EMPTY.
    Dashboard reconciled = Dashboard.defaultFor(true);
    when(gateway.retrieveSubscription("sub_1")).thenReturn(
        new StripeSubscriptionSnapshot("sub_1", "cus_1", "active", "price_abc", 1893456000L, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_1")).thenReturn(Optional.of(u));
    when(dashboardService.reconcileForTier(any(), eq(true))).thenReturn(reconciled);

    service.applyFromStripe("sub_1");

    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.ACTIVE);
    assertThat(u.getSubscription().getStripeSubscriptionId()).isEqualTo("sub_1");
    assertThat(u.getSubscription().getPriceId()).isEqualTo("price_abc");
    assertThat(u.getSubscription().getCurrentPeriodEnd()).isEqualTo(Instant.ofEpochSecond(1893456000L));
    assertThat(u.getSubscription().isCancelAtPeriodEnd()).isFalse();
    // On FREE->PREMIUM the dashboard MUST be reconciled for the premium tier...
    verify(dashboardService).reconcileForTier(any(), eq(true));
    // ...and the persisted user carries that reconciled dashboard, whose slot 5 is no longer an AD.
    assertThat(u.getDashboard()).isSameAs(reconciled);
    assertThat(u.getDashboard().getCells().get(5).getType()).isNotEqualTo(CellType.AD);
    assertThat(u.getDashboard().getCells().get(5).getType()).isEqualTo(CellType.EMPTY);
    verify(userRepository).save(u);
  }

  @Test
  void cancelDowngradesAndReconciles() {
    User u = user(Tier.PREMIUM, SubStatus.ACTIVE, "cus_2");
    // Simulate reconcileForTier parking the displaced slot-5 app (no empty slot was free).
    Dashboard reconciled = Dashboard.defaultFor(false);
    Cell parked = new Cell();
    parked.setSlot(0);
    parked.setType(CellType.APP);
    parked.setUrl("https://mail.google.com");
    parked.setOpenMode(OpenMode.FRAME);
    reconciled.setParkedApp(parked);
    when(gateway.retrieveSubscription("sub_2")).thenReturn(
        new StripeSubscriptionSnapshot("sub_2", "cus_2", "canceled", "price_abc", null, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_2")).thenReturn(Optional.of(u));
    when(dashboardService.reconcileForTier(any(), eq(false))).thenReturn(reconciled);

    service.applyFromStripe("sub_2");

    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboardService).reconcileForTier(any(), eq(false));
    // The FULL reconciled Dashboard is persisted — parkedApp must NOT be dropped.
    assertThat(u.getDashboard()).isSameAs(reconciled);
    assertThat(u.getDashboard().getParkedApp()).isSameAs(parked);
    verify(userRepository).save(u);
  }

  @Test
  void pastDueRemovesPremium() {
    User u = user(Tier.PREMIUM, SubStatus.ACTIVE, "cus_3");
    when(gateway.retrieveSubscription("sub_3")).thenReturn(
        new StripeSubscriptionSnapshot("sub_3", "cus_3", "past_due", "price_abc", null, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_3")).thenReturn(Optional.of(u));
    when(dashboardService.reconcileForTier(any(), eq(false))).thenReturn(Dashboard.defaultFor(false));

    service.applyFromStripe("sub_3");

    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.PAST_DUE);
    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
    verify(dashboardService).reconcileForTier(any(), eq(false));
  }

  @Test
  void disputeRevokesPremium() {
    User u = user(Tier.PREMIUM, SubStatus.ACTIVE, "cus_4");
    when(gateway.retrieveChargeCustomerId("ch_1")).thenReturn("cus_4");
    when(userRepository.findBySubscriptionStripeCustomerId("cus_4")).thenReturn(Optional.of(u));
    when(dashboardService.reconcileForTier(any(), eq(false))).thenReturn(Dashboard.defaultFor(false));

    service.handleDispute("ch_1");

    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboardService).reconcileForTier(any(), eq(false));
    verify(userRepository).save(u);
  }

  @Test
  void ignoresUnknownCustomer() {
    when(gateway.retrieveSubscription("sub_x")).thenReturn(
        new StripeSubscriptionSnapshot("sub_x", "cus_unknown", "active", "p", null, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_unknown")).thenReturn(Optional.empty());

    service.applyFromStripe("sub_x");

    verify(userRepository, never()).save(any());
  }
}
