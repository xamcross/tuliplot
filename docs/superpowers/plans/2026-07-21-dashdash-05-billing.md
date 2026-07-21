# DashDash — Billing Implementation Plan (Plan 05 of 06)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Integrate Stripe subscriptions so premium status is driven exclusively by verified webhooks, with Checkout/Billing-Portal flows and UI plan gating.

**Architecture:** A thin `StripeGateway` seam wraps every `stripe-java` SDK call so services are unit-testable with a mock. `StripeService` orchestrates Checkout/Portal/signature-verification; `SubscriptionService` is the idempotent state machine that maps Stripe subscription status → `Tier`/`SubStatus`, persists the `User`, and calls `DashboardService.reconcileForTier` on downgrade. Premium is never a client flag: it changes only when a signature-verified webhook is processed. The Angular side adds a Checkout redirect (`UpgradeComponent`), a Portal redirect (`SettingsComponent`), and grid gating of slot 5 for FREE users plus a reload-on-return from Checkout.

**Tech Stack:** Java 25 · Spring Boot 4.1 · Spring Data MongoDB · `com.stripe:stripe-java` 33.x · JUnit 5 + Spring Boot Test + Testcontainers-Mongo + Mockito · Angular 22 (standalone, zoneless, signals) + `@ngrx/signals` + Vitest.

**Depends on:** 01 (repo, Gradle, `MongoIndexConfig`, `ApiError`, security/CSRF config, `/health`), 02 (`User`, `Subscription`, `Tier`, `SubStatus`, `UserRepository`, `DashPrincipal`, `AuthStore`, `Dashboard`/`Cell` model + `Dashboard.defaultFor`), 03 (`DashboardService.reconcileForTier`, `DashboardStore`, `GridComponent`, `dashboard-page.component.ts`).

## Global Constraints

See `2026-07-21-dashdash-00-shared-contract.md` (authoritative for names/types/signatures and global constraints). This plan additionally requires:

- Stripe SDK: `com.stripe:stripe-java` **33.x**, pinned to a fixed Stripe API version string `2025-08-27.basil` (the version stripe-java 33.x is built against). Applied per request via `RequestOptions.stripeVersionOverride(...)`; never left implicit.
- Premium is **server-derived**: `premium == status ∈ {ACTIVE, TRIALING}` (contract `UserService.isPremium`). No endpoint may set `Tier.PREMIUM` from client input. Only `SubscriptionService` (fed by verified webhooks) mutates `Subscription.tier`.
- Webhook endpoint `POST /api/v1/billing/webhook` is **public + signature-verified + CSRF-exempt + raw-body** (contract Security rules). Its body is consumed as `byte[]`; it must never be pre-parsed as JSON before signature verification.
- Idempotency: every Stripe event id is recorded in `stripe_events` (`ProcessedStripeEvent`) with a **30-day TTL** index on `processedAt`; duplicate deliveries are 200 no-ops.
- Subscription-status mapping (Stripe string → `SubStatus`): `active`→ACTIVE, `trialing`→TRIALING, `past_due`/`unpaid`→PAST_DUE, `canceled`/`incomplete_expired`/`paused`→CANCELED, `incomplete`/unknown→NONE.
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CHECKOUT_SUCCESS_URL`, `STRIPE_CHECKOUT_CANCEL_URL`, `STRIPE_PORTAL_RETURN_URL`, `STRIPE_API_VERSION` — bound under prefix `dashdash.stripe.*`.
- Upgrade CTA copy is exactly **"Remove ad — go Premium"** (contract). Ad cell label is exactly **"Advertisements"**.
- Routes (contract canonical table): `UpgradeComponent` at `/app/upgrade`, `SettingsComponent` at `/app/settings`. Checkout `success_url` returns the SPA to `https://dashdash.app/app?checkout=success` (prod) / `http://localhost:4200/app?checkout=success` (dev); `cancel_url` is the `/app/upgrade` URL. There is **no `/dashboard` route** — the dashboard lives at `/app`, so `DashboardPageComponent` (at `/app`) is what reacts to `?checkout=success` by reloading auth + dashboard so premium reflects immediately.

---

### Task 1: Stripe setup — SDK dependency, `StripeConfig`, `ProcessedStripeEvent` + repo, TTL index

**Files:**
- Create: `backend/src/main/java/com/dashdash/billing/StripeConfig.java`
- Create: `backend/src/main/java/com/dashdash/billing/BillingConfiguration.java`
- Create: `backend/src/main/java/com/dashdash/billing/ProcessedStripeEvent.java`
- Create: `backend/src/main/java/com/dashdash/billing/ProcessedStripeEventRepository.java`
- Modify: `backend/build.gradle.kts` (dependencies block — add `com.stripe:stripe-java`)
- Modify: `backend/src/main/resources/application.yml` (add the `dashdash.stripe.*` keys under the `dashdash:` tree; Plans 01/02 use YAML — there is no `application.properties` in this project)
- Modify: `backend/src/main/java/com/dashdash/config/MongoIndexConfig.java` (inside the existing index-creation method that already calls `mongoTemplate.indexOps(...)`)
- Test: `backend/src/test/java/com/dashdash/billing/StripeConfigTest.java`
- Test: `backend/src/test/java/com/dashdash/billing/ProcessedStripeEventRepositoryTest.java`

**Interfaces:**
- Consumes: `MongoIndexConfig` + its injected `org.springframework.data.mongodb.core.MongoTemplate` (Plan 01); Testcontainers-Mongo test infra (Plan 01 dev deps).
- Produces:
  - `StripeConfig` — `@ConfigurationProperties(prefix="dashdash.stripe")` POJO with getters `getSecretKey()/getPriceId()/getWebhookSecret()/getCheckoutSuccessUrl()/getCheckoutCancelUrl()/getPortalReturnUrl()/getApiVersion()` and matching setters; `@PostConstruct applyGlobals()` sets `Stripe.apiKey`.
  - `BillingConfiguration` — `@Configuration @EnableConfigurationProperties(StripeConfig.class)`.
  - `ProcessedStripeEvent` — `@Document("stripe_events")` with `@Id String id`, `String type`, `Instant processedAt` (+ getters/setters).
  - `ProcessedStripeEventRepository extends MongoRepository<ProcessedStripeEvent,String>` (contract).
  - `stripe_events` TTL index on `processedAt`, expire 30 days.

- [ ] **Step 1: Write the failing test — config binding + repo idempotency read**

Create `backend/src/test/java/com/dashdash/billing/StripeConfigTest.java`:

```java
package com.dashdash.billing;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.UserConfigurations;

import static org.assertj.core.api.Assertions.assertThat;

class StripeConfigTest {

  @EnableConfigurationProperties(StripeConfig.class)
  static class Enable { }

  private final ApplicationContextRunner runner = new ApplicationContextRunner()
      .withConfiguration(UserConfigurations.of(Enable.class));

  @Test
  void bindsStripePropertiesFromEnvironment() {
    runner.withPropertyValues(
        "dashdash.stripe.secret-key=sk_test_123",
        "dashdash.stripe.price-id=price_abc",
        "dashdash.stripe.webhook-secret=whsec_xyz",
        "dashdash.stripe.checkout-success-url=https://dashdash.app/app?checkout=success",
        "dashdash.stripe.checkout-cancel-url=https://dashdash.app/app/upgrade?checkout=cancel",
        "dashdash.stripe.portal-return-url=https://dashdash.app/app/settings",
        "dashdash.stripe.api-version=2025-08-27.basil"
    ).run(ctx -> {
      assertThat(ctx).hasSingleBean(StripeConfig.class);
      StripeConfig cfg = ctx.getBean(StripeConfig.class);
      assertThat(cfg.getSecretKey()).isEqualTo("sk_test_123");
      assertThat(cfg.getPriceId()).isEqualTo("price_abc");
      assertThat(cfg.getWebhookSecret()).isEqualTo("whsec_xyz");
      assertThat(cfg.getCheckoutSuccessUrl()).isEqualTo("https://dashdash.app/app?checkout=success");
      assertThat(cfg.getCheckoutCancelUrl()).isEqualTo("https://dashdash.app/app/upgrade?checkout=cancel");
      assertThat(cfg.getPortalReturnUrl()).isEqualTo("https://dashdash.app/app/settings");
      assertThat(cfg.getApiVersion()).isEqualTo("2025-08-27.basil");
    });
  }
}
```

Create `backend/src/test/java/com/dashdash/billing/ProcessedStripeEventRepositoryTest.java`:

```java
package com.dashdash.billing;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@DataMongoTest
@Testcontainers
class ProcessedStripeEventRepositoryTest {

  @Container
  static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired
  ProcessedStripeEventRepository repo;

  @Test
  void existsByIdReflectsSavedEvent() {
    assertThat(repo.existsById("evt_1")).isFalse();

    ProcessedStripeEvent e = new ProcessedStripeEvent();
    e.setId("evt_1");
    e.setType("customer.subscription.updated");
    e.setProcessedAt(Instant.now());
    repo.save(e);

    assertThat(repo.existsById("evt_1")).isTrue();
  }
}
```

- [ ] **Step 2: Run tests to verify they fail (compile error — classes do not exist yet)**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeConfigTest" --tests "com.dashdash.billing.ProcessedStripeEventRepositoryTest"
```

Expected: compilation fails, e.g. `error: cannot find symbol  class StripeConfig` and `class ProcessedStripeEvent` / `class ProcessedStripeEventRepository`. `BUILD FAILED`.

- [ ] **Step 3a: Add the Stripe SDK dependency**

In `backend/build.gradle.kts`, inside the `dependencies { ... }` block, add:

```kotlin
    implementation("com.stripe:stripe-java:33.0.0")
