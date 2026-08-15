package com.tuliplot.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tuliplot.freemius")
public class FreemiusConfig {

  private String productId = "";
  private String secretKey = "";
  private String apiToken = "";
  private String apiBaseUrl = "https://api.freemius.com/v1";

  public String getProductId() { return productId; }
  public void setProductId(String productId) { this.productId = productId; }

  public String getSecretKey() { return secretKey; }
  public void setSecretKey(String secretKey) { this.secretKey = secretKey; }

  public String getApiToken() { return apiToken; }
  public void setApiToken(String apiToken) { this.apiToken = apiToken; }

  public String getApiBaseUrl() { return apiBaseUrl; }
  public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }
}
