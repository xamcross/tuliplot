package com.tuliplot.billing;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

// The RestClient.Builder that FreemiusGatewayImpl needs comes from
// spring-boot-starter-restclient (see build.gradle.kts) — Boot 4.1's real
// RestClientAutoConfiguration, not a hand-rolled bean here.
@Configuration
@EnableConfigurationProperties({StripeConfig.class, FreemiusConfig.class})
public class BillingConfiguration {
}
