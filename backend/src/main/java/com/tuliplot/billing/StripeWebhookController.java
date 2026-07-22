package com.tuliplot.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
public class StripeWebhookController {

  private final StripeService stripeService;
  private final SubscriptionService subscriptionService;

  public StripeWebhookController(StripeService stripeService, SubscriptionService subscriptionService) {
    this.stripeService = stripeService;
    this.subscriptionService = subscriptionService;
  }

  /**
   * Raw-body webhook. Body is consumed as byte[] so the signature is verified over the exact
   * bytes Stripe signed (never pre-parsed as JSON). Public + CSRF-exempt via SecurityConfig.
   */
  @PostMapping("/webhook")
  public ResponseEntity<String> handle(@RequestBody byte[] payload,
                                       @RequestHeader("Stripe-Signature") String signature) {
    Event event;
    try {
      event = stripeService.verifyAndParse(payload, signature);
    } catch (SignatureVerificationException e) {
      return ResponseEntity.badRequest().body("invalid signature");
    }
    if (subscriptionService.alreadyProcessed(event.getId())) {
      return ResponseEntity.ok("duplicate");
    }
    subscriptionService.handleEvent(event);
    subscriptionService.markProcessed(event.getId(), event.getType());
    return ResponseEntity.ok("ok");
  }
}
