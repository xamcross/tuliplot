package com.tuliplot.billing;

import com.tuliplot.testsupport.MongoTestUri;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.mongodb.test.autoconfigure.DataMongoTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@DataMongoTest
class ProcessedBillingEventRepositoryTest {

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.mongodb.uri", () -> MongoTestUri.uriFor(ProcessedBillingEventRepositoryTest.class));
  }

  @Autowired
  ProcessedBillingEventRepository repo;

  // Testcontainers may reuse the mongo container across runs; start from a clean collection
  // so the "not present before save" assertion does not see a leftover evt_1.
  @BeforeEach
  void clean() {
    repo.deleteAll();
  }

  @Test
  void existsByIdReflectsSavedEvent() {
    assertThat(repo.existsById("evt_1")).isFalse();

    ProcessedBillingEvent e = new ProcessedBillingEvent();
    e.setId("evt_1");
    e.setType("customer.subscription.updated");
    e.setProcessedAt(Instant.now());
    repo.save(e);

    assertThat(repo.existsById("evt_1")).isTrue();
  }
}
