package com.tuliplot.billing;

import com.stripe.Stripe;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "dashdash.stripe")
public class StripeConfig {

  private String secretKey = "";
  private String priceId = "";
  private String webhookSecret = "";
  private String checkoutSuccessUrl = "";
  private String checkoutCancelUrl = "";
  private String portalReturnUrl = "";
  private String apiVersion = "2025-08-27.basil";

  /** Set the global Stripe secret key once the properties are bound. */
  @PostConstruct
  void applyGlobals() {
    Stripe.apiKey = secretKey;
  }

  public String getSecretKey() { return secretKey; }
  public void setSecretKey(String secretKey) { this.secretKey = secretKey; }

  public String getPriceId() { return priceId; }
  public void setPriceId(String priceId) { this.priceId = priceId; }

  public String getWebhookSecret() { return webhookSecret; }
  public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }

  public String getCheckoutSuccessUrl() { return checkoutSuccessUrl; }
  public void setCheckoutSuccessUrl(String checkoutSuccessUrl) { this.checkoutSuccessUrl = checkoutSuccessUrl; }

  public String getCheckoutCancelUrl() { return checkoutCancelUrl; }
  public void setCheckoutCancelUrl(String checkoutCancelUrl) { this.checkoutCancelUrl = checkoutCancelUrl; }

  public String getPortalReturnUrl() { return portalReturnUrl; }
  public void setPortalReturnUrl(String portalReturnUrl) { this.portalReturnUrl = portalReturnUrl; }

  public String getApiVersion() { return apiVersion; }
  public void setApiVersion(String apiVersion) { this.apiVersion = apiVersion; }
}
