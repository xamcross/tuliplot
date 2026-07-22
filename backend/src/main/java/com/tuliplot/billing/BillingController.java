package com.tuliplot.billing;

import com.tuliplot.auth.DashPrincipal;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.billing.dto.CheckoutSessionResponse;
import com.tuliplot.billing.dto.PortalSessionResponse;
import com.tuliplot.common.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
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

  @PostMapping("/portal-session")
  public PortalSessionResponse createPortalSession(@AuthenticationPrincipal DashPrincipal principal) {
    User user = userRepository.findById(principal.getUserId()).orElseThrow();
    return new PortalSessionResponse(stripeService.createPortalSession(user));
  }

  @ExceptionHandler(NoStripeCustomerException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ApiError handleNoCustomer(NoStripeCustomerException e) {
    return new ApiError("no_stripe_customer", e.getMessage());
  }
}
