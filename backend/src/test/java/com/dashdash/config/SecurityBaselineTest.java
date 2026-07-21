package com.dashdash.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.common.HealthController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, CorsConfig.class})
class SecurityBaselineTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void preflightReturnsCorsHeaders() throws Exception {
        mockMvc.perform(options("/api/v1/health")
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void getIssuesXsrfTokenCookie() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("XSRF-TOKEN"));
    }

    @Test
    void unauthenticatedProtectedRouteReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard"))
                .andExpect(status().isUnauthorized());
    }
}
