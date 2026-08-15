package com.tuliplot.billing;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProcessedBillingEventRepository extends MongoRepository<ProcessedBillingEvent, String> {
}
