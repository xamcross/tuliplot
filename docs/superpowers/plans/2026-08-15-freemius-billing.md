# Freemius Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct-Stripe billing module with a Freemius (merchant-of-record) integration and delete the Stripe code.

**Architecture:** The flow keeps the proven shape: event → verify → dedupe → retrieve from the API → resync the tier. A new `FreemiusWebhookController` verifies HMAC-SHA256 signatures. A new `FreemiusGateway` fetches the license, the subscription, and the buyer email from the Freemius API. The existing `SubscriptionService` tier state machine and `reconcileForTier` survive with a new entry point. The frontend opens the Freemius overlay checkout; the webhook flips the tier.

**Tech Stack:** Spring Boot 4.1 / Java 25, Spring `RestClient`, Jackson 3 (`tools.jackson`), MongoDB, Angular 22 (signals, vitest), Freemius Checkout JS (`https://checkout.freemius.com/js/v1/`).

**Spec:** `docs/superpowers/specs/2026-08-15-freemius-billing-design.md`

## Global Constraints

- Product facts: `productId=37109`, `planId=61603`, public key `pk_dd68d3c56014484d645d69d91d734`, price $4/month.
- Webhook path stays `POST /api/v1/billing/webhook` (SecurityConfig already permits it and exempts CSRF — do not touch SecurityConfig).
- The signature header is `X-Signature`: hex HMAC-SHA256 over the raw body, key = the product **secret key**. Compare with `MessageDigest.isEqual`.
- The API base is `https://api.freemius.com/v1`. Auth: `Authorization: Bearer <api token>` — the API token is a separate credential from the secret key.
- Env vars: `FREEMIUS_PRODUCT_ID`, `FREEMIUS_SECRET_KEY`, `FREEMIUS_API_TOKEN`. All default empty so the app boots without billing.
- Freemius datetimes are UTC strings `yyyy-MM-dd HH:mm:ss`. `expiration` is null for a lifetime license.
- Field names (`is_cancelled`, `canceled_at`, `trial_ends`, `next_payment`) are pinned from the docs; Task 12's sandbox check validates them. Parse tolerantly: ignore unknown JSON fields.
- Backend tests: Boot 4.1 relocations apply — `@WebMvcTest` = `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`. Jackson 3 mapper = `tools.jackson.databind.ObjectMapper`. Mongo-bound tests need Docker (`DOCKER_API_VERSION=1.44`) or `MONGODB_TEST_URI=mongodb://localhost:27017`.
- Frontend builds need the pinned Node at `C:\Users\xamcr\.dashdash-tooling\node-v22.22.3-win-x64` prepended to PATH; vitest runs on the system node.
- Commit subjects use conventional commits. The extension is untouched.
- Never write the secret key or the API token into any file. They are Fly secrets only.

---

### Task 1: Rename the dedupe entity to ProcessedBillingEvent

**Files:**
- Rename: `backend/src/main/java/com/tuliplot/billing/ProcessedStripeEvent.java` → `ProcessedBillingEvent.java`
- Rename: `backend/src/main/java/com/tuliplot/billing/ProcessedStripeEventRepository.java` → `ProcessedBillingEventRepository.java`
- Modify: `backend/src/main/java/com/tuliplot/billing/SubscriptionService.java` (field + `markProcessed`)
- Modify: `backend/src/main/java/com/tuliplot/config/MongoIndexConfig.java` (collection name)
- Rename: `backend/src/test/java/com/tuliplot/billing/ProcessedStripeEventRepositoryTest.java` → `ProcessedBillingEventRepositoryTest.java`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ProcessedBillingEvent` (`@Document("processed_billing_events")`, fields `id`, `type`, `processedAt`) and `ProcessedBillingEventRepository extends MongoRepository<ProcessedBillingEvent, String>`. Later tasks reference these names.

- [ ] **Step 1: Rename the entity, the repository, and every reference**

New entity content (class + collection renamed, fields unchanged):

```java
package com.tuliplot.billing;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("processed_billing_events")
public class ProcessedBillingEvent {

  @Id
  private String id;      // = billing-provider event id
  private String type;
  private Instant processedAt;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getType() { return type; }
  public void setType(String type) { this.type = type; }

  public Instant getProcessedAt() { return processedAt; }
  public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }
}
```

Repository:

```java
package com.tuliplot.billing;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProcessedBillingEventRepository extends MongoRepository<ProcessedBillingEvent, String> {
}
```

In `SubscriptionService`, rename the field type and the constructor
parameter, and update `markProcessed` to build a `ProcessedBillingEvent`.
In `MongoIndexConfig`, change `indexOps("stripe_events")` to
`indexOps("processed_billing_events")` and update the two comments that
say `stripe_events`. In the renamed repository test, update the class
names and the collection expectation; keep the TTL assertions.

- [ ] **Step 2: Run the backend suite**

Run: `cd backend && ./gradlew test`
Expected: PASS (rename only; behavior unchanged)

- [ ] **Step 3: Commit**

```bash
git add -A backend
git commit -m "refactor(billing): rename dedupe entity to ProcessedBillingEvent"
```

---

### Task 2: FreemiusConfig + application.yml block

**Files:**
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusConfig.java`
- Modify: `backend/src/main/resources/application.yml` (replace the `tuliplot.stripe` block)
- Modify: `backend/src/main/java/com/tuliplot/config/AppConfig.java` — find the `@EnableConfigurationProperties(StripeConfig.class)` (or `@ConfigurationPropertiesScan`) wiring with `grep -r "StripeConfig" backend/src/main` and register `FreemiusConfig` the same way. Keep `StripeConfig` registered until Task 7 deletes it.
- Create: `backend/src/test/java/com/tuliplot/billing/FreemiusConfigTest.java`

**Interfaces:**
- Produces: `FreemiusConfig` with getters `getProductId()`, `getSecretKey()`, `getApiToken()`, `getApiBaseUrl()`. Later tasks inject it.

- [ ] **Step 1: Write the failing test**

