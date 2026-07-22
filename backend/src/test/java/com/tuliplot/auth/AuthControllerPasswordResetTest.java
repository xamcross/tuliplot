package com.tuliplot.auth;

import com.tuliplot.testsupport.MongoTestUri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tuliplot.auth.dto.PasswordResetConfirm;
import com.tuliplot.auth.dto.PasswordResetRequest;
import com.tuliplot.dashboard.Dashboard;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerPasswordResetTest {

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

    @MockitoBean EmailSender emailSender;   // capture the emailed reset link → extract the raw token

    @BeforeEach
    void seed() {
        mongoTemplate.getCollection("users").drop();
        mongoTemplate.getCollection("password_reset_tokens").drop();
        User u = new User();
        u.setEmail("reset@example.com");
        u.setPasswordHash(passwordEncoder.encode("old-password1"));
        u.setDisplayName("Reset User");
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setSubscription(new Subscription());
        u.setDashboard(Dashboard.defaultFor(false));
        users.save(u);
    }

    /** Requests a reset for the seeded user and returns the raw token from the emailed link. */
    private String requestAndCaptureToken() throws Exception {
        mvc.perform(post("/api/v1/auth/password-reset/request")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new PasswordResetRequest("reset@example.com"))))
                .andExpect(status().isNoContent());

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailSender).send(eq("reset@example.com"), anyString(), body.capture());
        String link = body.getValue();
        return link.substring(link.indexOf("token=") + "token=".length());
    }

    @Test
    void requestReturns204AndConfirmResetsThePassword() throws Exception {
        String token = requestAndCaptureToken();

        mvc.perform(post("/api/v1/auth/password-reset/confirm")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new PasswordResetConfirm(token, "brand-new-pass9"))))
                .andExpect(status().isNoContent());

        User updated = users.findByEmail("reset@example.com").orElseThrow();
        assertThat(passwordEncoder.matches("brand-new-pass9", updated.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("old-password1", updated.getPasswordHash())).isFalse();
    }

    @Test
    void reusingAConfirmedTokenReturns400() throws Exception {
        String token = requestAndCaptureToken();

        mvc.perform(post("/api/v1/auth/password-reset/confirm")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new PasswordResetConfirm(token, "first-new-pass9"))))
                .andExpect(status().isNoContent());

        // Single-use: the token was deleted on the first confirm → reusing it is rejected.
        mvc.perform(post("/api/v1/auth/password-reset/confirm")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new PasswordResetConfirm(token, "second-new-pass9"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RESET_TOKEN"));
    }

    @Test
    void requestForUnknownEmailStillReturns204() throws Exception {
        mvc.perform(post("/api/v1/auth/password-reset/request")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new PasswordResetRequest("nobody@example.com"))))
                .andExpect(status().isNoContent());
    }
}
