package com.dashdash.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.mongodb.test.autoconfigure.DataMongoTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@DataMongoTest
@Testcontainers
class ProcessedStripeEventRepositoryTest {

  @Container
  static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired
  ProcessedStripeEventRepository repo;

  // Testcontainers may reuse the mongo container across runs; start from a clean collection
  // so the "not present before save" assertion does not see a leftover evt_1.
  @BeforeEach
  void clean() {
    repo.deleteAll();
  }

  @Test
  void existsByIdReflectsSavedEvent() {
    assertThat(repo.existsById("evt_1")).isFalse();

    ProcessedStripeEvent e = new ProcessedStripeEvent();
    e.setId("evt_1");
    e.setType("customer.subscription.updated");
    e.setProcessedAt(Instant.now());
    repo.save(e);

    assertThat(repo.existsById("evt_1")).isTrue();
  }
}
