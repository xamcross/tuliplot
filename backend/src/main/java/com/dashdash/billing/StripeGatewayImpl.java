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
}
