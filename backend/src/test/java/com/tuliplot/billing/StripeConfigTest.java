package com.tuliplot.billing;

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
        "tuliplot.stripe.secret-key=sk_test_123",
        "tuliplot.stripe.price-id=price_abc",
        "tuliplot.stripe.webhook-secret=whsec_xyz",
        "tuliplot.stripe.checkout-success-url=https://tuliplot.com/app?checkout=success",
        "tuliplot.stripe.checkout-cancel-url=https://tuliplot.com/app/upgrade?checkout=cancel",
        "tuliplot.stripe.portal-return-url=https://tuliplot.com/app/settings",
        "tuliplot.stripe.api-version=2025-08-27.basil"
    ).run(ctx -> {
      assertThat(ctx).hasSingleBean(StripeConfig.class);
      StripeConfig cfg = ctx.getBean(StripeConfig.class);
      assertThat(cfg.getSecretKey()).isEqualTo("sk_test_123");
      assertThat(cfg.getPriceId()).isEqualTo("price_abc");
      assertThat(cfg.getWebhookSecret()).isEqualTo("whsec_xyz");
      assertThat(cfg.getCheckoutSuccessUrl()).isEqualTo("https://tuliplot.com/app?checkout=success");
      assertThat(cfg.getCheckoutCancelUrl()).isEqualTo("https://tuliplot.com/app/upgrade?checkout=cancel");
      assertThat(cfg.getPortalReturnUrl()).isEqualTo("https://tuliplot.com/app/settings");
      assertThat(cfg.getApiVersion()).isEqualTo("2025-08-27.basil");
    });
  }
}
