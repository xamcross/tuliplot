package com.tuliplot.billing;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// application.yml binds tuliplot.freemius.secret-key to ${FREEMIUS_SECRET_KEY:} (empty
// default). ConfigurationPropertiesBindingPostProcessor rebinds ANY @ConfigurationProperties
// bean instance from the environment after creation -- including one built by hand in the
// @Bean method below -- so without this override the rebind clobbers TestConfig's
// setSecretKey(SECRET) back to "". The properties override below makes the environment
// itself agree with SECRET.
@WebMvcTest(controllers = FreemiusWebhookController.class,
    properties = "tuliplot.freemius.secret-key=whsec-test",
    excludeAutoConfiguration = {
        org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration.class,
        org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration.class,
        org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration.class,
        org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration.class,
        org.springframework.boot.security.oauth2.client.autoconfigure.OAuth2ClientAutoConfiguration.class,
        org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration.class})
@Import(FreemiusWebhookControllerTest.TestConfig.class)
class FreemiusWebhookControllerTest {

  static final String SECRET = "whsec-test";

  @org.springframework.boot.test.context.TestConfiguration
  static class TestConfig {
    @org.springframework.context.annotation.Bean
    FreemiusConfig freemiusConfig() {
      FreemiusConfig c = new FreemiusConfig();
      c.setSecretKey(SECRET);
      return c;
    }
  }

  @Autowired MockMvc mvc;
  @MockitoBean SubscriptionService subscriptionService;

  private static String sign(String body) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
  }

  private static final String LICENSE_CREATED = """
      {"id":"evt-1","type":"license.created",
       "objects":{"license":{"id":555},"user":{"id":42,"email":"buyer@example.com"}}}
      """;

  @Test
  void valid_signature_applies_the_license_and_marks_processed() throws Exception {
    when(subscriptionService.alreadyProcessed("evt-1")).thenReturn(false);
    mvc.perform(post("/api/v1/billing/webhook")
            .content(LICENSE_CREATED)
            .header("X-Signature", sign(LICENSE_CREATED)))
        .andExpect(status().isOk());
    verify(subscriptionService).applyLicense("555");
    verify(subscriptionService).markProcessed("evt-1", "license.created");
  }

  @Test
  void invalid_signature_is_401_and_does_nothing() throws Exception {
    mvc.perform(post("/api/v1/billing/webhook")
            .content(LICENSE_CREATED)
            .header("X-Signature", "deadbeef"))
        .andExpect(status().isUnauthorized());
    verify(subscriptionService, never()).applyLicense(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void missing_signature_is_401() throws Exception {
    mvc.perform(post("/api/v1/billing/webhook").content(LICENSE_CREATED))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void duplicate_event_is_200_and_skips_work() throws Exception {
    when(subscriptionService.alreadyProcessed("evt-1")).thenReturn(true);
    mvc.perform(post("/api/v1/billing/webhook")
            .content(LICENSE_CREATED)
            .header("X-Signature", sign(LICENSE_CREATED)))
        .andExpect(status().isOk());
    verify(subscriptionService, never()).applyLicense(org.mockito.ArgumentMatchers.any());
    verify(subscriptionService, never()).markProcessed(org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void unhandled_event_type_is_200_marked_but_not_applied() throws Exception {
    String body = """
        {"id":"evt-2","type":"user.updated","objects":{"user":{"id":42}}}
        """;
    when(subscriptionService.alreadyProcessed("evt-2")).thenReturn(false);
    mvc.perform(post("/api/v1/billing/webhook")
            .content(body).header("X-Signature", sign(body)))
        .andExpect(status().isOk());
    verify(subscriptionService, never()).applyLicense(org.mockito.ArgumentMatchers.any());
    verify(subscriptionService).markProcessed("evt-2", "user.updated");
  }

  @Test
  void gateway_failure_is_500_and_not_marked_so_freemius_retries() throws Exception {
    when(subscriptionService.alreadyProcessed("evt-1")).thenReturn(false);
    doThrow(new FreemiusGatewayException("api down"))
        .when(subscriptionService).applyLicense("555");
    mvc.perform(post("/api/v1/billing/webhook")
            .content(LICENSE_CREATED)
            .header("X-Signature", sign(LICENSE_CREATED)))
        .andExpect(status().isInternalServerError());
    verify(subscriptionService, never()).markProcessed(org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }

  // Finding 1 (final review): the handler must not be narrowed to FreemiusGatewayException.
  // A plain RuntimeException from applyLicense (e.g. a Mongo DataAccessException, or a
  // FreemiusNotFoundException from retrieveSubscription/retrieveUserEmail) must ALSO answer
  // 500, not fall through to /error (which SecurityConfig blocks) and surface as a
  // permanent-looking 401.
  @Test
  void unhandled_runtime_exception_is_500_and_not_marked_so_freemius_retries() throws Exception {
    when(subscriptionService.alreadyProcessed("evt-1")).thenReturn(false);
    doThrow(new RuntimeException("boom"))
        .when(subscriptionService).applyLicense("555");
    mvc.perform(post("/api/v1/billing/webhook")
            .content(LICENSE_CREATED)
            .header("X-Signature", sign(LICENSE_CREATED)))
        .andExpect(status().isInternalServerError());
    verify(subscriptionService, never()).markProcessed(org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }
}
