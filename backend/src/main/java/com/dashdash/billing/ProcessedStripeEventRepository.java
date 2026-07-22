package com.dashdash.billing;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProcessedStripeEventRepository extends MongoRepository<ProcessedStripeEvent, String> {
}
