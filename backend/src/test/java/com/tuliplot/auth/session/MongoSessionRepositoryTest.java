package com.tuliplot.auth.session;

import com.tuliplot.testsupport.MongoTestUri;

import static org.assertj.core.api.Assertions.assertThat;

import com.mongodb.client.model.Filters;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class MongoSessionRepositoryTest {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.mongodb.uri", () -> MongoTestUri.uriFor(MongoSessionRepositoryTest.class));
    }

    @Autowired MongoSessionRepository repository;
    @Autowired MongoTemplate mongoTemplate;

    @Test
    void changeSessionIdDeletesTheOldDocument() {
        MongoSession session = repository.createSession();
        session.setAttribute("who", "carol");
        repository.save(session);
        String oldId = session.getId();

        // A rotation followed by save must MOVE the document to the new id, not leave a copy behind.
        String newId = session.changeSessionId();
        repository.save(session);

        assertThat(newId).isNotEqualTo(oldId);
        // The stale document at the old id must be gone (not merely unreachable until its TTL).
        assertThat(mongoTemplate.getCollection(MongoSessionRepository.COLLECTION)
                .find(Filters.eq("_id", oldId)).first())
                .as("old session document must be deleted after id rotation")
                .isNull();
        assertThat(repository.findById(oldId))
                .as("old id must no longer resolve to a session")
                .isNull();
        // The session is still readable under its new id, with attributes intact.
        MongoSession reloaded = repository.findById(newId);
        assertThat(reloaded).as("session must be readable under the new id").isNotNull();
        assertThat(reloaded.<String>getAttribute("who")).isEqualTo("carol");
    }
}