```java
package com.tuliplot.billing;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FreemiusConfigTest {

  @Test
  void defaults_are_bootable_without_billing() {
    FreemiusConfig config = new FreemiusConfig();
    assertThat(config.getProductId()).isEmpty();
    assertThat(config.getSecretKey()).isEmpty();
    assertThat(config.getApiToken()).isEmpty();
    assertThat(config.getApiBaseUrl()).isEqualTo("https://api.freemius.com/v1");
  }
}
```

- [ ] **Step 2: Run it — expect FAIL (class missing)**

Run: `cd backend && ./gradlew test --tests FreemiusConfigTest`

- [ ] **Step 3: Implement**

```java
package com.tuliplot.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tuliplot.freemius")
public class FreemiusConfig {

  private String productId = "";
  private String secretKey = "";
  private String apiToken = "";
  private String apiBaseUrl = "https://api.freemius.com/v1";

  public String getProductId() { return productId; }
  public void setProductId(String productId) { this.productId = productId; }

  public String getSecretKey() { return secretKey; }
  public void setSecretKey(String secretKey) { this.secretKey = secretKey; }

  public String getApiToken() { return apiToken; }
  public void setApiToken(String apiToken) { this.apiToken = apiToken; }

  public String getApiBaseUrl() { return apiBaseUrl; }
  public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }
}
```

`application.yml` — add under `tuliplot:` (leave the `stripe:` block in
place until Task 7):

```yaml
  freemius:
    # Freemius (env-driven; empty defaults keep the app bootable in dev without billing)
    product-id: ${FREEMIUS_PRODUCT_ID:}
    secret-key: ${FREEMIUS_SECRET_KEY:}
    api-token: ${FREEMIUS_API_TOKEN:}
    api-base-url: ${FREEMIUS_API_BASE_URL:https://api.freemius.com/v1}
```

- [ ] **Step 4: Run the suite — expect PASS**

Run: `cd backend && ./gradlew test`

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(billing): FreemiusConfig properties, env-driven with bootable defaults"
```

---

### Task 3: FreemiusGateway + snapshots + RestClient implementation

**Files:**
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusLicenseSnapshot.java`
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusSubscriptionSnapshot.java`
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusGateway.java`
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusGatewayImpl.java`
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusGatewayException.java`
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusNotFoundException.java`
- Create: `backend/src/test/java/com/tuliplot/billing/FreemiusGatewayImplTest.java`

**Interfaces:**
- Consumes: `FreemiusConfig` (Task 2).
- Produces:
  - `record FreemiusLicenseSnapshot(String licenseId, String planId, String userId, java.time.Instant expiration, boolean cancelled)`
  - `record FreemiusSubscriptionSnapshot(java.time.Instant trialEnds, java.time.Instant nextPayment, java.time.Instant canceledAt)`
  - `interface FreemiusGateway { FreemiusLicenseSnapshot retrieveLicense(String licenseId); FreemiusSubscriptionSnapshot retrieveSubscription(String licenseId); String retrieveUserEmail(String userId); String createPortalLoginUrl(String email); }`
  - `FreemiusNotFoundException` (unchecked) on HTTP 404; `FreemiusGatewayException` (unchecked) on any other failure.

- [ ] **Step 1: Write the failing test**

Bind a `MockRestServiceServer` to the builder — no test-slice annotation
needed:

```java
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
        .andRespond(withSuccess("{\"url\":\"https://users.freemius.com/login/abc\"}",
            MediaType.APPLICATION_JSON));

    assertThat(gateway.createPortalLoginUrl("buyer@example.com"))
        .isEqualTo("https://users.freemius.com/login/abc");
  }

  @Test
  void transport_error_wraps_in_gateway_exception() {
    server.expect(requestTo("https://api.freemius.com/v1/products/37109/licenses/555.json"))
        .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

    assertThatExceptionOfType(FreemiusGatewayException.class)
        .isThrownBy(() -> gateway.retrieveLicense("555"));
  }
}
```

- [ ] **Step 2: Run it — expect FAIL (classes missing)**

Run: `cd backend && ./gradlew test --tests FreemiusGatewayImplTest`

- [ ] **Step 3: Implement**

Exceptions:

```java
package com.tuliplot.billing;

/** Unchecked wrapper for any Freemius API failure other than 404. */
public class FreemiusGatewayException extends RuntimeException {
  public FreemiusGatewayException(String message, Throwable cause) { super(message, cause); }
  public FreemiusGatewayException(String message) { super(message); }
}
```

```java
package com.tuliplot.billing;

/** The Freemius API returned 404 — e.g. a deleted license. */
public class FreemiusNotFoundException extends RuntimeException {
  public FreemiusNotFoundException(String message) { super(message); }
}
```

Records:

```java
package com.tuliplot.billing;

import java.time.Instant;

/** License state fetched from the Freemius API. expiration == null means lifetime. */
public record FreemiusLicenseSnapshot(
    String licenseId, String planId, String userId, Instant expiration, boolean cancelled) {}
```

```java
package com.tuliplot.billing;

import java.time.Instant;

/** Renewal state of the subscription behind a license. Every field is nullable. */
public record FreemiusSubscriptionSnapshot(
    Instant trialEnds, Instant nextPayment, Instant canceledAt) {}
```

Interface:

```java
package com.tuliplot.billing;