```

- [ ] **Step 3b: Add Stripe config keys**

Add these keys to `backend/src/main/resources/application.yml`, nested under the existing `dashdash:` root (Plans 01/02 use YAML; there is no `application.properties`). The success default returns the SPA to `/app` (prod host); in dev, set `STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:4200/app?checkout=success`.

```yaml
dashdash:
  # ...existing dashdash.* keys from Plans 01/02 stay here...
  stripe:
    # Stripe (env-driven; empty defaults keep the app bootable in dev without billing)
    secret-key: ${STRIPE_SECRET_KEY:}
    price-id: ${STRIPE_PRICE_ID:}
    webhook-secret: ${STRIPE_WEBHOOK_SECRET:}
    checkout-success-url: ${STRIPE_CHECKOUT_SUCCESS_URL:https://dashdash.app/app?checkout=success}
    checkout-cancel-url: ${STRIPE_CHECKOUT_CANCEL_URL:https://dashdash.app/app/upgrade?checkout=cancel}
    portal-return-url: ${STRIPE_PORTAL_RETURN_URL:https://dashdash.app/app/settings}
    api-version: ${STRIPE_API_VERSION:2025-08-27.basil}
```

- [ ] **Step 3c: Create `StripeConfig`**

`backend/src/main/java/com/dashdash/billing/StripeConfig.java`:

```java
package com.dashdash.billing;

import com.stripe.Stripe;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "dashdash.stripe")
public class StripeConfig {

  private String secretKey = "";
  private String priceId = "";
  private String webhookSecret = "";
  private String checkoutSuccessUrl = "";
  private String checkoutCancelUrl = "";
  private String portalReturnUrl = "";
  private String apiVersion = "2025-08-27.basil";

  /** Set the global Stripe secret key once the properties are bound. */
  @PostConstruct
  void applyGlobals() {
    Stripe.apiKey = secretKey;
  }

  public String getSecretKey() { return secretKey; }
  public void setSecretKey(String secretKey) { this.secretKey = secretKey; }

  public String getPriceId() { return priceId; }
  public void setPriceId(String priceId) { this.priceId = priceId; }

  public String getWebhookSecret() { return webhookSecret; }
  public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }

  public String getCheckoutSuccessUrl() { return checkoutSuccessUrl; }
  public void setCheckoutSuccessUrl(String checkoutSuccessUrl) { this.checkoutSuccessUrl = checkoutSuccessUrl; }

  public String getCheckoutCancelUrl() { return checkoutCancelUrl; }
  public void setCheckoutCancelUrl(String checkoutCancelUrl) { this.checkoutCancelUrl = checkoutCancelUrl; }

  public String getPortalReturnUrl() { return portalReturnUrl; }
  public void setPortalReturnUrl(String portalReturnUrl) { this.portalReturnUrl = portalReturnUrl; }

  public String getApiVersion() { return apiVersion; }
  public void setApiVersion(String apiVersion) { this.apiVersion = apiVersion; }
}
```

- [ ] **Step 3d: Create `BillingConfiguration` (registers + binds `StripeConfig` in the running app)**

`backend/src/main/java/com/dashdash/billing/BillingConfiguration.java`:

```java
package com.dashdash.billing;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(StripeConfig.class)
public class BillingConfiguration {
}
```

- [ ] **Step 3e: Create `ProcessedStripeEvent`**

`backend/src/main/java/com/dashdash/billing/ProcessedStripeEvent.java`:

```java
package com.dashdash.billing;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("stripe_events")
public class ProcessedStripeEvent {

  @Id
  private String id;      // = Stripe event id
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

- [ ] **Step 3f: Create `ProcessedStripeEventRepository`**

`backend/src/main/java/com/dashdash/billing/ProcessedStripeEventRepository.java`:

```java
package com.dashdash.billing;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProcessedStripeEventRepository extends MongoRepository<ProcessedStripeEvent, String> {
}
```

- [ ] **Step 3g: Add the `stripe_events` TTL index**

In `backend/src/main/java/com/dashdash/config/MongoIndexConfig.java`, add these imports if not already present:

```java
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.domain.Sort;
import java.time.Duration;
```

Inside the existing index-creation method (the one that already contains `mongoTemplate.indexOps(...)` calls for other collections), add:

```java
    // stripe_events: idempotency store — expire records 30 days after processing
    mongoTemplate.indexOps("stripe_events")
        .ensureIndex(new Index()
            .on("processedAt", Sort.Direction.ASC)
            .expire(Duration.ofDays(30)));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeConfigTest" --tests "com.dashdash.billing.ProcessedStripeEventRepositoryTest"
```

Expected: `BUILD SUCCESSFUL`, both tests green (`StripeConfigTest > bindsStripePropertiesFromEnvironment PASSED`, `ProcessedStripeEventRepositoryTest > existsByIdReflectsSavedEvent PASSED`).

- [ ] **Step 5: Commit**

```bash
git add backend/build.gradle.kts \
        backend/src/main/resources/application.yml \
        backend/src/main/java/com/dashdash/billing/StripeConfig.java \
        backend/src/main/java/com/dashdash/billing/BillingConfiguration.java \
        backend/src/main/java/com/dashdash/billing/ProcessedStripeEvent.java \
        backend/src/main/java/com/dashdash/billing/ProcessedStripeEventRepository.java \
        backend/src/main/java/com/dashdash/config/MongoIndexConfig.java \
        backend/src/test/java/com/dashdash/billing/StripeConfigTest.java \
        backend/src/test/java/com/dashdash/billing/ProcessedStripeEventRepositoryTest.java
git commit -m "feat(billing): add stripe-java, StripeConfig, ProcessedStripeEvent + TTL index"
```

---

### Task 2: Checkout — `StripeGateway` seam, `StripeService.createCheckoutSession`, `BillingController` checkout endpoint

**Files:**
- Create: `backend/src/main/java/com/dashdash/billing/StripeGateway.java`
- Create: `backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java`
- Create: `backend/src/main/java/com/dashdash/billing/StripeService.java`
- Create: `backend/src/main/java/com/dashdash/billing/dto/CheckoutSessionResponse.java`
- Create: `backend/src/main/java/com/dashdash/billing/BillingController.java`
- Test: `backend/src/test/java/com/dashdash/billing/StripeServiceCheckoutTest.java`
- Test: `backend/src/test/java/com/dashdash/billing/BillingControllerCheckoutTest.java`

**Interfaces:**
- Consumes: `User` (getters `getId()`, `getEmail()`, `getSubscription()`), `Subscription` (`getStripeCustomerId()`, `setStripeCustomerId(String)`), `UserRepository` (`findById`, `save`), `DashPrincipal.getUserId()` — all Plan 02. `CheckoutSessionResponse(String url)` DTO shape (contract). `StripeConfig` (Task 1).
- Produces:
  - `StripeGateway` interface — the mockable Stripe seam. Introduced here with:
    - `String createCustomer(String email, String userId)`
    - `String createCheckoutSessionUrl(String customerId, String userId, String priceId, String successUrl, String cancelUrl)`
    (extended in Tasks 3–5).
  - `StripeGatewayImpl` — `@Component` real implementation using `stripe-java`.
  - `StripeService.createCheckoutSession(User user)` → checkout URL (contract signature).
  - `CheckoutSessionResponse(String url)` record (contract).
  - `BillingController` with `POST /api/v1/billing/checkout-session` → `CheckoutSessionResponse`.

- [ ] **Step 1: Write the failing test — StripeService checkout (mocked gateway)**

Create `backend/src/test/java/com/dashdash/billing/StripeServiceCheckoutTest.java`:

```java
package com.dashdash.billing;

import com.dashdash.auth.Subscription;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StripeServiceCheckoutTest {

  private StripeGateway gateway;
  private UserRepository userRepository;
  private StripeConfig config;
  private StripeService service;

  @BeforeEach
  void setup() {
    gateway = mock(StripeGateway.class);
    userRepository = mock(UserRepository.class);
    config = new StripeConfig();
    config.setPriceId("price_abc");
    config.setCheckoutSuccessUrl("https://dashdash.app/app?checkout=success");
    config.setCheckoutCancelUrl("https://dashdash.app/app/upgrade?checkout=cancel");
    config.setPortalReturnUrl("https://dashdash.app/app/settings");
    // SubscriptionService dependency is not needed for checkout; pass a mock.
    service = new StripeService(gateway, userRepository, config);
  }

  private User userWithoutCustomer() {
    User u = new User();
    u.setId("u1");
    u.setEmail("a@b.com");
    Subscription sub = new Subscription();
    u.setSubscription(sub);
    return u;
  }

  @Test
  void createsCustomerWhenMissingThenReturnsCheckoutUrl() {
    User user = userWithoutCustomer();
    when(gateway.createCustomer("a@b.com", "u1")).thenReturn("cus_new");
    when(gateway.createCheckoutSessionUrl(
        eq("cus_new"), eq("u1"), eq("price_abc"),
        eq("https://dashdash.app/app?checkout=success"),
        eq("https://dashdash.app/app/upgrade?checkout=cancel")))
        .thenReturn("https://checkout.stripe.com/c/pay/cs_test_1");

    String url = service.createCheckoutSession(user);

    assertThat(url).isEqualTo("https://checkout.stripe.com/c/pay/cs_test_1");
    // persisted the new customer id on the user
    ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
    verify(userRepository).save(saved.capture());
    assertThat(saved.getValue().getSubscription().getStripeCustomerId()).isEqualTo("cus_new");
  }

  @Test
  void reusesExistingCustomerAndDoesNotPersist() {
    User user = userWithoutCustomer();
    user.getSubscription().setStripeCustomerId("cus_existing");
    when(gateway.createCheckoutSessionUrl(
        eq("cus_existing"), eq("u1"), eq("price_abc"), any(), any()))
        .thenReturn("https://checkout.stripe.com/c/pay/cs_test_2");

    String url = service.createCheckoutSession(user);

    assertThat(url).isEqualTo("https://checkout.stripe.com/c/pay/cs_test_2");
    verify(gateway, never()).createCustomer(any(), any());
    verify(userRepository, never()).save(any());
  }
}
```

- [ ] **Step 2: Run test to verify it fails (compile error)**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeServiceCheckoutTest"
```

Expected: compilation fails — `cannot find symbol  class StripeGateway`, `class StripeService`. `BUILD FAILED`.

- [ ] **Step 3a: Create the `StripeGateway` seam**

`backend/src/main/java/com/dashdash/billing/StripeGateway.java`:

```java
package com.dashdash.billing;

/**
 * Thin, mockable seam over the stripe-java SDK. All raw Stripe calls live behind this
 * interface so services stay unit-testable. Extended by Tasks 3–5.
 */
public interface StripeGateway {

  /** Create a Stripe Customer and return its id. */
  String createCustomer(String email, String userId);

  /** Create a subscription-mode Checkout Session and return its hosted URL. */
  String createCheckoutSessionUrl(String customerId, String userId, String priceId,
                                  String successUrl, String cancelUrl);
}
```

- [ ] **Step 3b: Create the real `StripeGatewayImpl`**

`backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java`:

```java
package com.dashdash.billing;

import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.stereotype.Component;

@Component
public class StripeGatewayImpl implements StripeGateway {

  private final StripeConfig config;

  public StripeGatewayImpl(StripeConfig config) {
    this.config = config;
  }

  private RequestOptions options() {
    return RequestOptions.builder()
        .setStripeVersionOverride(config.getApiVersion())
        .build();
  }

  @Override
  public String createCustomer(String email, String userId) {
    try {
      CustomerCreateParams params = CustomerCreateParams.builder()
          .setEmail(email)
          .putMetadata("userId", userId)
          .build();
      Customer customer = Customer.create(params, options());
      return customer.getId();
    } catch (StripeException e) {
      throw new StripeGatewayException("createCustomer failed", e);
    }
  }

  @Override
  public String createCheckoutSessionUrl(String customerId, String userId, String priceId,
                                         String successUrl, String cancelUrl) {
    try {
      SessionCreateParams params = SessionCreateParams.builder()
          .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
          .setCustomer(customerId)
          .setClientReferenceId(userId)
          .setSuccessUrl(successUrl)
          .setCancelUrl(cancelUrl)
          .addLineItem(SessionCreateParams.LineItem.builder()
              .setPrice(priceId)
              .setQuantity(1L)
              .build())
          .build();
      Session session = Session.create(params, options());
      return session.getUrl();
    } catch (StripeException e) {
      throw new StripeGatewayException("createCheckoutSession failed", e);
    }
  }
}
```

- [ ] **Step 3c: Create the gateway exception type**

`backend/src/main/java/com/dashdash/billing/StripeGatewayException.java`:

```java
package com.dashdash.billing;

/** Unchecked wrapper for StripeException raised inside the gateway. */
public class StripeGatewayException extends RuntimeException {
  public StripeGatewayException(String message, Throwable cause) {
    super(message, cause);
  }
}
```

- [ ] **Step 3d: Create `StripeService` (checkout only for now)**

`backend/src/main/java/com/dashdash/billing/StripeService.java`:

```java
package com.dashdash.billing;

import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class StripeService {

  private final StripeGateway gateway;
  private final UserRepository userRepository;
  private final StripeConfig config;

  public StripeService(StripeGateway gateway, UserRepository userRepository, StripeConfig config) {
    this.gateway = gateway;
    this.userRepository = userRepository;
    this.config = config;
  }

  /** Create (or reuse) the Stripe customer, then return a subscription-mode Checkout URL. */
  public String createCheckoutSession(User user) {
    String customerId = user.getSubscription().getStripeCustomerId();
    if (customerId == null || customerId.isBlank()) {
      customerId = gateway.createCustomer(user.getEmail(), user.getId());
      user.getSubscription().setStripeCustomerId(customerId);
      userRepository.save(user);
    }
    return gateway.createCheckoutSessionUrl(
        customerId,
        user.getId(),
        config.getPriceId(),
        config.getCheckoutSuccessUrl(),
        config.getCheckoutCancelUrl());
  }
}
```

- [ ] **Step 3e: Create the `CheckoutSessionResponse` DTO**

`backend/src/main/java/com/dashdash/billing/dto/CheckoutSessionResponse.java`:

```java
package com.dashdash.billing.dto;

public record CheckoutSessionResponse(String url) {
}
```

- [ ] **Step 3f: Create `BillingController` with the checkout endpoint**

`backend/src/main/java/com/dashdash/billing/BillingController.java`:

```java
package com.dashdash.billing;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.billing.dto.CheckoutSessionResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

  private final StripeService stripeService;
  private final UserRepository userRepository;

  public BillingController(StripeService stripeService, UserRepository userRepository) {
    this.stripeService = stripeService;
    this.userRepository = userRepository;
  }

  @PostMapping("/checkout-session")
  public CheckoutSessionResponse createCheckoutSession(@AuthenticationPrincipal DashPrincipal principal) {
    User user = userRepository.findById(principal.getUserId()).orElseThrow();
    return new CheckoutSessionResponse(stripeService.createCheckoutSession(user));
  }
}
```

- [ ] **Step 3g: Write the controller test**

Create `backend/src/test/java/com/dashdash/billing/BillingControllerCheckoutTest.java`:

```java
package com.dashdash.billing;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BillingControllerCheckoutTest {

  private StripeService stripeService;
  private UserRepository userRepository;
  private MockMvc mockMvc;

  private static final DashPrincipal PRINCIPAL = new DashPrincipal() {
    @Override public String getUserId() { return "u1"; }
    @Override public String getEmail() { return "a@b.com"; }
  };

  /** Resolves @AuthenticationPrincipal DashPrincipal to a fixed test principal, no SecurityContext needed. */
  private static final HandlerMethodArgumentResolver PRINCIPAL_RESOLVER = new HandlerMethodArgumentResolver() {
    @Override public boolean supportsParameter(MethodParameter p) {
      return DashPrincipal.class.isAssignableFrom(p.getParameterType());
    }
    @Override public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav,
                                            NativeWebRequest req, WebDataBinderFactory bf) {
      return PRINCIPAL;
    }
  };

  @BeforeEach
  void setup() {
    stripeService = mock(StripeService.class);
    userRepository = mock(UserRepository.class);
    BillingController controller = new BillingController(stripeService, userRepository);
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setCustomArgumentResolvers(PRINCIPAL_RESOLVER)
        .build();
  }

  @Test
  void returnsCheckoutUrl() throws Exception {
    User user = new User();
    user.setId("u1");
    when(userRepository.findById("u1")).thenReturn(Optional.of(user));
    when(stripeService.createCheckoutSession(any()))
        .thenReturn("https://checkout.stripe.com/c/pay/cs_test_9");

    mockMvc.perform(post("/api/v1/billing/checkout-session"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.url").value("https://checkout.stripe.com/c/pay/cs_test_9"));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeServiceCheckoutTest" --tests "com.dashdash.billing.BillingControllerCheckoutTest"
```

Expected: `BUILD SUCCESSFUL`. `createsCustomerWhenMissingThenReturnsCheckoutUrl PASSED`, `reusesExistingCustomerAndDoesNotPersist PASSED`, `returnsCheckoutUrl PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/dashdash/billing/StripeGateway.java \
        backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java \
        backend/src/main/java/com/dashdash/billing/StripeGatewayException.java \
        backend/src/main/java/com/dashdash/billing/StripeService.java \
        backend/src/main/java/com/dashdash/billing/dto/CheckoutSessionResponse.java \
        backend/src/main/java/com/dashdash/billing/BillingController.java \
        backend/src/test/java/com/dashdash/billing/StripeServiceCheckoutTest.java \
        backend/src/test/java/com/dashdash/billing/BillingControllerCheckoutTest.java
git commit -m "feat(billing): Checkout Session via StripeGateway seam + /billing/checkout-session"
```

---

### Task 3: Portal — `StripeService.createPortalSession`, `BillingController` portal endpoint (400 if no customer)

**Files:**
- Modify: `backend/src/main/java/com/dashdash/billing/StripeGateway.java` (add `createPortalSessionUrl`)
- Modify: `backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java` (implement it)
- Modify: `backend/src/main/java/com/dashdash/billing/StripeService.java` (add `createPortalSession`)
- Create: `backend/src/main/java/com/dashdash/billing/NoStripeCustomerException.java`
- Create: `backend/src/main/java/com/dashdash/billing/dto/PortalSessionResponse.java`
- Modify: `backend/src/main/java/com/dashdash/billing/BillingController.java` (add portal endpoint + 400 handler)
- Test: `backend/src/test/java/com/dashdash/billing/StripeServicePortalTest.java`
- Test: `backend/src/test/java/com/dashdash/billing/BillingControllerPortalTest.java`

**Interfaces:**
- Consumes: `ApiError(String code, String message)` (Plan 01, common); `StripeConfig.getPortalReturnUrl()` (Task 1); `Subscription.getStripeCustomerId()` (Plan 02); `PortalSessionResponse(String url)` shape (contract).
- Produces:
  - `StripeGateway.createPortalSessionUrl(String customerId, String returnUrl)` → Billing Portal URL.
  - `StripeService.createPortalSession(User user)` → Portal URL; throws `NoStripeCustomerException` when the user has no `stripeCustomerId` (contract signature).
  - `NoStripeCustomerException extends RuntimeException`.
  - `PortalSessionResponse(String url)` record (contract).
  - `BillingController` `POST /api/v1/billing/portal-session` → `PortalSessionResponse`; `@ExceptionHandler(NoStripeCustomerException)` → 400 `ApiError`.

- [ ] **Step 1: Write the failing test — StripeService portal (mocked gateway)**

Create `backend/src/test/java/com/dashdash/billing/StripeServicePortalTest.java`:

```java
package com.dashdash.billing;

import com.dashdash.auth.Subscription;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StripeServicePortalTest {

  private StripeGateway gateway;
  private StripeService service;

  @BeforeEach
  void setup() {
    gateway = mock(StripeGateway.class);
    UserRepository userRepository = mock(UserRepository.class);
    StripeConfig config = new StripeConfig();
    config.setPortalReturnUrl("https://dashdash.app/app/settings");
    service = new StripeService(gateway, userRepository, config);
  }

  private User userWithCustomer(String customerId) {
    User u = new User();
    u.setId("u1");
    Subscription sub = new Subscription();
    sub.setStripeCustomerId(customerId);
    u.setSubscription(sub);
    return u;
  }

  @Test
  void returnsPortalUrlForCustomer() {
    when(gateway.createPortalSessionUrl("cus_1", "https://dashdash.app/app/settings"))
        .thenReturn("https://billing.stripe.com/p/session/test_1");

    String url = service.createPortalSession(userWithCustomer("cus_1"));

    assertThat(url).isEqualTo("https://billing.stripe.com/p/session/test_1");
  }

  @Test
  void throwsWhenNoCustomer() {
    assertThatThrownBy(() -> service.createPortalSession(userWithCustomer(null)))
        .isInstanceOf(NoStripeCustomerException.class);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeServicePortalTest"
```

Expected: compile error — `cannot find symbol  method createPortalSession(User)` and `class NoStripeCustomerException`. `BUILD FAILED`.

- [ ] **Step 3a: Extend `StripeGateway`**

In `backend/src/main/java/com/dashdash/billing/StripeGateway.java`, add this method to the interface:

```java
  /** Create a Billing Portal session and return its hosted URL. */
  String createPortalSessionUrl(String customerId, String returnUrl);
```

- [ ] **Step 3b: Implement it in `StripeGatewayImpl`**

Add these imports to `StripeGatewayImpl.java`:

```java
import com.stripe.model.billingportal.Session;
import com.stripe.param.billingportal.SessionCreateParams;
```

> Note: the checkout `Session` (Task 2) is `com.stripe.model.checkout.Session`; the portal `Session` is `com.stripe.model.billingportal.Session`. Because both are named `Session`, keep the checkout import as-is and reference the portal one by its fully-qualified name inside the new method to avoid a name clash. Replace the two Task-2 checkout imports usage by keeping `import com.stripe.model.checkout.Session;` and using FQNs below.

Add this method to `StripeGatewayImpl` (uses fully-qualified names so it does not clash with the checkout `Session`/`SessionCreateParams` already imported):

```java
  @Override
  public String createPortalSessionUrl(String customerId, String returnUrl) {
    try {
      com.stripe.param.billingportal.SessionCreateParams params =
          com.stripe.param.billingportal.SessionCreateParams.builder()
              .setCustomer(customerId)
              .setReturnUrl(returnUrl)
              .build();
      com.stripe.model.billingportal.Session session =
          com.stripe.model.billingportal.Session.create(params, options());
      return session.getUrl();
    } catch (com.stripe.exception.StripeException e) {
      throw new StripeGatewayException("createPortalSession failed", e);
    }
  }
```

(Do **not** add the two `import com.stripe.model.billingportal.*` / `param.billingportal.*` lines shown above if they would collide — the FQN form in the method body is self-contained. Skip the import block entirely.)

- [ ] **Step 3c: Create `NoStripeCustomerException`**

`backend/src/main/java/com/dashdash/billing/NoStripeCustomerException.java`:

```java
package com.dashdash.billing;

/** Raised when a billing action needs a Stripe customer but the user has none yet. */
public class NoStripeCustomerException extends RuntimeException {
  public NoStripeCustomerException(String userId) {
    super("No Stripe customer for user " + userId);
  }
}
```

- [ ] **Step 3d: Add `createPortalSession` to `StripeService`**

Add this method to `StripeService`:

```java
  /** Return a Billing Portal URL for the user's Stripe customer; 400-mapped if none. */
  public String createPortalSession(User user) {
    String customerId = user.getSubscription().getStripeCustomerId();
    if (customerId == null || customerId.isBlank()) {
      throw new NoStripeCustomerException(user.getId());
    }
    return gateway.createPortalSessionUrl(customerId, config.getPortalReturnUrl());
  }
```

- [ ] **Step 3e: Create the `PortalSessionResponse` DTO**

`backend/src/main/java/com/dashdash/billing/dto/PortalSessionResponse.java`:

```java
package com.dashdash.billing.dto;

public record PortalSessionResponse(String url) {
}
```

- [ ] **Step 3f: Add the portal endpoint + 400 handler to `BillingController`**

Add these imports to `BillingController.java`:

```java
import com.dashdash.billing.dto.PortalSessionResponse;
import com.dashdash.common.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
```

Add these two methods to the `BillingController` class body:

```java
  @PostMapping("/portal-session")
  public PortalSessionResponse createPortalSession(@AuthenticationPrincipal DashPrincipal principal) {
    User user = userRepository.findById(principal.getUserId()).orElseThrow();
    return new PortalSessionResponse(stripeService.createPortalSession(user));
  }

  @ExceptionHandler(NoStripeCustomerException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ApiError handleNoCustomer(NoStripeCustomerException e) {
    return new ApiError("no_stripe_customer", e.getMessage());
  }
```

> If `com.dashdash.common.ApiError`'s canonical constructor differs from `(String code, String message)`, use the contract's shape `record ApiError(String code, String message)`.

- [ ] **Step 3g: Write the controller test**

Create `backend/src/test/java/com/dashdash/billing/BillingControllerPortalTest.java`:

```java
package com.dashdash.billing;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BillingControllerPortalTest {

  private StripeService stripeService;
  private UserRepository userRepository;
  private MockMvc mockMvc;

  private static final DashPrincipal PRINCIPAL = new DashPrincipal() {
    @Override public String getUserId() { return "u1"; }
    @Override public String getEmail() { return "a@b.com"; }
  };

  private static final HandlerMethodArgumentResolver PRINCIPAL_RESOLVER = new HandlerMethodArgumentResolver() {
    @Override public boolean supportsParameter(MethodParameter p) {
      return DashPrincipal.class.isAssignableFrom(p.getParameterType());
    }
    @Override public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav,
                                            NativeWebRequest req, WebDataBinderFactory bf) {
      return PRINCIPAL;
    }
  };

  @BeforeEach
  void setup() {
    stripeService = mock(StripeService.class);
    userRepository = mock(UserRepository.class);
    BillingController controller = new BillingController(stripeService, userRepository);
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setCustomArgumentResolvers(PRINCIPAL_RESOLVER)
        .build();
    User user = new User();
    user.setId("u1");
    when(userRepository.findById("u1")).thenReturn(Optional.of(user));
  }

  @Test
  void returnsPortalUrl() throws Exception {
    when(stripeService.createPortalSession(any()))
        .thenReturn("https://billing.stripe.com/p/session/test_9");

    mockMvc.perform(post("/api/v1/billing/portal-session"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.url").value("https://billing.stripe.com/p/session/test_9"));
  }

  @Test
  void returns400WhenNoCustomer() throws Exception {
    when(stripeService.createPortalSession(any()))
        .thenThrow(new NoStripeCustomerException("u1"));

    mockMvc.perform(post("/api/v1/billing/portal-session"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("no_stripe_customer"));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeServicePortalTest" --tests "com.dashdash.billing.BillingControllerPortalTest"
```

Expected: `BUILD SUCCESSFUL`. `returnsPortalUrlForCustomer PASSED`, `throwsWhenNoCustomer PASSED`, `returnsPortalUrl PASSED`, `returns400WhenNoCustomer PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/dashdash/billing/StripeGateway.java \
        backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java \
        backend/src/main/java/com/dashdash/billing/StripeService.java \
        backend/src/main/java/com/dashdash/billing/NoStripeCustomerException.java \
        backend/src/main/java/com/dashdash/billing/dto/PortalSessionResponse.java \
        backend/src/main/java/com/dashdash/billing/BillingController.java \
        backend/src/test/java/com/dashdash/billing/StripeServicePortalTest.java \
        backend/src/test/java/com/dashdash/billing/BillingControllerPortalTest.java
git commit -m "feat(billing): Billing Portal session + /billing/portal-session (400 when no customer)"
```

---

### Task 4: Webhook intake — `StripeWebhookController`, `verifyAndParse`, dedupe (`alreadyProcessed`/`markProcessed`)

**Files:**
- Modify: `backend/src/main/java/com/dashdash/billing/StripeGateway.java` (add `constructEvent`)
- Modify: `backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java` (implement it)
- Modify: `backend/src/main/java/com/dashdash/billing/StripeService.java` (add `verifyAndParse`)
- Create: `backend/src/main/java/com/dashdash/billing/SubscriptionService.java`
- Create: `backend/src/main/java/com/dashdash/billing/StripeWebhookController.java`
- Test: `backend/src/test/java/com/dashdash/billing/StripeServiceVerifyTest.java`
- Test: `backend/src/test/java/com/dashdash/billing/SubscriptionServiceDedupeTest.java`
- Test: `backend/src/test/java/com/dashdash/billing/StripeWebhookControllerTest.java`

**Interfaces:**
- Consumes: `ProcessedStripeEventRepository` (Task 1); `StripeConfig.getWebhookSecret()` (Task 1); `com.stripe.model.Event`, `com.stripe.net.Webhook`, `com.stripe.exception.SignatureVerificationException` (SDK). Security config exempts `/billing/webhook` from CSRF + auth (Plan 01/02).
- Produces:
  - `StripeGateway.constructEvent(byte[] payload, String signatureHeader, String webhookSecret)` → `com.stripe.model.Event` (throws `SignatureVerificationException`).
  - `StripeService.verifyAndParse(byte[] rawBody, String signatureHeader)` → `com.stripe.model.Event` (contract signature; throws `SignatureVerificationException`).
  - `SubscriptionService.alreadyProcessed(String eventId)` / `markProcessed(String eventId, String type)` (contract signatures).
  - `StripeWebhookController` `POST /api/v1/billing/webhook` consuming `byte[]` body + `Stripe-Signature` header → 200 (ok/duplicate) / 400 (bad signature).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/test/java/com/dashdash/billing/StripeServiceVerifyTest.java`:

```java
package com.dashdash.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StripeServiceVerifyTest {

  private StripeGateway gateway;
  private StripeService service;

  @BeforeEach
  void setup() throws Exception {
    gateway = mock(StripeGateway.class);
    StripeConfig config = new StripeConfig();
    config.setWebhookSecret("whsec_test");
    service = new StripeService(gateway, mock(com.dashdash.auth.UserRepository.class), config);
  }

  @Test
  void delegatesToGatewayWithConfiguredSecret() throws Exception {
    Event event = mock(Event.class);
    byte[] body = "{}".getBytes();
    when(gateway.constructEvent(body, "sig", "whsec_test")).thenReturn(event);

    Event out = service.verifyAndParse(body, "sig");

    assertThat(out).isSameAs(event);
  }

  @Test
  void propagatesSignatureFailure() throws Exception {
    byte[] body = "{}".getBytes();
    when(gateway.constructEvent(body, "bad", "whsec_test"))
        .thenThrow(new SignatureVerificationException("bad sig", "bad"));

    assertThatThrownBy(() -> service.verifyAndParse(body, "bad"))
        .isInstanceOf(SignatureVerificationException.class);
  }
}
```

Create `backend/src/test/java/com/dashdash/billing/SubscriptionServiceDedupeTest.java`:

```java
package com.dashdash.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubscriptionServiceDedupeTest {

  private ProcessedStripeEventRepository repo;
  private SubscriptionService service;

  @BeforeEach
  void setup() {
    repo = mock(ProcessedStripeEventRepository.class);
    service = new SubscriptionService(repo);
  }

  @Test
  void alreadyProcessedReflectsRepository() {
    when(repo.existsById("evt_1")).thenReturn(true);
    when(repo.existsById("evt_2")).thenReturn(false);

    assertThat(service.alreadyProcessed("evt_1")).isTrue();
    assertThat(service.alreadyProcessed("evt_2")).isFalse();
  }

  @Test
  void markProcessedSavesEventWithIdAndType() {
    service.markProcessed("evt_9", "invoice.paid");

    ArgumentCaptor<ProcessedStripeEvent> saved = ArgumentCaptor.forClass(ProcessedStripeEvent.class);
    verify(repo).save(saved.capture());
    assertThat(saved.getValue().getId()).isEqualTo("evt_9");
    assertThat(saved.getValue().getType()).isEqualTo("invoice.paid");
    assertThat(saved.getValue().getProcessedAt()).isNotNull();
  }
}
```

Create `backend/src/test/java/com/dashdash/billing/StripeWebhookControllerTest.java`:

```java
package com.dashdash.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StripeWebhookControllerTest {

  private StripeService stripeService;
  private SubscriptionService subscriptionService;
  private MockMvc mockMvc;

  @BeforeEach
  void setup() {
    stripeService = mock(StripeService.class);
    subscriptionService = mock(SubscriptionService.class);
    StripeWebhookController controller = new StripeWebhookController(stripeService, subscriptionService);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void validSignatureIsProcessedAndReturns200() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_1");
    when(event.getType()).thenReturn("customer.subscription.updated");
    when(stripeService.verifyAndParse(any(), eq("good-sig"))).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_1")).thenReturn(false);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "good-sig")
            .content("{\"id\":\"evt_1\"}".getBytes()))
        .andExpect(status().isOk());

    verify(subscriptionService).markProcessed("evt_1", "customer.subscription.updated");
  }

  @Test
  void badSignatureReturns400() throws Exception {
    when(stripeService.verifyAndParse(any(), eq("bad-sig")))
        .thenThrow(new SignatureVerificationException("bad", "bad-sig"));

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "bad-sig")
            .content("{}".getBytes()))
        .andExpect(status().isBadRequest());

    verify(subscriptionService, never()).markProcessed(any(), any());
  }

  @Test
  void duplicateEventIsNoOpAndReturns200() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_dup");
    when(event.getType()).thenReturn("invoice.paid");
    when(stripeService.verifyAndParse(any(), any())).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_dup")).thenReturn(true);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "good-sig")
            .content("{}".getBytes()))
        .andExpect(status().isOk());

    verify(subscriptionService, never()).markProcessed(any(), any());
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeServiceVerifyTest" --tests "com.dashdash.billing.SubscriptionServiceDedupeTest" --tests "com.dashdash.billing.StripeWebhookControllerTest"
```

Expected: compile errors — `cannot find symbol  method verifyAndParse`, `class SubscriptionService`, `class StripeWebhookController`, `method constructEvent`. `BUILD FAILED`.

- [ ] **Step 3a: Extend `StripeGateway` with `constructEvent`**

Add to `StripeGateway.java`:

```java
  /** Verify the raw webhook body against the signature and parse it into an Event. */
  com.stripe.model.Event constructEvent(byte[] payload, String signatureHeader, String webhookSecret)
      throws com.stripe.exception.SignatureVerificationException;
```

- [ ] **Step 3b: Implement `constructEvent` in `StripeGatewayImpl`**

Add this method to `StripeGatewayImpl` (uses FQNs to avoid extra imports):

```java
  @Override
  public com.stripe.model.Event constructEvent(byte[] payload, String signatureHeader, String webhookSecret)
      throws com.stripe.exception.SignatureVerificationException {
    String json = new String(payload, java.nio.charset.StandardCharsets.UTF_8);
    return com.stripe.net.Webhook.constructEvent(json, signatureHeader, webhookSecret);
  }
```

- [ ] **Step 3c: Add `verifyAndParse` to `StripeService`**

Add this method to `StripeService`:

```java
  /** Verify the Stripe signature over the raw body and return the parsed Event. */
  public com.stripe.model.Event verifyAndParse(byte[] rawBody, String signatureHeader)
      throws com.stripe.exception.SignatureVerificationException {
    return gateway.constructEvent(rawBody, signatureHeader, config.getWebhookSecret());
  }
```

- [ ] **Step 3d: Create `SubscriptionService` (dedupe only for now; state machine added in Task 5)**

`backend/src/main/java/com/dashdash/billing/SubscriptionService.java`:

```java
package com.dashdash.billing;

import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class SubscriptionService {

  private final ProcessedStripeEventRepository processedEvents;

  public SubscriptionService(ProcessedStripeEventRepository processedEvents) {
    this.processedEvents = processedEvents;
  }

  public boolean alreadyProcessed(String eventId) {
    return processedEvents.existsById(eventId);
  }

  public void markProcessed(String eventId, String type) {
    ProcessedStripeEvent e = new ProcessedStripeEvent();
    e.setId(eventId);
    e.setType(type);
    e.setProcessedAt(Instant.now());
    processedEvents.save(e);
  }
}
```

- [ ] **Step 3e: Create `StripeWebhookController`**

`backend/src/main/java/com/dashdash/billing/StripeWebhookController.java`:

```java
package com.dashdash.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
public class StripeWebhookController {

  private final StripeService stripeService;
  private final SubscriptionService subscriptionService;

  public StripeWebhookController(StripeService stripeService, SubscriptionService subscriptionService) {
    this.stripeService = stripeService;
    this.subscriptionService = subscriptionService;
  }

  /**
   * Raw-body webhook. Body is consumed as byte[] so the signature is verified over the exact
   * bytes Stripe signed (never pre-parsed as JSON). Public + CSRF-exempt via SecurityConfig.
   */
  @PostMapping("/webhook")
  public ResponseEntity<String> handle(@RequestBody byte[] payload,
                                       @RequestHeader("Stripe-Signature") String signature) {
    Event event;
    try {
      event = stripeService.verifyAndParse(payload, signature);
    } catch (SignatureVerificationException e) {
      return ResponseEntity.badRequest().body("invalid signature");
    }
    if (subscriptionService.alreadyProcessed(event.getId())) {
      return ResponseEntity.ok("duplicate");
    }
    subscriptionService.markProcessed(event.getId(), event.getType());
    return ResponseEntity.ok("ok");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.StripeServiceVerifyTest" --tests "com.dashdash.billing.SubscriptionServiceDedupeTest" --tests "com.dashdash.billing.StripeWebhookControllerTest"
```

Expected: `BUILD SUCCESSFUL`. `delegatesToGatewayWithConfiguredSecret PASSED`, `propagatesSignatureFailure PASSED`, `alreadyProcessedReflectsRepository PASSED`, `markProcessedSavesEventWithIdAndType PASSED`, `validSignatureIsProcessedAndReturns200 PASSED`, `badSignatureReturns400 PASSED`, `duplicateEventIsNoOpAndReturns200 PASSED`.

- [ ] **Step 4b: Verify the webhook is CSRF-exempt + raw-body (config owned by Plan 01/02)**

```bash
cd backend && grep -R "billing/webhook" src/main/java/com/dashdash/config/
```

Expected: the security filter chain lists `/api/v1/billing/webhook` under both `permitAll()` and CSRF `ignoringRequestMatchers(...)` (contract Security rules). If it is **not** present, that is a Plan 01/02 defect — add `/api/v1/billing/webhook` to `permitAll` and to `csrf().ignoringRequestMatchers(...)` before continuing (do not weaken CSRF for any other path). The controller reads `@RequestBody byte[]`, so no JSON pre-parse occurs.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/dashdash/billing/StripeGateway.java \
        backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java \
        backend/src/main/java/com/dashdash/billing/StripeService.java \
        backend/src/main/java/com/dashdash/billing/SubscriptionService.java \
        backend/src/main/java/com/dashdash/billing/StripeWebhookController.java \
        backend/src/test/java/com/dashdash/billing/StripeServiceVerifyTest.java \
        backend/src/test/java/com/dashdash/billing/SubscriptionServiceDedupeTest.java \
        backend/src/test/java/com/dashdash/billing/StripeWebhookControllerTest.java
git commit -m "feat(billing): signature-verified raw-body webhook intake with event dedupe"
```

---

### Task 5: Subscription state machine — `applyFromStripe`, `handleDispute`, event dispatcher; downgrade reconcile

**Files:**
- Create: `backend/src/main/java/com/dashdash/billing/StripeSubscriptionSnapshot.java`
- Modify: `backend/src/main/java/com/dashdash/billing/StripeGateway.java` (add `retrieveSubscription`, `retrieveChargeCustomerId`)
- Modify: `backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java` (implement them)
- Modify: `backend/src/main/java/com/dashdash/billing/SubscriptionService.java` (add gateway/user/dashboard deps + `applyFromStripe`/`handleDispute`/`handleEvent`)
- Modify: `backend/src/main/java/com/dashdash/billing/StripeWebhookController.java` (dispatch `handleEvent` before `markProcessed`)
- Test: `backend/src/test/java/com/dashdash/billing/SubscriptionServiceStateMachineTest.java`
- Test: `backend/src/test/java/com/dashdash/billing/StripeWebhookControllerDispatchTest.java`

**Interfaces:**
- Consumes: `UserRepository.findBySubscriptionStripeCustomerId(String)` (Plan 02); `User.getSubscription()/getDashboard()/setDashboard(Dashboard)` (Plan 02); `Subscription` setters `setTier/setStatus/setPriceId/setStripeSubscriptionId/setCurrentPeriodEnd/setCancelAtPeriodEnd` + `getTier()` (Plan 02); `Tier`, `SubStatus` (Plan 02); `Dashboard` + `Dashboard.defaultFor(boolean)` (Plan 02); `DashboardService.reconcileForTier(Dashboard current, boolean premium)` (Plan 03); Stripe models `Subscription`, `SubscriptionItem`, `Charge`, `Invoice`, `Dispute`, `checkout.Session`, `Event`, `StripeObject`.
- Produces:
  - `StripeSubscriptionSnapshot(String subscriptionId, String customerId, String status, String priceId, Long currentPeriodEnd, boolean cancelAtPeriodEnd)` record.
  - `StripeGateway.retrieveSubscription(String subscriptionId)` → `StripeSubscriptionSnapshot`; `StripeGateway.retrieveChargeCustomerId(String chargeId)` → `String`.
  - `SubscriptionService.applyFromStripe(String stripeSubscriptionId)`, `SubscriptionService.handleDispute(String chargeId)` (contract signatures); `SubscriptionService.handleEvent(com.stripe.model.Event event)` (dispatcher — new helper declared here).

- [ ] **Step 1: Write the failing tests — state machine per event type**

Create `backend/src/test/java/com/dashdash/billing/SubscriptionServiceStateMachineTest.java`:

```java
package com.dashdash.billing;

import com.dashdash.auth.SubStatus;
import com.dashdash.auth.Subscription;
import com.dashdash.auth.Tier;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.dashboard.Cell;
import com.dashdash.dashboard.CellType;
import com.dashdash.dashboard.Dashboard;
import com.dashdash.dashboard.DashboardService;
import com.dashdash.dashboard.OpenMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SubscriptionServiceStateMachineTest {

  private StripeGateway gateway;
  private UserRepository userRepository;
  private DashboardService dashboardService;
  private SubscriptionService service;

  @BeforeEach
  void setup() {
    gateway = mock(StripeGateway.class);
    userRepository = mock(UserRepository.class);
    dashboardService = mock(DashboardService.class);
    ProcessedStripeEventRepository processedEvents = mock(ProcessedStripeEventRepository.class);
    service = new SubscriptionService(processedEvents, gateway, userRepository, dashboardService);
  }

  private User user(Tier tier, SubStatus status, String customerId) {
    User u = new User();
    u.setId("u_" + customerId);
    Subscription sub = new Subscription();
    sub.setTier(tier);
    sub.setStatus(status);
    sub.setStripeCustomerId(customerId);
    sub.setStripeSubscriptionId("sub_pre");
    u.setSubscription(sub);
    u.setDashboard(Dashboard.defaultFor(tier == Tier.PREMIUM));
    return u;
  }

  @Test
  void activateSetsPremiumWithoutReconcile() {
    User u = user(Tier.FREE, SubStatus.NONE, "cus_1");
    when(gateway.retrieveSubscription("sub_1")).thenReturn(
        new StripeSubscriptionSnapshot("sub_1", "cus_1", "active", "price_abc", 1893456000L, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_1")).thenReturn(Optional.of(u));

    service.applyFromStripe("sub_1");

    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.PREMIUM);
    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.ACTIVE);
    assertThat(u.getSubscription().getStripeSubscriptionId()).isEqualTo("sub_1");
    assertThat(u.getSubscription().getPriceId()).isEqualTo("price_abc");
    assertThat(u.getSubscription().getCurrentPeriodEnd()).isEqualTo(Instant.ofEpochSecond(1893456000L));
    assertThat(u.getSubscription().isCancelAtPeriodEnd()).isFalse();
    verify(userRepository).save(u);
    verify(dashboardService, never()).reconcileForTier(any(), anyBoolean());
  }

  @Test
  void cancelDowngradesAndReconciles() {
    User u = user(Tier.PREMIUM, SubStatus.ACTIVE, "cus_2");
    // Simulate reconcileForTier parking the displaced slot-5 app (no empty slot was free).
    Dashboard reconciled = Dashboard.defaultFor(false);
    Cell parked = new Cell();
    parked.setSlot(0);
    parked.setType(CellType.APP);
    parked.setUrl("https://mail.google.com");
    parked.setOpenMode(OpenMode.FRAME);
    reconciled.setParkedApp(parked);
    when(gateway.retrieveSubscription("sub_2")).thenReturn(
        new StripeSubscriptionSnapshot("sub_2", "cus_2", "canceled", "price_abc", null, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_2")).thenReturn(Optional.of(u));
    when(dashboardService.reconcileForTier(any(), eq(false))).thenReturn(reconciled);

    service.applyFromStripe("sub_2");

    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboardService).reconcileForTier(any(), eq(false));
    // The FULL reconciled Dashboard is persisted — parkedApp must NOT be dropped.
    assertThat(u.getDashboard()).isSameAs(reconciled);
    assertThat(u.getDashboard().getParkedApp()).isSameAs(parked);
    verify(userRepository).save(u);
  }

  @Test
  void pastDueRemovesPremium() {
    User u = user(Tier.PREMIUM, SubStatus.ACTIVE, "cus_3");
    when(gateway.retrieveSubscription("sub_3")).thenReturn(
        new StripeSubscriptionSnapshot("sub_3", "cus_3", "past_due", "price_abc", null, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_3")).thenReturn(Optional.of(u));
    when(dashboardService.reconcileForTier(any(), eq(false))).thenReturn(Dashboard.defaultFor(false));

    service.applyFromStripe("sub_3");

    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.PAST_DUE);
    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
    verify(dashboardService).reconcileForTier(any(), eq(false));
  }

  @Test
  void disputeRevokesPremium() {
    User u = user(Tier.PREMIUM, SubStatus.ACTIVE, "cus_4");
    when(gateway.retrieveChargeCustomerId("ch_1")).thenReturn("cus_4");
    when(userRepository.findBySubscriptionStripeCustomerId("cus_4")).thenReturn(Optional.of(u));
    when(dashboardService.reconcileForTier(any(), eq(false))).thenReturn(Dashboard.defaultFor(false));

    service.handleDispute("ch_1");

    assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
    assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.CANCELED);
    verify(dashboardService).reconcileForTier(any(), eq(false));
    verify(userRepository).save(u);
  }

  @Test
  void ignoresUnknownCustomer() {
    when(gateway.retrieveSubscription("sub_x")).thenReturn(
        new StripeSubscriptionSnapshot("sub_x", "cus_unknown", "active", "p", null, false));
    when(userRepository.findBySubscriptionStripeCustomerId("cus_unknown")).thenReturn(Optional.empty());

    service.applyFromStripe("sub_x");

    verify(userRepository, never()).save(any());
  }
}
```

Create `backend/src/test/java/com/dashdash/billing/StripeWebhookControllerDispatchTest.java`:

```java
package com.dashdash.billing;

import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StripeWebhookControllerDispatchTest {

  private StripeService stripeService;
  private SubscriptionService subscriptionService;
  private MockMvc mockMvc;

  @BeforeEach
  void setup() {
    stripeService = mock(StripeService.class);
    subscriptionService = mock(SubscriptionService.class);
    mockMvc = MockMvcBuilders
        .standaloneSetup(new StripeWebhookController(stripeService, subscriptionService))
        .build();
  }

  @Test
  void dispatchesEventThenMarksProcessed() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_1");
    when(event.getType()).thenReturn("customer.subscription.updated");
    when(stripeService.verifyAndParse(any(), any())).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_1")).thenReturn(false);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "sig")
            .content("{}".getBytes()))
        .andExpect(status().isOk());

    InOrder order = inOrder(subscriptionService);
    order.verify(subscriptionService).handleEvent(event);
    order.verify(subscriptionService).markProcessed("evt_1", "customer.subscription.updated");
  }

  @Test
  void duplicateDoesNotDispatch() throws Exception {
    Event event = mock(Event.class);
    when(event.getId()).thenReturn("evt_dup");
    when(stripeService.verifyAndParse(any(), any())).thenReturn(event);
    when(subscriptionService.alreadyProcessed("evt_dup")).thenReturn(true);

    mockMvc.perform(post("/api/v1/billing/webhook")
            .header("Stripe-Signature", "sig")
            .content("{}".getBytes()))
        .andExpect(status().isOk());

    verify(subscriptionService, never()).handleEvent(any());
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.SubscriptionServiceStateMachineTest" --tests "com.dashdash.billing.StripeWebhookControllerDispatchTest"
```

Expected: compile errors — `class StripeSubscriptionSnapshot`, constructor `SubscriptionService(ProcessedStripeEventRepository, StripeGateway, UserRepository, DashboardService)`, methods `applyFromStripe`, `handleDispute`, `handleEvent`, `retrieveSubscription`, `retrieveChargeCustomerId` not found. `BUILD FAILED`.

- [ ] **Step 3a: Create `StripeSubscriptionSnapshot`**

`backend/src/main/java/com/dashdash/billing/StripeSubscriptionSnapshot.java`:

```java
package com.dashdash.billing;

/** Immutable projection of the Stripe fields we persist, decoupling services from SDK model shape. */
public record StripeSubscriptionSnapshot(
    String subscriptionId,
    String customerId,
    String status,             // raw Stripe status string, e.g. "active"
    String priceId,
    Long currentPeriodEnd,     // epoch seconds; may be null
    boolean cancelAtPeriodEnd) {
}
```

- [ ] **Step 3b: Extend `StripeGateway`**

Add to `StripeGateway.java`:

```java
  /** Re-fetch the subscription and project the fields we persist. */
  StripeSubscriptionSnapshot retrieveSubscription(String subscriptionId);

  /** Resolve the Stripe customer id that owns a charge (for dispute handling); null if none. */
  String retrieveChargeCustomerId(String chargeId);
```

- [ ] **Step 3c: Implement them in `StripeGatewayImpl`**

Add these two methods to `StripeGatewayImpl` (FQNs avoid import clashes; `current_period_end` lives on the subscription item in the pinned `basil` API version):

```java
  @Override
  public StripeSubscriptionSnapshot retrieveSubscription(String subscriptionId) {
    try {
      com.stripe.model.Subscription sub = com.stripe.model.Subscription.retrieve(subscriptionId, options());
      com.stripe.model.SubscriptionItem item = sub.getItems().getData().get(0);
      Long periodEnd = item.getCurrentPeriodEnd();
      String priceId = item.getPrice() != null ? item.getPrice().getId() : null;
      boolean cancelAtPeriodEnd = Boolean.TRUE.equals(sub.getCancelAtPeriodEnd());
      return new StripeSubscriptionSnapshot(
          sub.getId(), sub.getCustomer(), sub.getStatus(), priceId, periodEnd, cancelAtPeriodEnd);
    } catch (com.stripe.exception.StripeException e) {
      throw new StripeGatewayException("retrieveSubscription failed", e);
    }
  }

  @Override
  public String retrieveChargeCustomerId(String chargeId) {
    try {
      com.stripe.model.Charge charge = com.stripe.model.Charge.retrieve(chargeId, options());
      return charge.getCustomer();
    } catch (com.stripe.exception.StripeException e) {
      throw new StripeGatewayException("retrieveCharge failed", e);
    }
  }
```

- [ ] **Step 3d: Replace `SubscriptionService` with the full state machine**

Overwrite `backend/src/main/java/com/dashdash/billing/SubscriptionService.java` with:

```java
package com.dashdash.billing;

import com.dashdash.auth.SubStatus;
import com.dashdash.auth.Subscription;
import com.dashdash.auth.Tier;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.dashboard.Dashboard;
import com.dashdash.dashboard.DashboardService;
import com.stripe.model.Event;
import com.stripe.model.StripeObject;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class SubscriptionService {

  private final ProcessedStripeEventRepository processedEvents;
  private final StripeGateway gateway;
  private final UserRepository userRepository;
  private final DashboardService dashboardService;

  public SubscriptionService(ProcessedStripeEventRepository processedEvents,
                             StripeGateway gateway,
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
    ProcessedStripeEvent e = new ProcessedStripeEvent();
    e.setId(eventId);
    e.setType(type);
    e.setProcessedAt(Instant.now());
    processedEvents.save(e);
  }

  // ---- dispatcher -----------------------------------------------------------

  /** Route a verified Stripe event to the right state transition. Unhandled types are ignored. */
  public void handleEvent(Event event) {
    switch (event.getType()) {
      case "checkout.session.completed" -> {
        com.stripe.model.checkout.Session session = (com.stripe.model.checkout.Session) deserialize(event);
        if (session.getSubscription() != null) {
          applyFromStripe(session.getSubscription());
        }
      }
      case "customer.subscription.created",
           "customer.subscription.updated",
           "customer.subscription.deleted",
           "customer.subscription.paused",
           "customer.subscription.resumed" -> {
        com.stripe.model.Subscription sub = (com.stripe.model.Subscription) deserialize(event);
        applyFromStripe(sub.getId());
      }
      case "invoice.paid", "invoice.payment_failed" -> {
        com.stripe.model.Invoice invoice = (com.stripe.model.Invoice) deserialize(event);
        resyncByCustomer(invoice.getCustomer());
      }
      case "charge.dispute.created" -> {
        com.stripe.model.Dispute dispute = (com.stripe.model.Dispute) deserialize(event);
        handleDispute(dispute.getCharge());
      }
      default -> {
        // Event types we do not act on are acknowledged (200) and intentionally ignored.
      }
    }
  }

  // ---- state transitions ----------------------------------------------------

  /** Re-fetch the subscription, recompute premium, persist the user, reconcile on downgrade. */
  public void applyFromStripe(String stripeSubscriptionId) {
    StripeSubscriptionSnapshot snap = gateway.retrieveSubscription(stripeSubscriptionId);
    User user = userRepository.findBySubscriptionStripeCustomerId(snap.customerId()).orElse(null);
    if (user == null) {
      return; // unknown customer -> nothing to update
    }
    Subscription sub = user.getSubscription();
    boolean wasPremium = sub.getTier() == Tier.PREMIUM;

    SubStatus status = mapStatus(snap.status());
    boolean premium = status == SubStatus.ACTIVE || status == SubStatus.TRIALING;

    sub.setStatus(status);
    sub.setTier(premium ? Tier.PREMIUM : Tier.FREE);
    sub.setPriceId(snap.priceId());
    sub.setStripeSubscriptionId(snap.subscriptionId());
    sub.setCurrentPeriodEnd(snap.currentPeriodEnd() == null
        ? null : Instant.ofEpochSecond(snap.currentPeriodEnd()));
    sub.setCancelAtPeriodEnd(snap.cancelAtPeriodEnd());

    if (wasPremium && !premium) {
      // Persist the WHOLE reconciled Dashboard returned by reconcileForTier — it may set
      // Dashboard.parkedApp when slot 5 held an app and no empty slot was free. Never copy out
      // only cells; setDashboard(...) keeps parkedApp so the page can later prompt to place it.
      Dashboard reconciled = dashboardService.reconcileForTier(user.getDashboard(), false);
      user.setDashboard(reconciled);
    }
    userRepository.save(user);
  }

  /** Policy: a dispute revokes premium immediately. */
  public void handleDispute(String chargeId) {
    String customerId = gateway.retrieveChargeCustomerId(chargeId);
    if (customerId == null) {
      return;
    }
    userRepository.findBySubscriptionStripeCustomerId(customerId).ifPresent(user -> {
      Subscription sub = user.getSubscription();
      boolean wasPremium = sub.getTier() == Tier.PREMIUM;
      sub.setTier(Tier.FREE);
      sub.setStatus(SubStatus.CANCELED);
      if (wasPremium) {
        // Same rule as applyFromStripe: save the full reconciled Dashboard (incl. parkedApp).
        Dashboard reconciled = dashboardService.reconcileForTier(user.getDashboard(), false);
        user.setDashboard(reconciled);
      }
      userRepository.save(user);
    });
  }

  // ---- helpers --------------------------------------------------------------

  private void resyncByCustomer(String customerId) {
    if (customerId == null) {
      return;
    }
    userRepository.findBySubscriptionStripeCustomerId(customerId)
        .map(u -> u.getSubscription().getStripeSubscriptionId())
        .filter(id -> id != null && !id.isBlank())
        .ifPresent(this::applyFromStripe);
  }

  static SubStatus mapStatus(String stripeStatus) {
    if (stripeStatus == null) {
      return SubStatus.NONE;
    }
    return switch (stripeStatus) {
      case "active" -> SubStatus.ACTIVE;
      case "trialing" -> SubStatus.TRIALING;
      case "past_due", "unpaid" -> SubStatus.PAST_DUE;
      case "canceled", "incomplete_expired", "paused" -> SubStatus.CANCELED;
      default -> SubStatus.NONE; // incomplete + any unknown
    };
  }

  private StripeObject deserialize(Event event) {
    var deserializer = event.getDataObjectDeserializer();
    if (deserializer.getObject().isPresent()) {
      return deserializer.getObject().get();
    }
    try {
      return deserializer.deserializeUnsafe();
    } catch (com.stripe.exception.EventDataObjectDeserializationException e) {
      throw new StripeGatewayException("event deserialize failed for " + event.getId(), e);
    }
  }
}
```

- [ ] **Step 3e: Wire the dispatcher into the webhook controller**

In `StripeWebhookController.handle`, insert the dispatch call **before** `markProcessed` so a handler failure (500) leaves the event unrecorded and Stripe retries. Replace:

```java
    if (subscriptionService.alreadyProcessed(event.getId())) {
      return ResponseEntity.ok("duplicate");
    }
    subscriptionService.markProcessed(event.getId(), event.getType());
    return ResponseEntity.ok("ok");
```

with:

```java
    if (subscriptionService.alreadyProcessed(event.getId())) {
      return ResponseEntity.ok("duplicate");
    }
    subscriptionService.handleEvent(event);
    subscriptionService.markProcessed(event.getId(), event.getType());
    return ResponseEntity.ok("ok");
```

- [ ] **Step 4: Run tests to verify they pass (including the Task-4 webhook test, which stays green)**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.SubscriptionServiceStateMachineTest" --tests "com.dashdash.billing.StripeWebhookControllerDispatchTest" --tests "com.dashdash.billing.StripeWebhookControllerTest"
```

Expected: `BUILD SUCCESSFUL`. All state-machine tests pass (`activateSetsPremiumWithoutReconcile`, `cancelDowngradesAndReconciles`, `pastDueRemovesPremium`, `disputeRevokesPremium`, `ignoresUnknownCustomer`), `dispatchesEventThenMarksProcessed`, `duplicateDoesNotDispatch`, and the Task-4 `StripeWebhookControllerTest` cases still pass.

- [ ] **Step 4b: Run the whole billing backend suite once to confirm no regressions**

```bash
cd backend && ./gradlew test --tests "com.dashdash.billing.*"
```

Expected: `BUILD SUCCESSFUL` with every `com.dashdash.billing.*` test green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/dashdash/billing/StripeSubscriptionSnapshot.java \
        backend/src/main/java/com/dashdash/billing/StripeGateway.java \
        backend/src/main/java/com/dashdash/billing/StripeGatewayImpl.java \
        backend/src/main/java/com/dashdash/billing/SubscriptionService.java \
        backend/src/main/java/com/dashdash/billing/StripeWebhookController.java \
        backend/src/test/java/com/dashdash/billing/SubscriptionServiceStateMachineTest.java \
        backend/src/test/java/com/dashdash/billing/StripeWebhookControllerDispatchTest.java
git commit -m "feat(billing): subscription state machine + event dispatcher with downgrade reconcile"
```

---

### Task 6: Frontend billing — `BillingApi`, `UpgradeComponent`, `SettingsComponent`, routes

**Files:**
- Create: `frontend/src/app/core/api/billing.api.ts`
- Create: `frontend/src/app/features/billing/upgrade.component.ts`
- Create: `frontend/src/app/features/billing/settings.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (add guarded `app/upgrade` + `app/settings` routes)
- Test: `frontend/src/app/features/billing/upgrade.component.spec.ts`
- Test: `frontend/src/app/features/billing/settings.component.spec.ts`

**Interfaces:**
- Consumes: `environment.apiBaseUrl` (Plan 01); `AuthStore.tier` signal accessor (Plan 02); `authGuard` (Plan 02); `credentials.interceptor` (Plan 01/02, adds `withCredentials`).
- Produces:
  - `BillingApi` (`providedIn: 'root'`): `createCheckoutSession(): Observable<{ url: string }>`; `createPortalSession(): Observable<{ url: string }>` (contract).
  - `UpgradeComponent` at route `app/upgrade`; CTA copy exactly **"Remove ad — go Premium"**; on click → `createCheckoutSession()` → `window.location.href = url`.
  - `SettingsComponent` at route `app/settings`; "Manage billing" → `createPortalSession()` → redirect.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/app/features/billing/upgrade.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpgradeComponent } from './upgrade.component';
import { environment } from '../../../environments/environment';

describe('UpgradeComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('redirects to the checkout url returned by the API', () => {
    const fixture = TestBed.createComponent(UpgradeComponent);
    const component = fixture.componentInstance;
    const redirect = vi.spyOn(component as unknown as { redirectTo: (u: string) => void }, 'redirectTo')
      .mockImplementation(() => {});

    component.upgrade();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/billing/checkout-session`);
    expect(req.request.method).toBe('POST');
    req.flush({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

    expect(redirect).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
    httpMock.verify();
  });

  it('uses the exact premium CTA copy', () => {
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.cta');
    expect(button.textContent?.trim()).toBe('Remove ad — go Premium');
  });
});
```

Create `frontend/src/app/features/billing/settings.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { AuthStore } from '../../stores/auth.store';
import { environment } from '../../../environments/environment';

describe('SettingsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { tier: signal('FREE') } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('redirects to the portal url returned by the API', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    const redirect = vi.spyOn(component as unknown as { redirectTo: (u: string) => void }, 'redirectTo')
      .mockImplementation(() => {});

    component.manageBilling();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/billing/portal-session`);
    expect(req.request.method).toBe('POST');
    req.flush({ url: 'https://billing.stripe.com/p/session/test_1' });

    expect(redirect).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test_1');
    httpMock.verify();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/app/features/billing/upgrade.component.spec.ts src/app/features/billing/settings.component.spec.ts
```

Expected: failure — `Failed to resolve import "./upgrade.component"` / `"./settings.component"` and `../../core/api/billing.api`. Tests error out (modules missing).

- [ ] **Step 3a: Create `BillingApi`**

`frontend/src/app/core/api/billing.api.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  createCheckoutSession(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/billing/checkout-session`, {});
  }

  createPortalSession(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/billing/portal-session`, {});
  }
}
```

- [ ] **Step 3b: Create `UpgradeComponent`**

`frontend/src/app/features/billing/upgrade.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BillingApi } from '../../core/api/billing.api';

@Component({
  selector: 'dd-upgrade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="upgrade">
      <h1>Go Premium</h1>
      <p>Unlock all six cells and remove ads from your dashboard.</p>
      <button type="button" class="cta" (click)="upgrade()" [disabled]="loading()">
        Remove ad — go Premium
      </button>
    </section>
  `,
})
export class UpgradeComponent {
  private readonly billingApi = inject(BillingApi);
  protected readonly loading = signal(false);

  upgrade(): void {
    this.loading.set(true);
    this.billingApi.createCheckoutSession().subscribe({
      next: (res) => this.redirectTo(res.url),
      error: () => this.loading.set(false),
    });
  }

  protected redirectTo(url: string): void {
    window.location.href = url;
  }
}
```

- [ ] **Step 3c: Create `SettingsComponent`**

`frontend/src/app/features/billing/settings.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BillingApi } from '../../core/api/billing.api';
import { AuthStore } from '../../stores/auth.store';

@Component({
  selector: 'dd-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="settings">
      <h1>Account &amp; billing</h1>
      <p>Current plan: {{ tier() }}</p>
      <button type="button" class="manage" (click)="manageBilling()" [disabled]="loading()">
        Manage billing
      </button>
    </section>
  `,
})
export class SettingsComponent {
  private readonly billingApi = inject(BillingApi);
  private readonly authStore = inject(AuthStore);
  protected readonly tier = this.authStore.tier;
  protected readonly loading = signal(false);

  manageBilling(): void {
    this.loading.set(true);
    this.billingApi.createPortalSession().subscribe({
      next: (res) => this.redirectTo(res.url),
      error: () => this.loading.set(false),
    });
  }

  protected redirectTo(url: string): void {
    window.location.href = url;
  }
}
```

- [ ] **Step 3d: Register the routes**

In `frontend/src/app/app.routes.ts`, add these two guarded routes to the exported `routes` array (they are lazy-loaded and protected by the Plan-02 `authGuard`). Ensure `authGuard` is imported at the top: `import { authGuard } from './core/guards/auth.guard';`.

```ts
  {
    path: 'app/upgrade',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/billing/upgrade.component').then((m) => m.UpgradeComponent),
  },
  {
    path: 'app/settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/billing/settings.component').then((m) => m.SettingsComponent),
  },
```

> If `/app` is defined as a parent route with a `children:` array and a `<router-outlet>`, add these as children with relative paths `'upgrade'` / `'settings'` instead. Either placement resolves to `/app/upgrade` and `/app/settings`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/app/features/billing/upgrade.component.spec.ts src/app/features/billing/settings.component.spec.ts
```

Expected: both files pass — `UpgradeComponent › redirects to the checkout url returned by the API`, `UpgradeComponent › uses the exact premium CTA copy`, `SettingsComponent › redirects to the portal url returned by the API`. `Test Files 2 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/api/billing.api.ts \
        frontend/src/app/features/billing/upgrade.component.ts \
        frontend/src/app/features/billing/settings.component.ts \
        frontend/src/app/features/billing/upgrade.component.spec.ts \
        frontend/src/app/features/billing/settings.component.spec.ts \
        frontend/src/app/app.routes.ts
git commit -m "feat(billing): BillingApi + Upgrade/Settings redirect flows and routes"
```

---

### Task 7: UI plan gating + checkout return — slot-5 lock for FREE, reload after `?checkout=success`

**Files:**
- Modify: `frontend/src/app/features/dashboard/grid.component.ts` (inject `AuthStore`; add `isSlotLocked`; disable drag on locked slot 5)
- Modify: `frontend/src/app/features/dashboard/dashboard-page.component.ts` (react to `?checkout=success`; add `isSlotLocked` + guard the add/edit handler so slot 5 is not editable for FREE)
- Test: `frontend/src/app/features/dashboard/grid.gating.spec.ts`
- Test: `frontend/src/app/features/dashboard/dashboard-page.checkout.spec.ts`
- Test: `frontend/src/app/features/dashboard/dashboard-page.gating.spec.ts`

**Interfaces:**
- Consumes: `AuthStore.adFree` + `AuthStore.tier` + `AuthStore.loadMe()` (Plan 02); `DashboardStore.load()` + `DashboardStore.cells` (Plan 03); `GridComponent` (Plan 03); `DashboardPageComponent` (Plan 03); `ActivatedRoute` (`@angular/router`); `Cell` model (Plan 03).
- Produces:
  - `GridComponent.isSlotLocked(index: number): boolean` — `true` for slot 5 when the user is not ad-free (FREE tier). Bound to `[cdkDragDisabled]` so the ad slot cannot be **dragged**; the slot renders the ad placeholder (its `type` is `AD` for FREE per server invariant).
  - `DashboardPageComponent.isSlotLocked(slot: number): boolean` — `slot === 5 && authStore.tier() === 'FREE'`. The **add/edit** lock (preventing an app being added to / edited in the ad slot) lives here on the page — where the add/edit handler is wired — **not** in `GridComponent`. The page's add/edit handler early-returns via `if (this.isSlotLocked(slot)) { return; }` as its first line.
  - `DashboardPageComponent.handleCheckoutReturn(): void` — on `?checkout=success` calls `AuthStore.loadMe()` then `DashboardStore.load()`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/app/features/dashboard/grid.gating.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { GridComponent } from './grid.component';
import { DashboardStore } from '../../stores/dashboard.store';
import { AuthStore } from '../../stores/auth.store';
import type { Cell } from '../../core/models/dashboard.model';

function sixCells(): Cell[] {
  return Array.from({ length: 6 }, (_, slot) => ({
    slot,
    type: slot === 5 ? 'AD' : 'EMPTY',
    openMode: 'FRAME',
  })) as Cell[];
}

function dashboardStoreStub() {
  return {
    cells: signal(sixCells()),
    loaded: signal(true),
    saving: signal(false),
    error: signal(null),
    adSlotIndex: signal(5),
    filledCount: signal(0),
    load: () => {},
    swap: () => {},
    setCell: () => {},
    clearCell: () => {},
    persist: () => {},
  };
}

function createGrid(adFree: boolean) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: DashboardStore, useValue: dashboardStoreStub() },
      { provide: AuthStore, useValue: { adFree: signal(adFree), tier: signal(adFree ? 'PREMIUM' : 'FREE') } },
    ],
  });
  return TestBed.createComponent(GridComponent).componentInstance as unknown as {
    isSlotLocked: (i: number) => boolean;
  };
}

describe('GridComponent slot-5 gating', () => {
  it('locks slot 5 (and only slot 5) for FREE users', () => {
    const grid = createGrid(false);
    expect(grid.isSlotLocked(5)).toBe(true);
    expect(grid.isSlotLocked(0)).toBe(false);
    expect(grid.isSlotLocked(4)).toBe(false);
  });

  it('unlocks slot 5 for PREMIUM users', () => {
    const grid = createGrid(true);
    expect(grid.isSlotLocked(5)).toBe(false);
  });
});
```

Create `frontend/src/app/features/dashboard/dashboard-page.checkout.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { DashboardPageComponent } from './dashboard-page.component';
import { AuthStore } from '../../stores/auth.store';
import { DashboardStore } from '../../stores/dashboard.store';

function authStoreStub(loadMe: () => void) {
  return {
    user: signal(null),
    status: signal('authenticated'),
    error: signal(null),
    isAuthenticated: signal(true),
    tier: signal('FREE'),
    adFree: signal(false),
    loadMe,
    login: () => {},
    register: () => {},
    logout: () => {},
  };
}

function dashboardStoreStub(load: () => void) {
  return {
    cells: signal([]),
    loaded: signal(true),
    saving: signal(false),
    error: signal(null),
    adSlotIndex: signal(5),
    filledCount: signal(0),
    load,
    swap: () => {},
    setCell: () => {},
    clearCell: () => {},
    persist: () => {},
  };
}

function setup(checkout: string | null) {
  const loadMe = vi.fn();
  const load = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(checkout ? { checkout } : {}) } },
      },
      { provide: AuthStore, useValue: authStoreStub(loadMe) },
      { provide: DashboardStore, useValue: dashboardStoreStub(load) },
    ],
  });
  const component = TestBed.createComponent(DashboardPageComponent).componentInstance as unknown as {
    handleCheckoutReturn: () => void;
  };
  return { component, loadMe, load };
}

