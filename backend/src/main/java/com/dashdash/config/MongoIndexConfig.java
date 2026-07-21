package com.dashdash.config;

import java.util.concurrent.TimeUnit;
import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;

/**
 * Central, extensible place to declare MongoDB indexes explicitly at startup (auto-index-creation
 * stays off). The walking skeleton creates the Spring Session TTL index; later plans add their own
 * blocks here, e.g. Plan 02 adds {@code ensureUserIndexes()} and Plan 05 the {@code stripe_events} TTL.
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
        // Plan 02 adds ensureUserIndexes(); Plan 05 adds the stripe_events TTL index here.
    }

    /** TTL index so MongoDB deletes each session document at its own {@code expireAt} instant. */
    private void ensureSessionIndexes() {
        mongoTemplate.getCollection("sessions").createIndex(
                new Document("expireAt", 1),
                new IndexOptions().expireAfter(0L, TimeUnit.SECONDS).name("session_ttl"));
    }
}