public interface FreemiusGateway {
  FreemiusLicenseSnapshot retrieveLicense(String licenseId);
  FreemiusSubscriptionSnapshot retrieveSubscription(String licenseId);
  String retrieveUserEmail(String userId);
  String createPortalLoginUrl(String email);
}
```

Implementation (Jackson 3 `tools.jackson.databind.JsonNode` tree reads;
`asText(null)` keeps nulls null):

```java
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
    try {
      String body = restClient.post()
          .uri("/products/{pid}/portal/login.json", config.getProductId())
          .body(mapper.createObjectNode().put("email", email).toString())
          .header("Content-Type", "application/json")
          .retrieve()
          .body(String.class);
      JsonNode n = mapper.readTree(body);
      String url = n.path("url").asString();
      if (url == null || url.isBlank()) {
        throw new FreemiusGatewayException("portal login response had no url: " + body);
      }
      return url;
    } catch (FreemiusGatewayException e) {
      throw e;
    } catch (Exception e) {
      throw new FreemiusGatewayException("portal login failed", e);
    }
  }

  private JsonNode getJson(String path) {
    try {
      String body = restClient.get().uri(path)
          .retrieve()
          .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
            if (res.getStatusCode().value() == 404) {
              throw new FreemiusNotFoundException("404 from " + path);
            }
            throw new FreemiusGatewayException("client error " + res.getStatusCode() + " from " + path);
          })
          .body(String.class);
      return mapper.readTree(body);
    } catch (FreemiusNotFoundException | FreemiusGatewayException e) {
      throw e;
    } catch (Exception e) {
      throw new FreemiusGatewayException("GET " + path + " failed", e);
    }
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
```

Note: if `asString()` does not exist on this Jackson 3 version, use
`asText()` — run the compile and keep whichever the API has.

- [ ] **Step 4: Run the suite — expect PASS**

Run: `cd backend && ./gradlew test --tests FreemiusGatewayImplTest`

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(billing): FreemiusGateway — license, subscription, user email, portal login"
```

---

### Task 4: Subscription model swap (fsLicenseId) + SubscriptionService rewrite

**Files:**
- Modify: `backend/src/main/java/com/tuliplot/auth/Subscription.java`
- Modify: `backend/src/main/java/com/tuliplot/auth/UserRepository.java`
- Modify: `backend/src/main/java/com/tuliplot/billing/SubscriptionService.java`
- Modify: `backend/src/test/java/com/tuliplot/billing/SubscriptionServiceStateMachineTest.java` (rewrite)
- Modify: `backend/src/test/java/com/tuliplot/billing/SubscriptionServiceDedupeTest.java` — the behavior it tests (`alreadyProcessed`/`markProcessed`) survives, but the service constructor changes in this task: swap the mocked `StripeGateway` for a mocked `FreemiusGateway` in the constructor call. No assertion changes.
- Check usages first: `grep -rn "applyFromStripe\|handleDispute\|handleEvent\|StripeSubscriptionSnapshot\|findBySubscriptionStripe" backend/src` — the only production caller outside the billing package must be none; `StripeWebhookController` still compiles against the old entry points until Task 5 replaces it, so KEEP `handleEvent`/`applyFromStripe` compiling in this task by deleting them together with their callers in Task 5. To keep every task green, this task ADDS the new entry point and leaves the Stripe entry points in place.

**Interfaces:**
- Consumes: `FreemiusGateway`, `FreemiusLicenseSnapshot`, `FreemiusSubscriptionSnapshot`, `FreemiusNotFoundException` (Task 3).
- Produces:
  - `Subscription` gains `String fsLicenseId` (getter/setter `getFsLicenseId`/`setFsLicenseId`) and keeps every existing field for now.
  - `UserRepository` gains `Optional<User> findBySubscriptionFsLicenseId(String fsLicenseId)`.
  - `SubscriptionService.applyLicense(String licenseId)` — fetches from the gateway, matches the user by API email (fallback: by stored `fsLicenseId`), maps state, persists, reconciles on tier change.
  - `SubscriptionService.revokeByLicenseId(String licenseId)` — used when the API returns 404 (deleted license).

- [ ] **Step 1: Write the failing tests**

Rewrite `SubscriptionServiceStateMachineTest` (Mockito unit test, same
style the current file uses — mocked `FreemiusGateway`, `UserRepository`,
`DashboardService`, `ProcessedBillingEventRepository`). Cover:

```java
package com.tuliplot.billing;

import com.tuliplot.auth.SubStatus;
import com.tuliplot.auth.Subscription;
import com.tuliplot.auth.Tier;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.dashboard.Dashboard;
import com.tuliplot.dashboard.DashboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubscriptionServiceStateMachineTest {

  private static final Instant FUTURE = Instant.parse("2027-01-01T00:00:00Z");
  private static final Instant PAST = Instant.parse("2020-01-01T00:00:00Z");

  private FreemiusGateway gateway;
  private UserRepository users;
  private DashboardService dashboards;
  private ProcessedBillingEventRepository events;
  private SubscriptionService service;
  private User user;

  @BeforeEach
  void setUp() {
    gateway = mock(FreemiusGateway.class);
    users = mock(UserRepository.class);
    dashboards = mock(DashboardService.class);
    events = mock(ProcessedBillingEventRepository.class);
    service = new SubscriptionService(events, gateway, users, dashboards);

    user = new User();
    user.setEmail("buyer@example.com");
    user.setSubscription(new Subscription());
    when(users.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
    when(gateway.retrieveUserEmail("42")).thenReturn("buyer@example.com");
    when(dashboards.reconcileForTier(any(), org.mockito.ArgumentMatchers.anyBoolean()))
        .thenReturn(new Dashboard());
  }

  private void license(Instant expiration, boolean cancelled, Instant trialEnds) {
    when(gateway.retrieveLicense("555")).thenReturn(
        new FreemiusLicenseSnapshot("555", "61603", "42", expiration, cancelled));
    when(gateway.retrieveSubscription("555")).thenReturn(
        new FreemiusSubscriptionSnapshot(trialEnds, null, null));
  }

  @Test
  void active_license_grants_premium_and_reconciles_upgrade() {
    license(FUTURE, false, null);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.ACTIVE);
    assertThat(user.getSubscription().getFsLicenseId()).isEqualTo("555");
    assertThat(user.getSubscription().getCurrentPeriodEnd()).isEqualTo(FUTURE);
    verify(dashboards).reconcileForTier(any(), eq(true));
    verify(users).save(user);
  }

  @Test
  void lifetime_license_null_expiration_grants_premium() {
    license(null, false, null);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(user.getSubscription().getCurrentPeriodEnd()).isNull();
  }

  @Test
  void trial_maps_to_trialing_and_premium() {
    license(FUTURE, false, FUTURE);
    service.applyLicense("555");
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.TRIALING);
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
  }

  @Test
  void cancelled_but_not_expired_keeps_premium_with_cancel_flag() {
    license(FUTURE, true, null);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(user.getSubscription().isCancelAtPeriodEnd()).isTrue();
    assertThat(user.getSubscription().getCurrentPeriodEnd()).isEqualTo(FUTURE);
  }

  @Test
  void expired_license_downgrades_and_reconciles() {
    user.getSubscription().setTier(Tier.PREMIUM);
    license(PAST, true, null);
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboards).reconcileForTier(any(), eq(false));
  }

  @Test
  void no_tier_change_skips_reconcile() {
    user.getSubscription().setTier(Tier.PREMIUM);
    license(FUTURE, false, null);
    service.applyLicense("555");
    verify(dashboards, never()).reconcileForTier(any(), org.mockito.ArgumentMatchers.anyBoolean());
  }

  @Test
  void unknown_email_falls_back_to_stored_license_id_then_gives_up_silently() {
    when(users.findByEmail("buyer@example.com")).thenReturn(Optional.empty());
    when(users.findBySubscriptionFsLicenseId("555")).thenReturn(Optional.empty());
    license(FUTURE, false, null);
    service.applyLicense("555");   // must not throw
    verify(users, never()).save(any());
  }

  @Test
  void deleted_license_404_revokes_premium_via_stored_id() {
    user.getSubscription().setTier(Tier.PREMIUM);
    user.getSubscription().setFsLicenseId("555");
    when(gateway.retrieveLicense("555")).thenThrow(new FreemiusNotFoundException("gone"));
    when(users.findBySubscriptionFsLicenseId("555")).thenReturn(Optional.of(user));
    service.applyLicense("555");
    assertThat(user.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(user.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboards).reconcileForTier(any(), eq(false));
  }
}
```