describe('DashboardPageComponent checkout return', () => {
  it('reloads auth then dashboard when checkout=success', () => {
    const { component, loadMe, load } = setup('success');
    component.handleCheckoutReturn();
    expect(loadMe).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not reload when no checkout param is present', () => {
    const { component, loadMe, load } = setup(null);
    component.handleCheckoutReturn();
    expect(loadMe).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });
});
```

Create `frontend/src/app/features/dashboard/dashboard-page.gating.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { DashboardPageComponent } from './dashboard-page.component';
import { AuthStore } from '../../stores/auth.store';
import { DashboardStore } from '../../stores/dashboard.store';

function authStoreStub(tier: 'FREE' | 'PREMIUM') {
  return {
    user: signal(null),
    status: signal('authenticated'),
    error: signal(null),
    isAuthenticated: signal(true),
    tier: signal(tier),
    adFree: signal(tier === 'PREMIUM'),
    loadMe: () => {},
    login: () => {},
    register: () => {},
    logout: () => {},
  };
}

function dashboardStoreStub() {
  return {
    cells: signal([]),
    loaded: signal(true),
    saving: signal(false),
    error: signal(null),
    adSlotIndex: signal(5),
    filledCount: signal(0),
    load: () => {},
    swap: () => {},
    setCell: () => {},
    clearCell: () => {},
    persist: () => {},
  };
}

