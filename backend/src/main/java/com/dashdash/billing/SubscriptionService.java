package com.dashdash.billing;

import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class SubscriptionService {

  private final ProcessedStripeEventRepository processedEvents;

  public SubscriptionService(ProcessedStripeEventRepository processedEvents) {
    this.processedEvents = processedEvents;
  }

  public boolean alreadyProcessed(String eventId) {
    return processedEvents.existsById(eventId);
  }

  public void markProcessed(String eventId, String type) {
    ProcessedStripeEvent e = new ProcessedStripeEvent();
    e.setId(eventId);
    e.setType(type);
    e.setProcessedAt(Instant.now());
    processedEvents.save(e);
  }
}
