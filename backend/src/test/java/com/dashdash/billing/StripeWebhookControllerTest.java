package com.dashdash.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StripeWebhookControllerTest {

  private StripeService stripeService;
  private SubscriptionService subscriptionService;
  private MockMvc mockMvc;

  @BeforeEach
  void setup() {
    stripeService = mock(StripeService.class);
    subscriptionService = mock(SubscriptionService.class);
    StripeWebhookController controller = new StripeWebhookController(stripeService, subscriptionService);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void validSignatureIsProcessedAndReturns200() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_1");
    when(event.getType()).thenReturn("customer.subscription.updated");
    when(stripeService.verifyAndParse(any(), eq("good-sig"))).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_1")).thenReturn(false);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "good-sig")
            .content("{\"id\":\"evt_1\"}".getBytes()))
        .andExpect(status().isOk());

    verify(subscriptionService).markProcessed("evt_1", "customer.subscription.updated");
  }

  @Test
  void badSignatureReturns400() throws Exception {
    when(stripeService.verifyAndParse(any(), eq("bad-sig")))
        .thenThrow(new SignatureVerificationException("bad", "bad-sig"));

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "bad-sig")
            .content("{}".getBytes()))
        .andExpect(status().isBadRequest());

    verify(subscriptionService, never()).markProcessed(any(), any());
  }

  @Test
  void duplicateEventIsNoOpAndReturns200() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_dup");
    when(event.getType()).thenReturn("invoice.paid");
    when(stripeService.verifyAndParse(any(), any())).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_dup")).thenReturn(true);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "good-sig")
            .content("{}".getBytes()))
        .andExpect(status().isOk());

    verify(subscriptionService, never()).markProcessed(any(), any());
  }
}
