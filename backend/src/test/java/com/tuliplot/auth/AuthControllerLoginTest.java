package com.tuliplot.auth;

import com.tuliplot.testsupport.MongoTestUri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tuliplot.auth.dto.LoginRequest;
import com.tuliplot.dashboard.Dashboard;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc   // full security filter chain active
class AuthControllerLoginTest {

    @Container
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.data.mongodb.uri", () -> MongoTestUri.directConnection(mongo));
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MongoTemplate mongoTemplate;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void seed() {
        mongoTemplate.getCollection("users").drop();
        User u = new User();
        u.setEmail("carol@example.com");
        u.setPasswordHash(passwordEncoder.encode("correct-horse"));
        u.setDisplayName("Carol");
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setSubscription(new Subscription());        // FREE / NONE
        u.setDashboard(Dashboard.defaultFor(false));
        users.save(u);
    }

    @Test
    void loginWithGoodCredentialsReturns200AndAuthenticatesSubsequentRequests() throws Exception {
        LoginRequest body = new LoginRequest("Carol@Example.com", "correct-horse");

        MvcResult login = mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("carol@example.com"))
                .andExpect(jsonPath("$.displayName").value("Carol"))
                .andExpect(jsonPath("$.tier").value("FREE"))
                .andExpect(jsonPath("$.adFree").value(false))
                .andReturn();

        // Plan 01's Spring Session SessionRepositoryFilter (Mongo-backed) is active under
        // @SpringBootTest, so the session lives in the Mongo-backed Spring Session store and is
        // carried by the TULIPSESSION cookie, not a servlet MockHttpSession. Establishment is
        // proven by the emitted cookie; that the session authenticates subsequent requests is
        // proven against a protected route (401 while anonymous, no longer 401 with the cookie).
        Cookie sessionCookie = login.getResponse().getCookie("TULIPSESSION");
        assertThat(sessionCookie).as("TULIPSESSION cookie establishes the session").isNotNull();
        assertThat(sessionCookie.getValue()).isNotBlank();

        // A protected route rejects the anonymous caller...
        mvc.perform(get("/api/v1/dashboard"))
                .andExpect(status().isUnauthorized());

        // ...but the session cookie carries the persisted SecurityContext, so the same route
        // now passes authentication (any status other than 401 Unauthorized).
        mvc.perform(get("/api/v1/dashboard").cookie(sessionCookie))
                .andExpect(result ->
                        assertThat(result.getResponse().getStatus())
                                .as("authenticated request must not be 401")
                                .isNotEqualTo(401));
    }

    @Test
    void loginRotatesSessionIdToPreventFixation() throws Exception {
        LoginRequest body = new LoginRequest("carol@example.com", "correct-horse");

        // First login establishes a session and its TULIPSESSION cookie...
        MvcResult first = mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie preExisting = first.getResponse().getCookie("TULIPSESSION");
        assertThat(preExisting).as("first login establishes the TULIPSESSION cookie").isNotNull();

        // ...a second login while CARRYING that pre-existing cookie must rotate the id: the
        // authenticated session id must differ from the one presented before authentication.
        MvcResult second = mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .cookie(preExisting)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie rotated = second.getResponse().getCookie("TULIPSESSION");
        assertThat(rotated).as("login must emit a rotated TULIPSESSION cookie").isNotNull();
        assertThat(rotated.getValue())
                .as("session id must change on authentication (no session fixation)")
                .isNotBlank()
                .isNotEqualTo(preExisting.getValue());
    }

    @Test
    void loginWithBadPasswordReturns401() throws Exception {
        LoginRequest body = new LoginRequest("carol@example.com", "wrong-password");

        mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void loginWithUnknownEmailReturns401() throws Exception {
        LoginRequest body = new LoginRequest("nobody@example.com", "whatever1");

        mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }
}
