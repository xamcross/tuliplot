package com.tuliplot.billing;

import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Component
public class FreemiusGatewayImpl implements FreemiusGateway {

  private static final DateTimeFormatter FS_DATETIME =
      DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private final FreemiusConfig config;
  private final RestClient restClient;
  private final ObjectMapper mapper = new ObjectMapper();

  // Connect/read timeouts for this RestClient.Builder come from spring.http.clients.connect-timeout
  // / read-timeout in application.yml (see the note there for why they live in config rather than a
  // requestFactory(...) call here — a hand-rolled request factory would silently replace the mock
  // wiring that MockRestServiceServer.bindTo(builder) installs on this same builder in tests).
  public FreemiusGatewayImpl(FreemiusConfig config, RestClient.Builder builder) {
    this.config = config;
    this.restClient = builder
        .baseUrl(config.getApiBaseUrl())
        .defaultHeader("Authorization", "Bearer " + config.getApiToken())
        .build();
  }

  @Override
  public FreemiusLicenseSnapshot retrieveLicense(String licenseId) {
    JsonNode n = getJson("/products/%s/licenses/%s.json".formatted(config.getProductId(), licenseId));
    return new FreemiusLicenseSnapshot(
        n.path("id").asString(),
        n.path("plan_id").asString(),
        n.path("user_id").asString(),
        parseInstant(n.path("expiration")),
        n.path("is_cancelled").asBoolean(false));
  }

  @Override
  public FreemiusSubscriptionSnapshot retrieveSubscription(String licenseId) {
    JsonNode n = getJson("/products/%s/licenses/%s/subscription.json"
        .formatted(config.getProductId(), licenseId));
    return new FreemiusSubscriptionSnapshot(
        parseInstant(n.path("trial_ends")),
        parseInstant(n.path("next_payment")),
        parseInstant(n.path("canceled_at")));
  }

  @Override
  public String retrieveUserEmail(String userId) {
    JsonNode n = getJson("/products/%s/users/%s.json".formatted(config.getProductId(), userId));
    return n.path("email").asString();
  }

  @Override
  public String createPortalLoginUrl(String email) {
    String path = "/products/%s/portal/login.json".formatted(config.getProductId());
    try {
      String body = restClient.post()
          .uri(path)
          .body(mapper.createObjectNode().put("email", email).toString())
          .header("Content-Type", "application/json")
          .retrieve()
          .onStatus(HttpStatusCode::is4xxClientError, notFoundAwareErrorHandler(path))
          .body(String.class);
      JsonNode n = mapper.readTree(body);
      String url = n.path("url").asString();
      if (url == null || url.isBlank()) {
        throw new FreemiusGatewayException("portal login response had no url: " + body);
      }
      return url;
    } catch (FreemiusNotFoundException | FreemiusGatewayException e) {
      throw e;
    } catch (Exception e) {
      throw new FreemiusGatewayException("portal login failed", e);
    }
  }

  private JsonNode getJson(String path) {
    try {
      String body = restClient.get().uri(path)
          .retrieve()
          .onStatus(HttpStatusCode::is4xxClientError, notFoundAwareErrorHandler(path))
          .body(String.class);
      return mapper.readTree(body);
    } catch (FreemiusNotFoundException | FreemiusGatewayException e) {
      throw e;
    } catch (Exception e) {
      throw new FreemiusGatewayException("GET " + path + " failed", e);
    }
  }

  // Shared 4xx handler: a 404 always means "not found" (deleted license, unknown user, etc.);
  // every other 4xx is a generic gateway failure. Used by both the GET and POST call sites so
  // callers can tell "not found" apart from other failures regardless of HTTP method.
  private static RestClient.ResponseSpec.ErrorHandler notFoundAwareErrorHandler(String path) {
    return (req, res) -> {
      if (res.getStatusCode().value() == 404) {
        throw new FreemiusNotFoundException("404 from " + path);
      }
      throw new FreemiusGatewayException("client error " + res.getStatusCode() + " from " + path);
    };
  }

  private static Instant parseInstant(JsonNode node) {
    if (node == null || node.isNull() || node.isMissingNode()) {
      return null;
    }
    String s = node.asString();
    if (s == null || s.isBlank() || "null".equals(s)) {
      return null;
    }
    return LocalDateTime.parse(s, FS_DATETIME).toInstant(ZoneOffset.UTC);
  }
}