- [ ] **Step 2: Run it — expect FAIL (constructor + methods missing)**

Run: `cd backend && ./gradlew test --tests SubscriptionServiceStateMachineTest`

- [ ] **Step 3: Implement**

`Subscription.java` — add below `stripeSubscriptionId`:

```java
    private String fsLicenseId;
```

```java
    public String getFsLicenseId() { return fsLicenseId; }
    public void setFsLicenseId(String fsLicenseId) { this.fsLicenseId = fsLicenseId; }
```

`UserRepository.java` — add:

```java
    Optional<User> findBySubscriptionFsLicenseId(String fsLicenseId);
```

`SubscriptionService.java` — replace the class body. The new service
depends on `FreemiusGateway` instead of `StripeGateway`. Keep
`alreadyProcessed`/`markProcessed` exactly as Task 1 left them. Delete
`handleEvent`, `applyFromStripe`, `handleDispute`, `resyncByCustomer`,
`mapStatus`, `deserialize` — and in the SAME commit delete their only
caller `StripeWebhookController.java` plus its tests
(`StripeWebhookControllerTest.java`,
`StripeWebhookControllerDispatchTest.java`), or the build breaks. The
webhook endpoint disappears in this commit and returns in Task 5; the
suite stays green because the controller tests leave with it.

```java
package com.tuliplot.billing;

import com.tuliplot.auth.SubStatus;
import com.tuliplot.auth.Subscription;
import com.tuliplot.auth.Tier;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.dashboard.Dashboard;
import com.tuliplot.dashboard.DashboardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class SubscriptionService {

  private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

  private final ProcessedBillingEventRepository processedEvents;
  private final FreemiusGateway gateway;
  private final UserRepository userRepository;
  private final DashboardService dashboardService;

  public SubscriptionService(ProcessedBillingEventRepository processedEvents,
                             FreemiusGateway gateway,
                             UserRepository userRepository,
                             DashboardService dashboardService) {
    this.processedEvents = processedEvents;
    this.gateway = gateway;
    this.userRepository = userRepository;
    this.dashboardService = dashboardService;
  }

  // ---- idempotency ----------------------------------------------------------

  public boolean alreadyProcessed(String eventId) {
    return processedEvents.existsById(eventId);
  }

  public void markProcessed(String eventId, String type) {
    ProcessedBillingEvent e = new ProcessedBillingEvent();
    e.setId(eventId);
    e.setType(type);
    e.setProcessedAt(Instant.now());
    processedEvents.save(e);
  }

  // ---- state transitions ----------------------------------------------------

  /**
   * Fetch the license from the Freemius API and resync the user's tier from it.
   * The webhook payload is only a trigger; the API is the source of truth.
   * A 404 means the license was deleted — revoke via the stored license id.
   */
  public void applyLicense(String licenseId) {
    FreemiusLicenseSnapshot license;
    try {
      license = gateway.retrieveLicense(licenseId);
    } catch (FreemiusNotFoundException e) {
      revokeByLicenseId(licenseId);
      return;
    }
    FreemiusSubscriptionSnapshot subscription = gateway.retrieveSubscription(licenseId);
    String email = gateway.retrieveUserEmail(license.userId());

    User user = userRepository.findByEmail(email)
        .or(() -> userRepository.findBySubscriptionFsLicenseId(licenseId))
        .orElse(null);
    if (user == null) {
      // A 4xx would make Freemius retry a permanently unmatchable event; ack and log instead.
      log.warn("freemius license {} matches no account (email from API: {})", licenseId, email);
      return;
    }

    Instant now = Instant.now();
    boolean expired = license.expiration() != null && license.expiration().isBefore(now);
    boolean inTrial = subscription.trialEnds() != null && now.isBefore(subscription.trialEnds());

    SubStatus status;
    if (expired) {
      status = SubStatus.CANCELED;
    } else if (inTrial) {
      status = SubStatus.TRIALING;
    } else {
      status = SubStatus.ACTIVE;
    }
    boolean premium = status == SubStatus.ACTIVE || status == SubStatus.TRIALING;

    Subscription sub = user.getSubscription();
    boolean wasPremium = sub.getTier() == Tier.PREMIUM;
    sub.setStatus(status);
    sub.setTier(premium ? Tier.PREMIUM : Tier.FREE);
    sub.setFsLicenseId(license.licenseId());
    sub.setPriceId(license.planId());
    sub.setCurrentPeriodEnd(license.expiration());
    sub.setCancelAtPeriodEnd(license.cancelled() && !expired);

    reconcileIfTierChanged(user, wasPremium, premium);
    userRepository.save(user);
  }

  /** The license is gone (deleted at Freemius). Revoke premium if we know the license. */
  public void revokeByLicenseId(String licenseId) {
    userRepository.findBySubscriptionFsLicenseId(licenseId).ifPresent(user -> {
      Subscription sub = user.getSubscription();
      boolean wasPremium = sub.getTier() == Tier.PREMIUM;
      sub.setTier(Tier.FREE);
      sub.setStatus(SubStatus.CANCELED);
      sub.setCancelAtPeriodEnd(false);
      reconcileIfTierChanged(user, wasPremium, false);
      userRepository.save(user);
    });
  }

  private void reconcileIfTierChanged(User user, boolean wasPremium, boolean premium) {
    if (wasPremium != premium) {
      // Reconcile on ANY tier change, both directions:
      //  - downgrade PREMIUM->FREE: slot 5 -> AD (a displaced app is parked, never discarded);
      //  - upgrade FREE->PREMIUM: slot 5 AD -> EMPTY, so a premium dashboard never keeps a dead
      //    AD cell (which would also make every later updateCells 400).
      // Persist the WHOLE reconciled Dashboard returned by reconcileForTier — it may set
      // Dashboard.parkedApp when slot 5 held an app and no empty slot was free.
      Dashboard reconciled = dashboardService.reconcileForTier(user.getDashboard(), premium);
      user.setDashboard(reconciled);
    }
  }
}
```

