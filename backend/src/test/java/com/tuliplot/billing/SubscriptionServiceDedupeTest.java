package com.tuliplot.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubscriptionServiceDedupeTest {

  private ProcessedStripeEventRepository repo;
  private SubscriptionService service;

  @BeforeEach
  void setup() {
    repo = mock(ProcessedStripeEventRepository.class);
    service = new SubscriptionService(
        repo,
        mock(StripeGateway.class),
        mock(com.tuliplot.auth.UserRepository.class),
        mock(com.tuliplot.dashboard.DashboardService.class));
  }

  @Test
  void alreadyProcessedReflectsRepository() {
    when(repo.existsById("evt_1")).thenReturn(true);
    when(repo.existsById("evt_2")).thenReturn(false);

    assertThat(service.alreadyProcessed("evt_1")).isTrue();
    assertThat(service.alreadyProcessed("evt_2")).isFalse();
  }

  @Test
  void markProcessedSavesEventWithIdAndType() {
    service.markProcessed("evt_9", "invoice.paid");

    ArgumentCaptor<ProcessedStripeEvent> saved = ArgumentCaptor.forClass(ProcessedStripeEvent.class);
    verify(repo).save(saved.capture());
    assertThat(saved.getValue().getId()).isEqualTo("evt_9");
    assertThat(saved.getValue().getType()).isEqualTo("invoice.paid");
    assertThat(saved.getValue().getProcessedAt()).isNotNull();
  }
}
