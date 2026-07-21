package com.dashdash;

import static org.assertj.core.api.Assertions.assertThat;

import com.dashdash.auth.session.MongoSession;
import com.dashdash.auth.session.MongoSessionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SkeletonContextTest {

    @Container
    @ServiceConnection
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

    // Boot 4.x removed TestRestTemplate; hit the running server with Spring's RestClient instead.
    @LocalServerPort
    int port;

    @Autowired
    MongoSessionRepository sessions;

    @Test
    void contextBootsAndHealthIsUp() {
        ResponseEntity<String> response = RestClient.create()
                .get()
                .uri("http://localhost:" + port + "/api/v1/health")
                .retrieve()
                .toEntity(String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void sessionStoreRoundTrips() {
        MongoSession session = sessions.createSession();
        session.setAttribute("user", "alice");
        sessions.save(session);

        MongoSession loaded = sessions.findById(session.getId());
        assertThat(loaded).isNotNull();
        assertThat(loaded.<String>getAttribute("user")).isEqualTo("alice");

        sessions.deleteById(session.getId());
        assertThat(sessions.findById(session.getId())).isNull();
    }
}
