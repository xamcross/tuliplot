package com.tuliplot.auth;

import com.tuliplot.testsupport.MongoTestUri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tuliplot.dashboard.Dashboard;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.mongodb.test.autoconfigure.DataMongoTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@DataMongoTest
class UserRepositoryTest {

    @DynamicPropertySource
    static void mongoProps(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", () -> MongoTestUri.uriFor(UserRepositoryTest.class));
    }

    @Autowired UserRepository users;
    @Autowired MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.getCollection("users").drop();
        mongoTemplate.indexOps(User.class)
                .ensureIndex(new Index().on("email", Sort.Direction.ASC).unique());
    }

    private User newUser(String email) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash("{bcrypt}$2a$10$0123456789012345678901uWZ0aBcDeFgHiJkLmNoPqRsTuVwXy");
        u.setDisplayName("Test User");
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setDashboard(Dashboard.defaultFor(false));
        u.setSubscription(new Subscription());
        return u;
    }

    @Test
    void findByEmailReturnsSavedUser() {
        users.save(newUser("alice@example.com"));

        assertThat(users.findByEmail("alice@example.com"))
                .isPresent()
                .get()
                .extracting(User::getDisplayName)
                .isEqualTo("Test User");
    }

    @Test
    void findByEmailIsEmptyWhenAbsent() {
        assertThat(users.findByEmail("nobody@example.com")).isEmpty();
    }

    @Test
    void uniqueEmailIndexRejectsDuplicate() {
        users.save(newUser("dupe@example.com"));

        assertThatThrownBy(() -> users.save(newUser("dupe@example.com")))
                .isInstanceOf(DuplicateKeyException.class);
    }
}
