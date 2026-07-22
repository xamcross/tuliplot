package com.dashdash.billing;

import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.stereotype.Component;

@Component
public class StripeGatewayImpl implements StripeGateway {

  private final StripeConfig config;

  public StripeGatewayImpl(StripeConfig config) {
    this.config = config;
  }

  private RequestOptions options() {
    RequestOptions.RequestOptionsBuilder builder = RequestOptions.builder();
    RequestOptions.RequestOptionsBuilder.unsafeSetStripeVersionOverride(builder, config.getApiVersion());
    return builder.build();
  }

  @Override
  public String createCustomer(String email, String userId) {
    try {
      CustomerCreateParams params = CustomerCreateParams.builder()
          .setEmail(email)
          .putMetadata("userId", userId)
          .build();
      Customer customer = Customer.create(params, options());
      return customer.getId();
    } catch (StripeException e) {
      throw new StripeGatewayException("createCustomer failed", e);
    }
  }

  @Override
  public String createCheckoutSessionUrl(String customerId, String userId, String priceId,
                                         String successUrl, String cancelUrl) {
    try {
      SessionCreateParams params = SessionCreateParams.builder()
          .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
          .setCustomer(customerId)
          .setClientReferenceId(userId)
          .setSuccessUrl(successUrl)
          .setCancelUrl(cancelUrl)
          .addLineItem(SessionCreateParams.LineItem.builder()
              .setPrice(priceId)
              .setQuantity(1L)
              .build())
          .build();
      Session session = Session.create(params, options());
      return session.getUrl();
    } catch (StripeException e) {
      throw new StripeGatewayException("createCheckoutSession failed", e);
    }
  }

  @Override
  public String createPortalSessionUrl(String customerId, String returnUrl) {
    try {
      com.stripe.param.billingportal.SessionCreateParams params =
          com.stripe.param.billingportal.SessionCreateParams.builder()
              .setCustomer(customerId)
              .setReturnUrl(returnUrl)
              .build();
      com.stripe.model.billingportal.Session session =
          com.stripe.model.billingportal.Session.create(params, options());
      return session.getUrl();
    } catch (com.stripe.exception.StripeException e) {
      throw new StripeGatewayException("createPortalSession failed", e);
    }
  }

  @Override
  public com.stripe.model.Event constructEvent(byte[] payload, String signatureHeader, String webhookSecret)
      throws com.stripe.exception.SignatureVerificationException {
    String json = new String(payload, java.nio.charset.StandardCharsets.UTF_8);
    return com.stripe.net.Webhook.constructEvent(json, signatureHeader, webhookSecret);
  }

  @Override
  public StripeSubscriptionSnapshot retrieveSubscription(String subscriptionId) {
    try {
      com.stripe.model.Subscription sub = com.stripe.model.Subscription.retrieve(subscriptionId, options());
      com.stripe.model.SubscriptionItem item = sub.getItems().getData().get(0);
      Long periodEnd = item.getCurrentPeriodEnd();
      String priceId = item.getPrice() != null ? item.getPrice().getId() : null;
      boolean cancelAtPeriodEnd = Boolean.TRUE.equals(sub.getCancelAtPeriodEnd());
      return new StripeSubscriptionSnapshot(
          sub.getId(), sub.getCustomer(), sub.getStatus(), priceId, periodEnd, cancelAtPeriodEnd);
    } catch (com.stripe.exception.StripeException e) {
      throw new StripeGatewayException("retrieveSubscription failed", e);
    }
  }

  @Override
  public String retrieveChargeCustomerId(String chargeId) {
    try {
      com.stripe.model.Charge charge = com.stripe.model.Charge.retrieve(chargeId, options());
      return charge.getCustomer();
    } catch (com.stripe.exception.StripeException e) {
      throw new StripeGatewayException("retrieveCharge failed", e);
    }
  }
}
