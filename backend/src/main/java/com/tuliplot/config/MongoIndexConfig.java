package com.tuliplot.config;

import java.util.concurrent.TimeUnit;
import com.tuliplot.auth.PasswordResetToken;
import com.tuliplot.auth.User;
import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

/**
 * Central, extensible place to declare MongoDB indexes explicitly at startup (auto-index-creation
 * stays off). The walking skeleton creates the Spring Session TTL index; later plans add their own
 * blocks here, e.g. Plan 02 adds {@code ensureUserIndexes()} and Plan 05 the {@code processed_billing_events} TTL.
 */
@Configuration
public class MongoIndexConfig {

    private final MongoTemplate mongoTemplate;

    public MongoIndexConfig(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        ensureSessionIndexes();
        ensureUserIndexes();
        ensurePasswordResetTokenIndexes();
        ensureBillingEventIndexes();
    }

    // --- processed_billing_events (Plan 05) ---
    private void ensureBillingEventIndexes() {
        // processed_billing_events: idempotency store — expire records 30 days after processing
        mongoTemplate.indexOps("processed_billing_events")
                .ensureIndex(new Index()
                        .on("processedAt", Sort.Direction.ASC)
                        .expire(java.time.Duration.ofDays(30)));
    }

    /** TTL index so MongoDB deletes each session document at its own {@code expireAt} instant. */
    private void ensureSessionIndexes() {
        mongoTemplate.getCollection("sessions").createIndex(
                new Document("expireAt", 1),
                new IndexOptions().expireAfter(0L, TimeUnit.SECONDS).name("session_ttl"));
    }

    // --- users (Plan 02) ---
    private void ensureUserIndexes() {
        var ops = mongoTemplate.indexOps(User.class);
        ops.ensureIndex(new Index().on("email", Sort.Direction.ASC).unique());
        ops.ensureIndex(new Index().on("googleSub", Sort.Direction.ASC).unique().sparse());
    }

    // --- password reset tokens (Plan 02 Task 9) ---
    private void ensurePasswordResetTokenIndexes() {
        // TTL index: expireAfterSeconds=0 on a date field makes each token expire
        // exactly at its `expiresAt` instant (Mongo's TTL monitor sweeps ~every 60s).
        mongoTemplate.indexOps(PasswordResetToken.class)
                .ensureIndex(new Index().on("expiresAt", Sort.Direction.ASC)
                        .expire(java.time.Duration.ZERO));
    }
}
