package com.tuliplot.billing;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({StripeConfig.class, FreemiusConfig.class})
public class BillingConfiguration {
}
