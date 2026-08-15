package com.tuliplot.billing;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FreemiusConfigTest {

  @Test
  void defaults_are_bootable_without_billing() {
    FreemiusConfig config = new FreemiusConfig();
    assertThat(config.getProductId()).isEmpty();
    assertThat(config.getSecretKey()).isEmpty();
    assertThat(config.getApiToken()).isEmpty();
    assertThat(config.getApiBaseUrl()).isEqualTo("https://api.freemius.com/v1");
  }
}
