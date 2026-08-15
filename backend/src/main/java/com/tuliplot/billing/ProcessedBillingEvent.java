package com.tuliplot.billing;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("processed_billing_events")
public class ProcessedBillingEvent {

  @Id
  private String id;      // = billing-provider event id
  private String type;
  private Instant processedAt;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getType() { return type; }
  public void setType(String type) { this.type = type; }

  public Instant getProcessedAt() { return processedAt; }
  public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }
}
