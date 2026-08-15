package com.tuliplot.billing;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/billing")
public class FreemiusWebhookController {

  /** Every license lifecycle event triggers the same API-resync. */
  private static final Set<String> HANDLED = Set.of(
      "license.created", "license.updated", "license.plan.changed",
      "license.extended", "license.shortened",
      "license.cancelled", "license.expired", "license.deleted");

  private final FreemiusConfig config;
  private final SubscriptionService subscriptionService;
  private final ObjectMapper mapper = new ObjectMapper();

  public FreemiusWebhookController(FreemiusConfig config, SubscriptionService subscriptionService) {
    this.config = config;
    this.subscriptionService = subscriptionService;
  }

  /**
   * Raw-body webhook. The body is consumed as byte[] so the HMAC is computed over the exact
   * bytes Freemius signed (never pre-parsed JSON). Public + CSRF-exempt via SecurityConfig.
   */
  @PostMapping("/webhook")
  public ResponseEntity<String> handle(@RequestBody byte[] payload,
                                       @RequestHeader(value = "X-Signature", required = false)
                                       String signature) {
    if (signature == null || !signatureMatches(payload, signature)) {
      return ResponseEntity.status(401).body("invalid signature");
    }
    JsonNode event = mapper.readTree(new String(payload, StandardCharsets.UTF_8));
    String eventId = event.path("id").asString();
    String type = event.path("type").asString();
    if (eventId == null || eventId.isBlank() || type == null || type.isBlank()) {
      return ResponseEntity.ok("ignored: no id/type");
    }
    if (subscriptionService.alreadyProcessed(eventId)) {
      return ResponseEntity.ok("duplicate");
    }
    if (HANDLED.contains(type)) {
      String licenseId = event.path("objects").path("license").path("id").asString();
      if (licenseId == null || licenseId.isBlank()) {
        return ResponseEntity.ok("ignored: no license id");
      }
      subscriptionService.applyLicense(licenseId);   // throws -> 500 -> Freemius retries
    }
    subscriptionService.markProcessed(eventId, type);
    return ResponseEntity.ok("ok");
  }

  /**
   * Explicit 500 for EVERY post-signature failure, not only FreemiusGatewayException: a
   * FreemiusNotFoundException from retrieveSubscription/retrieveUserEmail, a Mongo
   * DataAccessException from existsById/save/markProcessed, or a Jackson parse exception
   * must all land here too. A narrower handler would let those escape to the /error
   * dispatch, which SecurityConfig does not permit, and surface as 401 (the known
   * error-masking defect from PR #15). Freemius may treat a 4xx as permanent and stop the
   * retries; a real 500 keeps them coming until the failure clears. The 401 above stays
   * exclusive to signature verification.
   */
  @org.springframework.web.bind.annotation.ExceptionHandler(RuntimeException.class)
  public ResponseEntity<String> handleProcessingFailure(RuntimeException e) {
    return ResponseEntity.status(500).body("webhook processing failure");
  }

  private boolean signatureMatches(byte[] payload, String signature) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(
          config.getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      String expected = HexFormat.of().formatHex(mac.doFinal(payload));
      return MessageDigest.isEqual(
          expected.getBytes(StandardCharsets.UTF_8),
          signature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      return false;
    }
  }
}