Also delete in this commit: `StripeWebhookController.java`,
`StripeWebhookControllerTest.java`, `StripeWebhookControllerDispatchTest.java`,
`StripeSubscriptionSnapshot.java`, and the two `UserRepository` Stripe
finders (`findBySubscriptionStripeCustomerId`,
`findBySubscriptionStripeSubscriptionId`) IF `grep -rn
"findBySubscriptionStripe" backend/src` shows no other caller. Keep
`Subscription.stripeCustomerId`/`stripeSubscriptionId` fields until Task
7 (StripeService still compiles against them).

- [ ] **Step 4: Run the whole backend suite — expect PASS**

Run: `cd backend && ./gradlew test`

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(billing): SubscriptionService resyncs the tier from Freemius licenses"
```

---

### Task 5: FreemiusWebhookController — signature, dedupe, dispatch

**Files:**
- Create: `backend/src/main/java/com/tuliplot/billing/FreemiusWebhookController.java`
- Create: `backend/src/test/java/com/tuliplot/billing/FreemiusWebhookControllerTest.java`

**Interfaces:**
- Consumes: `SubscriptionService.alreadyProcessed/markProcessed/applyLicense` (Task 4), `FreemiusConfig.getSecretKey()` (Task 2).
- Produces: `POST /api/v1/billing/webhook` — 401 bad signature, 200 in every other ack case, 500 on apply failure (Freemius retries).

- [ ] **Step 1: Write the failing test**

`@WebMvcTest` (Boot 4.1 package) with `@MockitoBean` services. Helper
signs bodies exactly the way the controller must verify them.

```java
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

