package com.dashdash.billing;

import com.dashdash.auth.Subscription;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StripeServicePortalTest {

  private StripeGateway gateway;
  private StripeService service;

  @BeforeEach
  void setup() {
    gateway = mock(StripeGateway.class);
    UserRepository userRepository = mock(UserRepository.class);
    StripeConfig config = new StripeConfig();
    config.setPortalReturnUrl("https://dashdash.app/app/settings");
    service = new StripeService(gateway, userRepository, config);
  }

  private User userWithCustomer(String customerId) {
    User u = new User();
    u.setId("u1");
    Subscription sub = new Subscription();
    sub.setStripeCustomerId(customerId);
    u.setSubscription(sub);
    return u;
  }

  @Test
  void returnsPortalUrlForCustomer() {
    when(gateway.createPortalSessionUrl("cus_1", "https://dashdash.app/app/settings"))
        .thenReturn("https://billing.stripe.com/p/session/test_1");

    String url = service.createPortalSession(userWithCustomer("cus_1"));

    assertThat(url).isEqualTo("https://billing.stripe.com/p/session/test_1");
  }

  @Test
  void throwsWhenNoCustomer() {
    assertThatThrownBy(() -> service.createPortalSession(userWithCustomer(null)))
        .isInstanceOf(NoStripeCustomerException.class);
  }
}
