package com.tuliplot.billing;

import com.tuliplot.auth.SubStatus;
import com.tuliplot.auth.Subscription;
import com.tuliplot.auth.Tier;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.dashboard.Cell;
import com.tuliplot.dashboard.CellType;
import com.tuliplot.dashboard.Dashboard;
import com.tuliplot.dashboard.DashboardService;
import com.tuliplot.dashboard.OpenMode;
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

  private static final Instant FUTURE = Instant.parse("2027-01-01T00:00:00Z");
  private static final Instant PAST = Instant.parse("2020-01-01T00:00:00Z");

  private FreemiusGateway gateway;
  private UserRepository users;
  private DashboardService dashboards;
  private ProcessedBillingEventRepository events;
  private SubscriptionService service;
  private User user;

  @BeforeEach
  void setUp() {
    gateway = mock(FreemiusGateway.class);
    users = mock(UserRepository.class);
    dashboards = mock(DashboardService.class);
    events = mock(ProcessedBillingEventRepository.class);
    service = new SubscriptionService(events, gateway, users, dashboards);

    user = new User();
    user.setEmail("buyer@example.com");
    user.setSubscription(new Subscription());
    when(users.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
    when(gateway.retrieveUserEmail("42")).thenReturn("buyer@example.com");
    when(dashboards.reconcileForTier(any(), org.mockito.ArgumentMatchers.anyBoolean()))
        .thenReturn(new Dashboard());
  }

  private void license(Instant expiration, boolean cancelled, Instant trialEnds) {
    when(gateway.retrieveLicense("555")).thenReturn(
        new FreemiusLicenseSnapshot("555", "61603", "42", expiration, cancelled));
    when(gateway.retrieveSubscription("555")).thenReturn(
        new FreemiusSubscriptionSnapshot(trialEnds, null, null));
  }

  @Test
  void active_license_grants_premium_and_reconciles_upgrade() {
    license(FUTURE, false, null);
    // A distinct, named instance — not the @BeforeEach default — so the assertion below proves
    // the SERVICE persists the exact object reconcileForTier returned, not just any Dashboard.
    Dashboard reconciled = new Dashboard();
    when(dashboards.reconcileForTier(any(), eq(true))).thenReturn(reconciled);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.ACTIVE);
    assertThat(user.getSubscription().getFsLicenseId()).isEqualTo("555");
    assertThat(user.getSubscription().getCurrentPeriodEnd()).isEqualTo(FUTURE);
    verify(dashboards).reconcileForTier(any(), eq(true));
    // The load-bearing rule: the reconciled Dashboard is SET onto the user, not merely computed.
    assertThat(user.getDashboard()).isSameAs(reconciled);
    verify(users).save(user);
  }

  @Test
  void lifetime_license_null_expiration_grants_premium() {
    license(null, false, null);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(user.getSubscription().getCurrentPeriodEnd()).isNull();
  }

  @Test
  void trial_maps_to_trialing_and_premium() {
    license(FUTURE, false, FUTURE);
    service.applyLicense("555");
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.TRIALING);
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
  }

  @Test
  void cancelled_but_not_expired_keeps_premium_with_cancel_flag() {
    license(FUTURE, true, null);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(user.getSubscription().isCancelAtPeriodEnd()).isTrue();
    assertThat(user.getSubscription().getCurrentPeriodEnd()).isEqualTo(FUTURE);
  }

  @Test
  void expired_license_downgrades_and_reconciles() {
    user.getSubscription().setTier(Tier.PREMIUM);
    license(PAST, true, null);
    // Simulate reconcileForTier parking the displaced slot-5 app (no empty slot was free).
    Dashboard reconciled = new Dashboard();
    Cell parked = new Cell();
    parked.setSlot(0);
    parked.setType(CellType.APP);
    parked.setUrl("https://mail.google.com");
    parked.setOpenMode(OpenMode.FRAME);
    reconciled.setParkedApp(parked);
    when(dashboards.reconcileForTier(any(), eq(false))).thenReturn(reconciled);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboards).reconcileForTier(any(), eq(false));
    // The load-bearing rule: the FULL reconciled Dashboard is persisted — parkedApp survives.
    assertThat(user.getDashboard()).isSameAs(reconciled);
    assertThat(user.getDashboard().getParkedApp()).isSameAs(parked);
  }

  @Test
  void no_tier_change_skips_reconcile() {
    user.getSubscription().setTier(Tier.PREMIUM);
    license(FUTURE, false, null);
    service.applyLicense("555");
    verify(dashboards, never()).reconcileForTier(any(), org.mockito.ArgumentMatchers.anyBoolean());
  }

  @Test
  void unknown_email_falls_back_to_stored_license_id_then_gives_up_silently() {
    when(users.findByEmail("buyer@example.com")).thenReturn(Optional.empty());
    when(users.findBySubscriptionFsLicenseId("555")).thenReturn(Optional.empty());
    license(FUTURE, false, null);
    service.applyLicense("555");   // must not throw
    verify(users, never()).save(any());
  }

  @Test
  void email_lookup_miss_falls_back_to_stored_license_id_and_applies() {
    when(users.findByEmail("buyer@example.com")).thenReturn(Optional.empty());
    when(users.findBySubscriptionFsLicenseId("555")).thenReturn(Optional.of(user));
    license(FUTURE, false, null);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(user.getSubscription().getFsLicenseId()).isEqualTo("555");
    verify(users).save(user);
  }

  @Test
  void deleted_license_404_revokes_premium_via_stored_id() {
    user.getSubscription().setTier(Tier.PREMIUM);
    user.getSubscription().setFsLicenseId("555");
    when(gateway.retrieveLicense("555")).thenThrow(new FreemiusNotFoundException("gone"));
    when(users.findBySubscriptionFsLicenseId("555")).thenReturn(Optional.of(user));
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboards).reconcileForTier(any(), eq(false));
  }
}