@WebMvcTest(controllers = FreemiusWebhookController.class,
    excludeAutoConfiguration = {
        org.springframework.boot.security.autoconfigure.servlet.SecurityAutoConfiguration.class})
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
}
```

Note: if the security exclude class name differs on Boot 4.1, copy the
exclude the deleted `StripeWebhookControllerTest` used — check
`git show HEAD~1:backend/src/test/java/com/tuliplot/billing/StripeWebhookControllerTest.java`.

- [ ] **Step 2: Run it — expect FAIL (controller missing)**

Run: `cd backend && ./gradlew test --tests FreemiusWebhookControllerTest`

- [ ] **Step 3: Implement**

```java
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
   * Explicit 500: an UNHANDLED exception on this unauthenticated endpoint would hit the
   * /error dispatch, which SecurityConfig does not permit, and surface as 401 (the known
   * error-masking defect from PR #15). Freemius may treat a 4xx as permanent and stop the
   * retries; a real 500 keeps them coming until the API call succeeds.
   */
  @org.springframework.web.bind.annotation.ExceptionHandler(FreemiusGatewayException.class)
  public ResponseEntity<String> handleGatewayFailure(FreemiusGatewayException e) {
    return ResponseEntity.status(500).body("freemius api failure");
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
```

Note on Jackson 3: `readTree` throws unchecked exceptions; malformed JSON
after a valid signature cannot happen in practice, and the resulting 500
is acceptable. `asString()` vs `asText()`: same note as Task 3.

- [ ] **Step 4: Run the suite — expect PASS**

Run: `cd backend && ./gradlew test`

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(billing): Freemius webhook — HMAC verify, dedupe, license resync dispatch"
```

---

### Task 6: New slim BillingController — portal-session only

**Files:**
- Modify: `backend/src/main/java/com/tuliplot/billing/BillingController.java` (rewrite)
- Rewrite: `backend/src/test/java/com/tuliplot/billing/BillingControllerPortalTest.java`
- Delete: `backend/src/test/java/com/tuliplot/billing/BillingControllerCheckoutTest.java`

**Interfaces:**
- Consumes: `FreemiusGateway.createPortalLoginUrl(email)` (Task 3), `PortalSessionResponse` (existing record, unchanged), `DashPrincipal`, `UserRepository`.
- Produces: `POST /api/v1/billing/portal-session` → `{"url": "..."}`; 400 `{"code":"no_subscription", ...}` when the user has no `fsLicenseId`. `POST /api/v1/billing/checkout-session` no longer exists (404).

- [ ] **Step 1: Write the failing test**

Rewrite `BillingControllerPortalTest` in the file's existing style (it is
a `@WebMvcTest` with a mocked service layer — keep its security setup,
swap the mocked bean to `FreemiusGateway` + `UserRepository` and the
assertions to):
- authenticated user WITH `fsLicenseId` → 200, body `{"url":"https://users.freemius.com/login/abc"}`, and the gateway received the user's email;
- authenticated user WITHOUT `fsLicenseId` → 400 with `code=no_subscription`;
- `POST /api/v1/billing/checkout-session` → 404 (endpoint deleted).

- [ ] **Step 2: Run it — expect FAIL**

Run: `cd backend && ./gradlew test --tests BillingControllerPortalTest`

- [ ] **Step 3: Implement**

```java
package com.tuliplot.billing;

import com.tuliplot.auth.DashPrincipal;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.billing.dto.PortalSessionResponse;
import com.tuliplot.common.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

  private final FreemiusGateway gateway;
  private final UserRepository userRepository;

  public BillingController(FreemiusGateway gateway, UserRepository userRepository) {
    this.gateway = gateway;
    this.userRepository = userRepository;
  }

  /** The hosted Freemius customer portal handles payment method, invoices, cancellation. */
  @PostMapping("/portal-session")
  public PortalSessionResponse createPortalSession(@AuthenticationPrincipal DashPrincipal principal) {
    User user = userRepository.findById(principal.getUserId()).orElseThrow();
    String licenseId = user.getSubscription().getFsLicenseId();
    if (licenseId == null || licenseId.isBlank()) {
      throw new NoSubscriptionException();
    }
    return new PortalSessionResponse(gateway.createPortalLoginUrl(user.getEmail()));
  }

  @ExceptionHandler(NoSubscriptionException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ApiError handleNoSubscription(NoSubscriptionException e) {
    return new ApiError("no_subscription", "no billing subscription on file");
  }

  static class NoSubscriptionException extends RuntimeException {}
}
```

Check `ApiError`'s actual constructor with
`grep -n "record ApiError\|class ApiError" -r backend/src/main` and match
it. Delete `BillingControllerCheckoutTest.java` and
`dto/CheckoutSessionResponse.java` in this commit.

- [ ] **Step 4: Run the suite — expect PASS**

Run: `cd backend && ./gradlew test`

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(billing): portal-session via Freemius portal login; drop checkout-session"
```

---

### Task 7: Delete the remaining Stripe code and the dependency

**Files:**
- Delete: `backend/src/main/java/com/tuliplot/billing/StripeService.java`, `StripeGateway.java`, `StripeGatewayImpl.java`, `StripeGatewayException.java`, `StripeConfig.java`, `NoStripeCustomerException.java`
- Delete tests: `StripeConfigTest.java`, `StripeServiceCheckoutTest.java`, `StripeServicePortalTest.java`, `StripeServiceVerifyTest.java`
- Modify: `backend/build.gradle.kts` (remove lines 30–31: the Stripe comment + `implementation("com.stripe:stripe-java:33.0.0")`)
- Modify: `backend/src/main/resources/application.yml` (delete the whole `tuliplot.stripe` block)
- Modify: `backend/src/main/java/com/tuliplot/auth/Subscription.java` (delete `stripeCustomerId` + `stripeSubscriptionId` fields and their accessors)
- Modify: the `@EnableConfigurationProperties`/scan wiring from Task 2 (drop `StripeConfig`)

**Interfaces:**
- Consumes: nothing. Produces: a Stripe-free backend.

- [ ] **Step 1: Delete, then sweep**

Run: `grep -rin "stripe" backend/src backend/build.gradle.kts`
Expected after the deletes: zero hits (comments included). Fix any
stragglers (e.g. `MongoIndexConfig` comments from Task 1, README
mentions are Task 11's job — backend only here).

- [ ] **Step 2: Run the full backend suite — expect PASS**

Run: `cd backend && ./gradlew test`

- [ ] **Step 3: Commit**

```bash
git add -A backend
git commit -m "refactor(billing): delete the Stripe module, dependency, and config"
```

---

### Task 8: Frontend — environment + FreemiusCheckoutService (script loader)

**Files:**
- Modify: `frontend/src/environments/environment.ts` and `frontend/src/environments/environment.development.ts`
- Create: `frontend/src/app/core/services/freemius-checkout.service.ts`
- Create: `frontend/src/app/core/services/freemius-checkout.service.spec.ts`

**Interfaces:**
- Produces:
  - `environment.freemius = { productId: 37109, planId: 61603, publicKey: 'pk_dd68d3c56014484d645d69d91d734' }` (same values in both environment files).
  - `FreemiusCheckoutService.open(userEmail: string, onSuccess: () => void): Promise<void>` — loads the script once, constructs `FS.Checkout`, opens the overlay with the locked email.

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FreemiusCheckoutService } from './freemius-checkout.service';

describe('FreemiusCheckoutService', () => {
  let service: FreemiusCheckoutService;
  const openSpy = vi.fn();
  const ctorSpy = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FreemiusCheckoutService);
    ctorSpy.mockClear();
    openSpy.mockClear();
    (window as any).FS = {
      Checkout: class {
        constructor(opts: unknown) { ctorSpy(opts); }
        open(opts: unknown) { openSpy(opts); }
      },
    };
  });

  afterEach(() => { delete (window as any).FS; });

  it('constructs FS.Checkout with the product, plan, and public key, and locks the email', async () => {
    await service.open('user@example.com', () => {});
    expect(ctorSpy).toHaveBeenCalledWith({
      product_id: 37109,
      plan_id: 61603,
      public_key: 'pk_dd68d3c56014484d645d69d91d734',
    });
    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_email: 'user@example.com',
      readonly_user: true,
      success: expect.any(Function),
    }));
  });

  it('does not inject the script tag when FS is already present', async () => {
    const before = document.querySelectorAll('script[src*="checkout.freemius.com"]').length;
    await service.open('user@example.com', () => {});
    const after = document.querySelectorAll('script[src*="checkout.freemius.com"]').length;
    expect(after).toBe(before);
  });

  it('invokes the success callback from the overlay success handler', async () => {
    const onSuccess = vi.fn();
    await service.open('user@example.com', onSuccess);
    const opts = openSpy.mock.calls[0][0] as { success: () => void };
    opts.success();
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (service missing)**

Run: `cd frontend && npx vitest run src/app/core/services/freemius-checkout.service.spec.ts`

- [ ] **Step 3: Implement**

Environment (both files; development keeps its own `apiBaseUrl`):

```ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.tuliplot.com/api/v1',
  adsenseClient: '', // e.g. 'ca-pub-XXXXXXXXXXXXXXXX'; empty until AdSense is live
  freemius: {
    productId: 37109,
    planId: 61603,
    publicKey: 'pk_dd68d3c56014484d645d69d91d734',
  },
};
```

Service:

```ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const SCRIPT_SRC = 'https://checkout.freemius.com/js/v1/';

