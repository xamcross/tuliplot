package com.dashdash.billing;

import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class StripeService {

  private final StripeGateway gateway;
  private final UserRepository userRepository;
  private final StripeConfig config;

  public StripeService(StripeGateway gateway, UserRepository userRepository, StripeConfig config) {
    this.gateway = gateway;
    this.userRepository = userRepository;
    this.config = config;
  }

  /** Create (or reuse) the Stripe customer, then return a subscription-mode Checkout URL. */
  public String createCheckoutSession(User user) {
    String customerId = user.getSubscription().getStripeCustomerId();
    if (customerId == null || customerId.isBlank()) {
      customerId = gateway.createCustomer(user.getEmail(), user.getId());
      user.getSubscription().setStripeCustomerId(customerId);
      userRepository.save(user);
    }
    return gateway.createCheckoutSessionUrl(
        customerId,
        user.getId(),
        config.getPriceId(),
        config.getCheckoutSuccessUrl(),
        config.getCheckoutCancelUrl());
  }
}
