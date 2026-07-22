package com.dashdash.billing;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.billing.dto.CheckoutSessionResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

  private final StripeService stripeService;
  private final UserRepository userRepository;

  public BillingController(StripeService stripeService, UserRepository userRepository) {
    this.stripeService = stripeService;
    this.userRepository = userRepository;
  }

  @PostMapping("/checkout-session")
  public CheckoutSessionResponse createCheckoutSession(@AuthenticationPrincipal DashPrincipal principal) {
    User user = userRepository.findById(principal.getUserId()).orElseThrow();
    return new CheckoutSessionResponse(stripeService.createCheckoutSession(user));
  }
}
