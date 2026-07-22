package com.dashdash.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StripeServiceVerifyTest {

  private StripeGateway gateway;
  private StripeService service;

  @BeforeEach
  void setup() throws Exception {
    gateway = mock(StripeGateway.class);
    StripeConfig config = new StripeConfig();
    config.setWebhookSecret("whsec_test");
    service = new StripeService(gateway, mock(com.dashdash.auth.UserRepository.class), config);
  }

  @Test
  void delegatesToGatewayWithConfiguredSecret() throws Exception {
    Event event = mock(Event.class);
    byte[] body = "{}".getBytes();
    when(gateway.constructEvent(body, "sig", "whsec_test")).thenReturn(event);

    Event out = service.verifyAndParse(body, "sig");

    assertThat(out).isSameAs(event);
  }

  @Test
  void propagatesSignatureFailure() throws Exception {
    byte[] body = "{}".getBytes();
    when(gateway.constructEvent(body, "bad", "whsec_test"))
        .thenThrow(new SignatureVerificationException("bad sig", "bad"));

    assertThatThrownBy(() -> service.verifyAndParse(body, "bad"))
        .isInstanceOf(SignatureVerificationException.class);
  }
}
