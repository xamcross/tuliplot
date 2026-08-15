package com.tuliplot.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;

class FreemiusGatewayImplTest {

  private MockRestServiceServer server;
  private FreemiusGatewayImpl gateway;

  @BeforeEach
  void setUp() {
    FreemiusConfig config = new FreemiusConfig();
    config.setProductId("37109");
    config.setApiToken("test-token");
    RestClient.Builder builder = RestClient.builder().baseUrl(config.getApiBaseUrl());
    server = MockRestServiceServer.bindTo(builder).build();
    gateway = new FreemiusGatewayImpl(config, builder);
  }

  @Test
  void retrieveLicense_parses_the_documented_fields_and_sends_bearer_auth() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/licenses/555.json"))
        .andExpect(method(GET))
        .andExpect(header("Authorization", "Bearer test-token"))
        .andRespond(withSuccess("""
            {"id":555,"plan_id":61603,"user_id":42,
             "expiration":"2026-09-15 10:00:00","is_cancelled":false,
             "unknown_field":"ignored"}
            """, MediaType.APPLICATION_JSON));

    FreemiusLicenseSnapshot snap = gateway.retrieveLicense("555");

    assertThat(snap.licenseId()).isEqualTo("555");
    assertThat(snap.planId()).isEqualTo("61603");
    assertThat(snap.userId()).isEqualTo("42");
    assertThat(snap.expiration()).isEqualTo(Instant.parse("2026-09-15T10:00:00Z"));
    assertThat(snap.cancelled()).isFalse();
  }

  @Test
  void retrieveLicense_null_expiration_means_lifetime() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/licenses/555.json"))
        .andRespond(withSuccess(
            "{\"id\":555,\"plan_id\":61603,\"user_id\":42,\"expiration\":null,\"is_cancelled\":false}",
            MediaType.APPLICATION_JSON));

    assertThat(gateway.retrieveLicense("555").expiration()).isNull();
  }

  @Test
  void retrieveLicense_404_raises_not_found() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/licenses/999.json"))
        .andRespond(withStatus(HttpStatus.NOT_FOUND));

    assertThatExceptionOfType(FreemiusNotFoundException.class)
        .isThrownBy(() -> gateway.retrieveLicense("999"));
  }

  @Test
  void retrieveSubscription_parses_trial_and_cancellation() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/licenses/555/subscription.json"))
        .andExpect(method(GET))
        .andRespond(withSuccess("""
            {"id":77,"trial_ends":"2026-08-29 10:00:00",
             "next_payment":null,"canceled_at":null}
            """, MediaType.APPLICATION_JSON));

    FreemiusSubscriptionSnapshot sub = gateway.retrieveSubscription("555");
    assertThat(sub.trialEnds()).isEqualTo(Instant.parse("2026-08-29T10:00:00Z"));
    assertThat(sub.nextPayment()).isNull();
    assertThat(sub.canceledAt()).isNull();
  }

  @Test
  void retrieveUserEmail_reads_the_user_entity() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/users/42.json"))
        .andExpect(method(GET))
        .andRespond(withSuccess("{\"id\":42,\"email\":\"buyer@example.com\"}",
            MediaType.APPLICATION_JSON));

    assertThat(gateway.retrieveUserEmail("42")).isEqualTo("buyer@example.com");
  }

  @Test
  void createPortalLoginUrl_posts_the_email_and_returns_the_url() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/portal/login.json"))
        .andExpect(method(POST))
        .andExpect(content().json("{\"email\":\"buyer@example.com\"}"))
        .andRespond(withSuccess("{\"url\":\"https://users.freemius.com/login/abc\"}",
            MediaType.APPLICATION_JSON));

    assertThat(gateway.createPortalLoginUrl("buyer@example.com"))
        .isEqualTo("https://users.freemius.com/login/abc");
  }

  @Test
  void createPortalLoginUrl_404_raises_not_found() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/portal/login.json"))
        .andExpect(method(POST))
        .andRespond(withStatus(HttpStatus.NOT_FOUND));

    assertThatExceptionOfType(FreemiusNotFoundException.class)
        .isThrownBy(() -> gateway.createPortalLoginUrl("buyer@example.com"));
  }

  @Test
  void transport_error_wraps_in_gateway_exception() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/licenses/555.json"))
        .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

    assertThatExceptionOfType(FreemiusGatewayException.class)
        .isThrownBy(() -> gateway.retrieveLicense("555"));
  }
}
