package com.dashdash.billing;

import com.dashdash.auth.Subscription;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StripeServiceCheckoutTest {

  private StripeGateway gateway;
  private UserRepository userRepository;
  private StripeConfig config;
  private StripeService service;

  @BeforeEach
  void setup() {
    gateway = mock(StripeGateway.class);
    userRepository = mock(UserRepository.class);
    config = new StripeConfig();
    config.setPriceId("price_abc");
    config.setCheckoutSuccessUrl("https://dashdash.app/app?checkout=success");
    config.setCheckoutCancelUrl("https://dashdash.app/app/upgrade?checkout=cancel");
    config.setPortalReturnUrl("https://dashdash.app/app/settings");
    // SubscriptionService dependency is not needed for checkout; pass a mock.
    service = new StripeService(gateway, userRepository, config);
  }

  private User userWithoutCustomer() {
    User u = new User();
    u.setId("u1");
    u.setEmail("a@b.com");
    Subscription sub = new Subscription();
    u.setSubscription(sub);
    return u;
  }

  @Test
  void createsCustomerWhenMissingThenReturnsCheckoutUrl() {
    User user = userWithoutCustomer();
    when(gateway.createCustomer("a@b.com", "u1")).thenReturn("cus_new");
    when(gateway.createCheckoutSessionUrl(
        eq("cus_new"), eq("u1"), eq("price_abc"),
        eq("https://dashdash.app/app?checkout=success"),
        eq("https://dashdash.app/app/upgrade?checkout=cancel")))
        .thenReturn("https://checkout.stripe.com/c/pay/cs_test_1");

    String url = service.createCheckoutSession(user);

    assertThat(url).isEqualTo("https://checkout.stripe.com/c/pay/cs_test_1");
    // persisted the new customer id on the user
    ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
    verify(userRepository).save(saved.capture());
    assertThat(saved.getValue().getSubscription().getStripeCustomerId()).isEqualTo("cus_new");
  }

  @Test
  void reusesExistingCustomerAndDoesNotPersist() {
    User user = userWithoutCustomer();
    user.getSubscription().setStripeCustomerId("cus_existing");
    when(gateway.createCheckoutSessionUrl(
        eq("cus_existing"), eq("u1"), eq("price_abc"), any(), any()))
        .thenReturn("https://checkout.stripe.com/c/pay/cs_test_2");

    String url = service.createCheckoutSession(user);

    assertThat(url).isEqualTo("https://checkout.stripe.com/c/pay/cs_test_2");
    verify(gateway, never()).createCustomer(any(), any());
    verify(userRepository, never()).save(any());
  }
}