function createPage(tier: 'FREE' | 'PREMIUM') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
      },
      { provide: AuthStore, useValue: authStoreStub(tier) },
      { provide: DashboardStore, useValue: dashboardStoreStub() },
    ],
  });
  return TestBed.createComponent(DashboardPageComponent).componentInstance as unknown as {
    isSlotLocked: (slot: number) => boolean;
    onCellEdit: (slot: number) => void;
    openCellEditor: (slot: number) => void;
  };
}

describe('DashboardPageComponent slot-5 edit lock', () => {
  it('locks slot 5 for FREE and short-circuits the add/edit handler', () => {
    const page = createPage('FREE');
    expect(page.isSlotLocked(5)).toBe(true);
    expect(page.isSlotLocked(0)).toBe(false);
    expect(page.isSlotLocked(4)).toBe(false);

    const open = vi.spyOn(page, 'openCellEditor').mockImplementation(() => {});
    page.onCellEdit(5);
    expect(open).not.toHaveBeenCalled(); // guard returns early for the FREE ad slot
    page.onCellEdit(0);
    expect(open).toHaveBeenCalledWith(0);
  });

  it('leaves slot 5 editable for PREMIUM', () => {
    const page = createPage('PREMIUM');
    expect(page.isSlotLocked(5)).toBe(false);

    const open = vi.spyOn(page, 'openCellEditor').mockImplementation(() => {});
    page.onCellEdit(5);
    expect(open).toHaveBeenCalledWith(5); // premium can add/edit the former ad slot
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/app/features/dashboard/grid.gating.spec.ts src/app/features/dashboard/dashboard-page.checkout.spec.ts src/app/features/dashboard/dashboard-page.gating.spec.ts
```

Expected: failure — `grid.isSlotLocked is not a function`, `component.handleCheckoutReturn is not a function`, and `page.isSlotLocked is not a function` / `page.onCellEdit is not a function` (the methods do not exist yet).

- [ ] **Step 3a: Add slot-5 gating to `GridComponent`**

In `frontend/src/app/features/dashboard/grid.component.ts`:

Add the `AuthStore` import near the other imports:

```ts
import { AuthStore } from '../../stores/auth.store';
```

Inside the `GridComponent` class, add the injected store (next to the existing `DashboardStore` injection) and the gating method:

```ts
  private readonly authStore = inject(AuthStore);

  /** Slot 5 is the fixed ad slot; it is locked (non-editable, non-draggable) unless the user is ad-free. */
  protected isSlotLocked(index: number): boolean {
    return index === 5 && !this.authStore.adFree();
  }
```

> Ensure `inject` is imported from `@angular/core` (it already is in Plan 03's grid). 

In the template, on the per-cell drag element (the element carrying `cdkDrag` inside the `@for` loop, where the loop exposes the index, e.g. `@for (cell of cells(); track cell.slot; let i = $index)`), add the drag-disable binding:

```html
        [cdkDragDisabled]="isSlotLocked(i)"
```

`GridComponent.isSlotLocked` here governs **dragging only** (`[cdkDragDisabled]`). The **add/edit** lock — preventing an app from being added to or edited in the ad slot — is enforced in `DashboardPageComponent`, where the add/edit handler is wired, in Step 3c below. Do not put the edit guard in `GridComponent`.

- [ ] **Step 3b: Add checkout-return handling to `DashboardPageComponent`**

In `frontend/src/app/features/dashboard/dashboard-page.component.ts`:

Add imports (skip any already present):

```ts
import { ActivatedRoute } from '@angular/router';
import { AuthStore } from '../../stores/auth.store';
```

Ensure the class implements `OnInit` (`import { OnInit } from '@angular/core';` and `export class DashboardPageComponent implements OnInit`). Inject the route and stores (skip any already injected) and add the handler + its call:

```ts
  private readonly route = inject(ActivatedRoute);
  private readonly authStore = inject(AuthStore);
  private readonly dashboardStore = inject(DashboardStore);

  ngOnInit(): void {
    this.handleCheckoutReturn();
  }

  /** After returning from Stripe Checkout (/app?checkout=success) refresh auth + dashboard so premium reflects. */
  private handleCheckoutReturn(): void {
    if (this.route.snapshot.queryParamMap.get('checkout') === 'success') {
      this.authStore.loadMe();
      this.dashboardStore.load();
    }
  }
```

> If `DashboardPageComponent` already injects `DashboardStore` or already implements `ngOnInit`, do not duplicate the field/method — instead add the single line `this.handleCheckoutReturn();` to the existing `ngOnInit` and add only the missing injections. `handleCheckoutReturn` must run before the page finishes its own initial `load()` so the reload reflects the just-completed upgrade.

- [ ] **Step 3c: Add the slot-5 edit lock to `DashboardPageComponent`**

The add/edit lock (as opposed to the grid's drag lock) lives on the page, because the page owns the add/edit handler that opens the add-URL / catalog dialog for a slot. Add the `isSlotLocked` predicate and guard the handler.

Still in `frontend/src/app/features/dashboard/dashboard-page.component.ts` (the `authStore` field was already injected in Step 3b), add:

```ts
  /**
   * Slot 5 is the fixed ad slot for FREE users; adding or editing an app there is not allowed
   * until the user is Premium. (adFree === (tier === 'PREMIUM'), so this is the same predicate.)
   */
  isSlotLocked(slot: number): boolean {
    return slot === 5 && this.authStore.tier() === 'FREE';
  }

  /**
   * Handler bound to the grid/cell `(edit)` output — fires for the EMPTY-cell "add" button and
   * the APP "edit" action, passing the target slot. Guarded so the FREE ad slot cannot be edited.
   */
  onCellEdit(slot: number): void {
    if (this.isSlotLocked(slot)) { return; }
    this.openCellEditor(slot);
  }

  /** Opens the add-URL / catalog dialog for a slot (Plan 03 wiring); a seam so tests can assert the guard. */
  protected openCellEditor(slot: number): void {
    // Plan 03 opens AddUrlDialogComponent / CatalogDialogComponent for `slot` here.
  }
```

If Plan 03's `DashboardPageComponent` already has an add/edit handler bound to the grid/cell `(edit)` output, do **not** add a second one — instead add `if (this.isSlotLocked(slot)) { return; }` as the **first line** of that existing handler and add only the `isSlotLocked` method. The template already routes `(edit)` from the grid to this handler; no template change is needed beyond that existing binding.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/app/features/dashboard/grid.gating.spec.ts src/app/features/dashboard/dashboard-page.checkout.spec.ts src/app/features/dashboard/dashboard-page.gating.spec.ts
```

Expected: all pass — `GridComponent slot-5 gating › locks slot 5 (and only slot 5) for FREE users`, `› unlocks slot 5 for PREMIUM users`, `DashboardPageComponent checkout return › reloads auth then dashboard when checkout=success`, `› does not reload when no checkout param is present`, `DashboardPageComponent slot-5 edit lock › locks slot 5 for FREE and short-circuits the add/edit handler`, `› leaves slot 5 editable for PREMIUM`.

- [ ] **Step 4b: Run the whole frontend suite to confirm no regressions in Plan-03 grid/page tests**

```bash
cd frontend && npx vitest run
```

Expected: `Test Files  ... passed` — the existing Plan-03 `grid.component.spec.ts` and `dashboard-page.component.spec.ts` remain green alongside the new billing specs.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/dashboard/grid.component.ts \
        frontend/src/app/features/dashboard/dashboard-page.component.ts \
        frontend/src/app/features/dashboard/grid.gating.spec.ts \
        frontend/src/app/features/dashboard/dashboard-page.checkout.spec.ts \
        frontend/src/app/features/dashboard/dashboard-page.gating.spec.ts
git commit -m "feat(billing): gate ad slot for FREE users and reload on checkout return"
```

---

## Definition of Done (Plan 05)

- [ ] Backend: `./gradlew test --tests "com.dashdash.billing.*"` is green; premium is set **only** by `SubscriptionService` fed by signature-verified webhooks; `stripe_events` has a 30-day TTL index; the webhook endpoint is permitAll + CSRF-exempt + raw-body.
- [ ] Frontend: `npx vitest run` is green; `UpgradeComponent` shows the exact copy **"Remove ad — go Premium"** and redirects to the Checkout URL; `SettingsComponent` redirects to the Billing Portal URL; slot 5 is locked for FREE and editable for PREMIUM — the drag lock is in `GridComponent`, the add/edit lock (`isSlotLocked` + guarded handler) is in `DashboardPageComponent`; `/app?checkout=success` triggers `AuthStore.loadMe()` + `DashboardStore.load()`.
- [ ] All seven task commits are present with Conventional-Commit messages.
- [ ] No client path sets `Tier.PREMIUM`; downgrade calls `DashboardService.reconcileForTier(dashboard, false)` and persists the **whole** returned `Dashboard` (including `parkedApp`, never just cells); disputes revoke premium.

### Consumed contract symbols (for reference)

`User`, `Subscription`, `Tier`, `SubStatus`, `UserRepository` (incl. `findBySubscriptionStripeCustomerId`), `DashPrincipal`, `Dashboard` + `Dashboard.defaultFor`, `DashboardService.reconcileForTier`, `DashboardStore.load`, `AuthStore.tier`/`adFree`/`loadMe`, `authGuard`, `ApiError`, `MongoIndexConfig`, `environment.apiBaseUrl`, DTO shapes `CheckoutSessionResponse`/`PortalSessionResponse`, `ProcessedStripeEvent`/`ProcessedStripeEventRepository`, service signatures for `StripeService`/`SubscriptionService`, REST paths under `/api/v1/billing`.







