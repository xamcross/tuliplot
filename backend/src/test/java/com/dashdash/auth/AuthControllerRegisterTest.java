package com.dashdash.auth;

import com.dashdash.testsupport.MongoTestUri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.dashboard.CellType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import tools.jackson.databind.ObjectMapper;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)   // exercise the controller/service/session write without the security chain (Task 4 tests the chain)
class AuthControllerRegisterTest {

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

    @BeforeEach
    void clean() {
        mongoTemplate.getCollection("users").drop();
    }

    @Test
    void registerCreatesFreeUserAndEstablishesSession() throws Exception {
        RegisterRequest body = new RegisterRequest("New.User@Example.com", "hunter2pass", "New User");

        var result = mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("new.user@example.com"))
                .andExpect(jsonPath("$.displayName").value("New User"))
                .andExpect(jsonPath("$.tier").value("FREE"))
                .andExpect(jsonPath("$.adFree").value(false))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn();

        Object ctx = result.getRequest().getSession(false)
                .getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertThat(ctx).as("security context saved to session").isNotNull();

        User saved = users.findByEmail("new.user@example.com").orElseThrow();
        assertThat(saved.getPasswordHash()).startsWith("{bcrypt}");
        assertThat(saved.getPasswordHash()).isNotEqualTo("hunter2pass");
        assertThat(saved.getDashboard().getCells()).hasSize(6);
        assertThat(saved.getDashboard().getCells().get(5).getType()).isEqualTo(CellType.AD);
        assertThat(saved.getSubscription().getTier()).isEqualTo(Tier.FREE);
        assertThat(saved.getSubscription().getStatus()).isEqualTo(SubStatus.NONE);
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        RegisterRequest body = new RegisterRequest("dupe@example.com", "hunter2pass", "Dupe");
        mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_IN_USE"));
    }
}