/**
 * Loads the Freemius checkout script on demand and opens the overlay.
 * The email is locked (readonly_user) so the webhook can match the buyer
 * to the account by email.
 */
@Injectable({ providedIn: 'root' })
export class FreemiusCheckoutService {
  private scriptPromise: Promise<void> | null = null;

  async open(userEmail: string, onSuccess: () => void): Promise<void> {
    await this.loadScript();
    const FS = (window as any).FS;
    const checkout = new FS.Checkout({
      product_id: environment.freemius.productId,
      plan_id: environment.freemius.planId,
      public_key: environment.freemius.publicKey,
    });
    checkout.open({
      user_email: userEmail,
      readonly_user: true,
      success: () => onSuccess(),
    });
  }

  private loadScript(): Promise<void> {
    if ((window as any).FS?.Checkout) {
      return Promise.resolve();
    }
    if (!this.scriptPromise) {
      this.scriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          this.scriptPromise = null;
          reject(new Error('freemius checkout script failed to load'));
        };
        document.head.appendChild(script);
      });
    }
    return this.scriptPromise;
  }
}
```

- [ ] **Step 4: Run the frontend suite — expect PASS**

Run: `cd frontend && npm test`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/environments frontend/src/app/core/services/freemius-checkout.service.ts frontend/src/app/core/services/freemius-checkout.service.spec.ts
git commit -m "feat(billing): Freemius checkout service + environment ids"
```

---

### Task 9: Frontend — UpgradeComponent opens the overlay and polls for the flip

**Files:**
- Modify: `frontend/src/app/features/billing/upgrade.component.ts`
- Modify: `frontend/src/app/features/billing/upgrade.component.spec.ts` (rewrite)

**Interfaces:**
- Consumes: `FreemiusCheckoutService.open(email, onSuccess)` (Task 8), `AuthStore` (`user()` signal with `.email`, `tier()` signal, `loadMe()` rx-method).
- Produces: the upgrade page states: idle → overlay → `finalizing` → done (router to `/app`) or `pending` (timeout copy).

- [ ] **Step 1: Write the failing tests**

Rewrite the spec. Key cases (use the existing spec's TestBed setup as the
base — it already provides an AuthStore test double; extend it with
`tier`/`user`/`loadMe` as vitest fns/signals):

```ts
// 1) clicking upgrade opens the overlay with the signed-in email
//    - mock FreemiusCheckoutService, assert open() got user.email and a callback
// 2) the success callback flips the component to the 'finalizing' state
//    and calls authStore.loadMe() immediately
// 3) with vi.useFakeTimers(): while tier() stays FREE, loadMe() fires again
//    every 2000ms; when the test flips the tier signal to 'PREMIUM',
//    the component navigates to '/app' (assert via Router spy)
// 4) after 15 polls (30s) without a flip, the component shows the
//    'payment received, activation pending' copy (data-testid="pending-note")
// 5) the template no longer mentions Stripe (assert the rendered text
//    does not contain 'Stripe')
```

Write these as real tests against the rewritten component below; keep the
selector `tl-upgrade` and the visual shell.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/app/features/billing/upgrade.component.spec.ts`

- [ ] **Step 3: Implement**

Replace the component class and the CTA/note parts of the template:

```ts
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FreemiusCheckoutService } from '../../core/services/freemius-checkout.service';
import { AuthStore } from '../../stores/auth.store';
import { AppTopbarComponent } from '../../shared/app-topbar.component';

@Component({
  selector: 'tl-upgrade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppTopbarComponent],
  template: `
    <div class="page">
      <tl-app-topbar mode="back" />
      <main class="center">
        <div class="card tl-card tl-card--float">
          <div class="squares" aria-hidden="true">
            <span style="background: var(--tl-pink)"></span><span style="background: var(--tl-peach)"></span><span style="background: var(--tl-sky)"></span>
            <span style="background: var(--tl-mint)"></span><span style="background: var(--tl-lilac)"></span><span style="background: var(--tl-primary)"></span>
          </div>
          <h1>Go Premium</h1>
          <p class="sub">Unlock all six cells and remove ads from your dashboard.</p>
          <div class="perks">
            <div>✓ All 6 cells unlocked</div>
            <div>✓ Zero ads, ever</div>
            <div>✓ No advertising cookies</div>
            <div>✓ Cancel anytime</div>
          </div>
          <div class="price">$4<span>/month</span></div>
          @if (state() === 'finalizing') {
            <p class="finalizing" data-testid="finalizing-note">Finishing your upgrade…</p>
          } @else if (state() === 'pending') {
            <p class="finalizing" data-testid="pending-note">
              Payment received. The upgrade activates within a few minutes —
              reload the dashboard to check.
            </p>
          } @else {
            <button type="button" class="cta tl-btn tl-btn--primary" (click)="upgrade()" [disabled]="state() === 'opening'">
              Remove ad — go Premium
            </button>
          }
          <p class="tl-mono-note note">Secure checkout via Freemius</p>
        </div>
      </main>
    </div>
  `,
  styles: [` /* keep the existing styles block verbatim, plus: */
    .finalizing { font-size: 15px; color: var(--tl-ink-soft); margin: 0; padding: 15px 0; }
  `],
})
export class UpgradeComponent implements OnDestroy {
  private static readonly POLL_MS = 2000;
  private static readonly MAX_POLLS = 15;

