package com.dashdash.billing;

import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StripeWebhookControllerDispatchTest {

  private StripeService stripeService;
  private SubscriptionService subscriptionService;
  private MockMvc mockMvc;

  @BeforeEach
  void setup() {
    stripeService = mock(StripeService.class);
    subscriptionService = mock(SubscriptionService.class);
    mockMvc = MockMvcBuilders
        .standaloneSetup(new StripeWebhookController(stripeService, subscriptionService))
        .build();
  }

  @Test
  void dispatchesEventThenMarksProcessed() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_1");
    when(event.getType()).thenReturn("customer.subscription.updated");
    when(stripeService.verifyAndParse(any(), any())).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_1")).thenReturn(false);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "sig")
            .content("{}".getBytes()))
        .andExpect(status().isOk());

    InOrder order = inOrder(subscriptionService);
    order.verify(subscriptionService).handleEvent(event);
    order.verify(subscriptionService).markProcessed("evt_1", "customer.subscription.updated");
  }

  @Test
  void duplicateDoesNotDispatch() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_dup");
    when(stripeService.verifyAndParse(any(), any())).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_dup")).thenReturn(true);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "sig")
            .content("{}".getBytes()))
        .andExpect(status().isOk());

    verify(subscriptionService, never()).handleEvent(any());
  }
}
