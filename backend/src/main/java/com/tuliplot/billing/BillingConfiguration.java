package com.tuliplot.billing;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({StripeConfig.class, FreemiusConfig.class})
public class BillingConfiguration {

  // Boot 4.1 moved RestClientAutoConfiguration out of spring-boot-starter-web and into the
  // separate spring-boot-restclient module, which this project does not depend on. FreemiusGatewayImpl
  // is the first bean that needs an injectable RestClient.Builder, so this project supplies one directly
  // rather than pulling in the extra starter. Prototype-scoped to match Spring's own convention: each
  // injection point gets its own unconfigured builder instead of sharing mutable builder state.
  @Bean
  @Scope("prototype")
  @ConditionalOnMissingBean
  RestClient.Builder restClientBuilder() {
    return RestClient.builder();
  }
}
