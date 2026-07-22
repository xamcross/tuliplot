package com.dashdash.billing;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.context.annotation.UserConfigurations;

import static org.assertj.core.api.Assertions.assertThat;

class StripeConfigTest {

  @EnableConfigurationProperties(StripeConfig.class)
  static class Enable { }

  private final ApplicationContextRunner runner = new ApplicationContextRunner()
      .withConfiguration(UserConfigurations.of(Enable.class));

  @Test
  void bindsStripePropertiesFromEnvironment() {
    runner.withPropertyValues(
        "dashdash.stripe.secret-key=sk_test_123",
        "dashdash.stripe.price-id=price_abc",
        "dashdash.stripe.webhook-secret=whsec_xyz",
        "dashdash.stripe.checkout-success-url=https://dashdash.app/app?checkout=success",
        "dashdash.stripe.checkout-cancel-url=https://dashdash.app/app/upgrade?checkout=cancel",
        "dashdash.stripe.portal-return-url=https://dashdash.app/app/settings",
        "dashdash.stripe.api-version=2025-08-27.basil"
    ).run(ctx -> {
      assertThat(ctx).hasSingleBean(StripeConfig.class);
      StripeConfig cfg = ctx.getBean(StripeConfig.class);
      assertThat(cfg.getSecretKey()).isEqualTo("sk_test_123");
      assertThat(cfg.getPriceId()).isEqualTo("price_abc");
      assertThat(cfg.getWebhookSecret()).isEqualTo("whsec_xyz");
      assertThat(cfg.getCheckoutSuccessUrl()).isEqualTo("https://dashdash.app/app?checkout=success");
      assertThat(cfg.getCheckoutCancelUrl()).isEqualTo("https://dashdash.app/app/upgrade?checkout=cancel");
      assertThat(cfg.getPortalReturnUrl()).isEqualTo("https://dashdash.app/app/settings");
      assertThat(cfg.getApiVersion()).isEqualTo("2025-08-27.basil");
    });
  }
}