  private readonly checkout = inject(FreemiusCheckoutService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly state = signal<'idle' | 'opening' | 'finalizing' | 'pending'>('idle');
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polls = 0;

  upgrade(): void {
    const email = this.authStore.user()?.email;
    if (!email) {
      return;
    }
    this.state.set('opening');
    this.checkout.open(email, () => this.onPurchased())
      .catch(() => this.state.set('idle'))
      .then(() => { if (this.state() === 'opening') this.state.set('idle'); });
  }

  /** The webhook flips the tier; poll /auth/me until the flip lands. */
  private onPurchased(): void {
    this.state.set('finalizing');
    this.polls = 0;
    this.authStore.loadMe();
    this.pollTimer = setInterval(() => {
      if (this.authStore.tier() === 'PREMIUM') {
        this.stopPolling();
        this.router.navigateByUrl('/app');
        return;
      }
      if (++this.polls >= UpgradeComponent.MAX_POLLS) {
        this.stopPolling();
        this.state.set('pending');
        return;
      }
      this.authStore.loadMe();
    }, UpgradeComponent.POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
```

Check the exact `AuthStore` member names first
(`grep -n "tier\|user\|loadMe" frontend/src/app/stores/auth.store.ts`)
and use what exists; `tier()` returns the tier string and `loadMe` is an
rxMethod taking `void`.

- [ ] **Step 4: Run the frontend suite — expect PASS**

Run: `cd frontend && npm test`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/billing
git commit -m "feat(billing): upgrade page opens the Freemius overlay and polls for the tier flip"
```

---

### Task 10: Frontend — BillingApi + settings cleanup

**Files:**
- Modify: `frontend/src/app/core/api/billing.api.ts` (drop `createCheckoutSession`)
- Modify: `frontend/src/app/features/billing/settings.component.ts` (copy)
- Modify: `frontend/src/app/features/billing/settings.component.spec.ts` (align)

**Interfaces:**
- Consumes: the backend portal-session endpoint (Task 6, response shape unchanged).
- Produces: `BillingApi` with only `createPortalSession(): Observable<{ url: string }>`.

- [ ] **Step 1: Adjust the tests first**

In `settings.component.spec.ts`: assert the rendered hint text is
"Manage payment method, invoices, and cancellation through the Freemius
customer portal." and that no rendered text contains "Stripe". Run the
spec — expect FAIL.

- [ ] **Step 2: Implement**

- `billing.api.ts`: delete the `createCheckoutSession` method.
- `settings.component.ts` hint line becomes:
  `Manage payment method, invoices, and cancellation through the Freemius customer portal.`
- Sweep: `grep -rin "stripe" frontend/src` → expected zero hits after
  this task (Task 9 already cleaned the upgrade page).

- [ ] **Step 3: Run the frontend suite — expect PASS**

Run: `cd frontend && npm test`

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(billing): settings + BillingApi point at the Freemius portal"
```

---

### Task 11: Published-content sweep — no stale Stripe claims

**Files:**
- Check (modify only where a hit is a claim about OUR checkout): `content/**/*.md`, `frontend/src/app/features/marketing/*.ts`, `README.md`, `docs/adsense-launch-checklist.md`

**Interfaces:** none — copy truthfulness task.

- [ ] **Step 1: Sweep**

Run: `grep -rin "stripe" content/ frontend/src README.md docs/`
For every hit decide: (a) a claim about TulipLot's checkout → rewrite to
name Freemius or say "the customer portal"; (b) a competitor fact or a
historical plan/spec document → leave untouched (specs and plans are the
historical record; do NOT rewrite `docs/superpowers/`). Known hit to fix:
`README.md` cutover step 4 (Stripe webhook) → replace with the Freemius
webhook registration step (dashboard → webhooks → add
`https://api.tuliplot.com/api/v1/billing/webhook`). Check
`content/guides/premium-vs-free.md` — its cancellation paragraph must
describe the Freemius customer portal, not Stripe.

- [ ] **Step 2: Rebuild content and run the suite**

Run: `cd frontend && npm run build` (with the pinned Node on PATH)
Expected: build green, prerendered pages regenerate.

- [ ] **Step 3: Commit**

```bash
git add content frontend README.md docs
git commit -m "docs(content): billing copy names Freemius, not Stripe"
```

---

### Task 12: Full verification + PR

**Files:** none new.

- [ ] **Step 1: Run everything**

- `cd backend && ./gradlew test` → expected green (uses Docker or `MONGODB_TEST_URI`).
- `cd frontend && npm test` → expected green.
- `cd frontend && npm run build` → expected green.
- `cd extension && npm test` → expected green (untouched — regression check only).

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feature/freemius-billing
gh pr create --base main --title "feat(billing): replace Stripe with Freemius (merchant of record)" --body "<summary per repo convention; spec + plan paths; owner steps below>"
```

- [ ] **Step 3: Owner steps (manual, after merge) — include in the PR body**

1. Freemius dashboard → Settings: REGENERATE the secret key (the old one
   leaked into a chat transcript on 2026-08-15 and is dead on rotation).
2. Freemius dashboard → Settings → API Token tab: copy the Bearer token.
3. Set the secrets (owner's own terminal, never in a chat):
   `fly secrets set -a api-tuliplot FREEMIUS_PRODUCT_ID=37109 FREEMIUS_SECRET_KEY=<new sk> FREEMIUS_API_TOKEN=<token>`
4. Freemius dashboard → webhooks: register
   `https://api.tuliplot.com/api/v1/billing/webhook` for the license.*
   events listed in the spec.
5. Sandbox check: from the dashboard's checkout page, run a sandbox
   purchase against the live site with a logged-in test account. Verify:
   the overlay opens with the locked email, the webhook delivery shows
   200 in the dashboard, the tier flips to PREMIUM, the 6th cell
   unlocks. Then cancel in the portal and verify the flip back at
   period end (or delete the sandbox license to test revoke).
6. If any license/subscription JSON field name differs from the pinned
   set (`is_cancelled`, `canceled_at`, `trial_ends`, `next_payment`),
   fix `FreemiusGatewayImpl` + its test in a follow-up commit — the
   sandbox check in step 5 surfaces this immediately as a non-flipping
   tier plus a WARN/500 in `fly logs`.
