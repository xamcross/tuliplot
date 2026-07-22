package com.dashdash.auth;

import com.dashdash.testsupport.MongoTestUri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.auth.dto.LoginRequest;
import com.dashdash.dashboard.Dashboard;
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
class AuthControllerSessionTest {

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
        u.setEmail("dave@example.com");
        u.setPasswordHash(passwordEncoder.encode("passphrase9"));
        u.setDisplayName("Dave");
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setSubscription(new Subscription());
        u.setDashboard(Dashboard.defaultFor(false));
        users.save(u);
    }

    // Plan 01's Mongo-backed Spring Session is active under @SpringBootTest, so the session is
    // carried by the DASHSESSION cookie (not a servlet MockHttpSession); mirror the Task 4 login
    // test and drive subsequent requests with that cookie.
    private Cookie loginCookie() throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginRequest("dave@example.com", "passphrase9"))))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("DASHSESSION");
        assertThat(cookie).as("login establishes the DASHSESSION cookie").isNotNull();
        return cookie;
    }

    @Test
    void meReturnsUserDtoForAuthenticatedSession() throws Exception {
        Cookie session = loginCookie();

        mvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("dave@example.com"))
                .andExpect(jsonPath("$.displayName").value("Dave"))
                .andExpect(jsonPath("$.tier").value("FREE"))
                .andExpect(jsonPath("$.adFree").value(false));
    }

    @Test
    void meReturns401WhenAnonymous() throws Exception {
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutInvalidatesSessionAndReturns204() throws Exception {
        Cookie session = loginCookie();

        mvc.perform(post("/api/v1/auth/logout").with(csrf()).cookie(session))
                .andExpect(status().isNoContent());

        // The old session is invalidated → /me with it is anonymous → 401.
        mvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isUnauthorized());
    }
}
