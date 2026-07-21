# DashDash — Authentication Implementation Plan (Plan 02 of 06)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement first-party session auth (email/password + Google OIDC) with the `User` model and default `Dashboard`, plus the Angular `AuthStore`, login/register UI, route guard, and non-Chromium browser notice.

**Architecture:** Spring Security 7 runs a single stateful `SecurityFilterChain` backed by the custom MongoDB `SessionRepository` (Spring Session core) provided by Plan 01 (`SessionConfig` / `MongoSessionRepository`); JSON `/auth/*` endpoints authenticate through an `AuthenticationManager` + delegating bcrypt encoder and persist the `SecurityContext` via an `HttpSessionSecurityContextRepository`, while `oauth2Login()` upserts a `User` keyed on `googleSub`. The Angular side is a zoneless `@ngrx/signals` `AuthStore` fed by a thin `AuthApi`, Signal-Forms login/register components, and a `CanActivateFn` guard that redirects anonymous users to `/login`.

**Tech Stack:** Java 25 · Spring Boot 4.1 · Spring Security 7 · Spring Data MongoDB · the custom MongoDB `SessionRepository` (Spring Session core) from Plan 01 · JUnit 5 + Spring Boot Test + Testcontainers-Mongo + Mockito · Angular 22 (standalone, zoneless, signals, Signal Forms) · `@ngrx/signals` · Vitest.

**Depends on:** 01 (repo, Gradle build, `DashdashApplication`, `SecurityConfig`/`CorsConfig`/`MongoIndexConfig`/`SessionConfig` skeletons, `/health`, `ApiError`/`GlobalExceptionHandler`, Angular scaffold, `credentials.interceptor.ts`, `environment*.ts`, `app.config.ts`/`app.routes.ts`/`app.component.ts`).

## Global Constraints

See `2026-07-21-dashdash-00-shared-contract.md` (authoritative for names/types/signatures and global constraints). This plan additionally requires:

- All backend code lives under package `com.dashdash`; auth types in `com.dashdash.auth`, embedded model classes in `com.dashdash.dashboard`, config in `com.dashdash.config`.
- Passwords are hashed with `PasswordEncoderFactories.createDelegatingPasswordEncoder()` (stored form `{bcrypt}$2a$...`). Never store or log plaintext passwords.
- Session is **stateful**: `SessionCreationPolicy` is left at default (IF_REQUIRED); the `SecurityContext` is persisted through an explicit `SecurityContextRepository` (`HttpSessionSecurityContextRepository`) so `/auth/register` and `/auth/login` establish a cookie-backed session.
- Session cookie is `httpOnly` + `Secure` + `SameSite=Lax`, domain `.dashdash.app` in prod (owned/configured by Plan 01 `SessionConfig`/`application.yml`); this plan does not re-declare cookie attributes.
- CSRF is enabled globally (Plan 01 `SecurityConfig`) with `CookieCsrfTokenRepository.withHttpOnlyFalse()`; `permitAll` paths for this plan: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/password-reset/**`, `/oauth2/**`, `/login/oauth2/**`. `/api/v1/auth/logout` and `/api/v1/auth/me` require authentication. (CSRF still applies to the state-changing password-reset POSTs; `permitAll` only waives authentication, not CSRF.)
- MongoDB indexes are created explicitly at startup in `MongoIndexConfig` (auto-index-creation stays **off**); entities carry `@Id`/`@Document` only, not `@Indexed`.
- `UserDto.adFree == (tier == PREMIUM)`; premium is derived from `subscription.status ∈ {ACTIVE, TRIALING}` via `UserService.isPremium`, never a client flag.
- Google OIDC client id/secret come from env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`); scopes are `openid`, `email`, `profile`. On success Spring redirects to the UI `/app` route.
- Frontend: no JWT in `localStorage`; auth relies entirely on the session cookie sent by `credentials.interceptor.ts` (`withCredentials: true`). `AuthApi` uses `environment.apiBaseUrl`. The `AuthStore` is the single source of truth for `user`/`tier`/`adFree`/`isAuthenticated`; later plans consume its `tier` signal.
- `/login` and `/register` are **top-level** public routes; the guarded post-login placeholder route is `/app`, rendered here by a temporary `HomeComponent`. **Plan 03 replaces `HomeComponent` at `/app` with `DashboardPageComponent`** — there is **no** `/dashboard` frontend route (the backend REST endpoint `/api/v1/dashboard` is separate and owned by Plan 03). Plan 05 adds `/app/upgrade` + `/app/settings`. Post-login, post-register, and OIDC success all navigate to `/app`. The **Frontend route table** under "Canonical Resolutions v2" in `2026-07-21-dashdash-00-shared-contract.md` is the single source of truth for routes.
- Backend test command form: `./gradlew test --tests "<FQCN>"` (run from `backend/`). Frontend test command form: `npx vitest run <path>` (run from `frontend/`). Windows dev host: in native PowerShell use `.\gradlew.bat …`; the `./gradlew …` form runs in Git Bash and CI.

---
### Task 1: Domain model — enums, embedded `Dashboard`/`Cell`, `User`, `UserRepository`, indexes

**Files:**
- Create: `backend/src/main/java/com/dashdash/dashboard/CellType.java`
- Create: `backend/src/main/java/com/dashdash/dashboard/OpenMode.java`
- Create: `backend/src/main/java/com/dashdash/dashboard/Cell.java`
- Create: `backend/src/main/java/com/dashdash/dashboard/Dashboard.java`
- Create: `backend/src/main/java/com/dashdash/auth/Tier.java`
- Create: `backend/src/main/java/com/dashdash/auth/SubStatus.java`
- Create: `backend/src/main/java/com/dashdash/auth/Subscription.java`
- Create: `backend/src/main/java/com/dashdash/auth/User.java`
- Create: `backend/src/main/java/com/dashdash/auth/UserRepository.java`
- Modify: `backend/src/main/java/com/dashdash/config/MongoIndexConfig.java` (Plan 01 created this `@Configuration` with an `@EventListener(ApplicationReadyEvent) void ensureIndexes()`; add the user-index block)
- Test: `backend/src/test/java/com/dashdash/dashboard/DashboardDefaultForTest.java`
- Test: `backend/src/test/java/com/dashdash/auth/UserRepositoryTest.java`

**Interfaces:**
- Consumes: Plan 01 `MongoIndexConfig` (`@Configuration` holding a `MongoTemplate`, `ensureIndexes()` bound to `ApplicationReadyEvent`); Spring Data `MongoRepository`, `MongoTemplate`.
- Produces:
  - `enum CellType { APP, AD, EMPTY }`, `enum OpenMode { FRAME, WINDOW }` (owned by Plan 02, package `dashboard`; Plan 03 consumes)
  - `class Cell` fields `int slot; CellType type; String url; String title; String catalogAppId; String iconUrl; OpenMode openMode`
  - `class Dashboard { List<Cell> cells; Cell parkedApp; static Dashboard defaultFor(boolean premium); }` (`parkedApp` is null normally; it holds the displaced `APP` cell set on downgrade when no slot was free — see the shared contract "Downgrade park an app". `defaultFor` leaves `parkedApp` null. Plan 03 owns the frontend `dashboard.model.ts` mirror; this plan only defines the backend Java model.)
  - `enum Tier { FREE, PREMIUM }`, `enum SubStatus { NONE, ACTIVE, TRIALING, PAST_DUE, CANCELED }`
  - `class Subscription { Tier tier; String stripeCustomerId; String stripeSubscriptionId; SubStatus status; String priceId; Instant currentPeriodEnd; boolean cancelAtPeriodEnd; }`
  - `@Document("users") class User { String id; String email; String passwordHash; String googleSub; String displayName; boolean emailVerified; Instant createdAt; Dashboard dashboard; Subscription subscription; }`
  - `interface UserRepository extends MongoRepository<User,String>` with `findByEmail`, `findByGoogleSub`, `findBySubscriptionStripeCustomerId`, `findBySubscriptionStripeSubscriptionId`

- [ ] **Step 1: Write the failing test for `Dashboard.defaultFor`.** Create `backend/src/test/java/com/dashdash/dashboard/DashboardDefaultForTest.java`:

```java
package com.dashdash.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class DashboardDefaultForTest {

    @Test
    void freeTierReservesSlot5AsAdAndRestEmpty() {
        Dashboard d = Dashboard.defaultFor(false);
        List<Cell> cells = d.getCells();

        assertThat(cells).hasSize(6);
        for (int i = 0; i < 5; i++) {
            assertThat(cells.get(i).getSlot()).isEqualTo(i);
            assertThat(cells.get(i).getType()).isEqualTo(CellType.EMPTY);
        }
        assertThat(cells.get(5).getSlot()).isEqualTo(5);
        assertThat(cells.get(5).getType()).isEqualTo(CellType.AD);
        assertThat(cells).allSatisfy(c -> assertThat(c.getOpenMode()).isEqualTo(OpenMode.FRAME));
        assertThat(d.getParkedApp()).isNull();
    }

    @Test
    void premiumTierMakesAllSixEmpty() {
        Dashboard d = Dashboard.defaultFor(true);
        List<Cell> cells = d.getCells();

        assertThat(cells).hasSize(6);
        for (int i = 0; i < 6; i++) {
            assertThat(cells.get(i).getSlot()).isEqualTo(i);
            assertThat(cells.get(i).getType()).isEqualTo(CellType.EMPTY);
        }
        assertThat(d.getParkedApp()).isNull();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.dashboard.DashboardDefaultForTest"
```

Expected: **compilation failure** — `error: cannot find symbol` for `Dashboard`, `Cell`, `CellType`, `OpenMode` (the classes do not exist yet). BUILD FAILED.

- [ ] **Step 3: Create the dashboard enums and model classes.** Create `backend/src/main/java/com/dashdash/dashboard/CellType.java`:

```java
package com.dashdash.dashboard;

public enum CellType { APP, AD, EMPTY }
```

Create `backend/src/main/java/com/dashdash/dashboard/OpenMode.java`:

```java
package com.dashdash.dashboard;

public enum OpenMode { FRAME, WINDOW }
```

Create `backend/src/main/java/com/dashdash/dashboard/Cell.java`:

```java
package com.dashdash.dashboard;

public class Cell {

    private int slot;
    private CellType type;
    private String url;
    private String title;
    private String catalogAppId;
    private String iconUrl;
    private OpenMode openMode = OpenMode.FRAME;

    public Cell() {}

    public Cell(int slot, CellType type, OpenMode openMode) {
        this.slot = slot;
        this.type = type;
        this.openMode = openMode;
    }

    public int getSlot() { return slot; }
    public void setSlot(int slot) { this.slot = slot; }

    public CellType getType() { return type; }
    public void setType(CellType type) { this.type = type; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCatalogAppId() { return catalogAppId; }
    public void setCatalogAppId(String catalogAppId) { this.catalogAppId = catalogAppId; }

    public String getIconUrl() { return iconUrl; }
    public void setIconUrl(String iconUrl) { this.iconUrl = iconUrl; }

    public OpenMode getOpenMode() { return openMode; }
    public void setOpenMode(OpenMode openMode) { this.openMode = openMode; }
}
```

Create `backend/src/main/java/com/dashdash/dashboard/Dashboard.java`:

```java
package com.dashdash.dashboard;

import java.util.ArrayList;
import java.util.List;

public class Dashboard {

    private List<Cell> cells = new ArrayList<>();
    private Cell parkedApp;   // null normally; set to the displaced APP cell on downgrade when no slot was free

    public Dashboard() {}

    public Dashboard(List<Cell> cells) {
        this.cells = cells;
    }

    public List<Cell> getCells() { return cells; }
    public void setCells(List<Cell> cells) { this.cells = cells; }

    public Cell getParkedApp() { return parkedApp; }
    public void setParkedApp(Cell parkedApp) { this.parkedApp = parkedApp; }

    /**
     * Builds the canonical 6-cell dashboard (slots 0..5).
     * FREE (premium=false): slot 5 = AD, slots 0..4 = EMPTY.
     * PREMIUM (premium=true): all 6 cells EMPTY.
     */
    public static Dashboard defaultFor(boolean premium) {
        List<Cell> cells = new ArrayList<>(6);
        for (int slot = 0; slot < 6; slot++) {
            CellType type = (!premium && slot == 5) ? CellType.AD : CellType.EMPTY;
            cells.add(new Cell(slot, type, OpenMode.FRAME));
        }
        return new Dashboard(cells);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes.** From `backend/`:

```
./gradlew test --tests "com.dashdash.dashboard.DashboardDefaultForTest"
```

Expected: `BUILD SUCCESSFUL`, 2 tests passed (`freeTierReservesSlot5AsAdAndRestEmpty`, `premiumTierMakesAllSixEmpty`).

- [ ] **Step 5: Create the auth enums, `Subscription`, `User`, and `UserRepository`.** Create `backend/src/main/java/com/dashdash/auth/Tier.java`:

```java
package com.dashdash.auth;

public enum Tier { FREE, PREMIUM }
```

Create `backend/src/main/java/com/dashdash/auth/SubStatus.java`:

```java
package com.dashdash.auth;

public enum SubStatus { NONE, ACTIVE, TRIALING, PAST_DUE, CANCELED }
```

Create `backend/src/main/java/com/dashdash/auth/Subscription.java`:

```java
package com.dashdash.auth;

import java.time.Instant;

public class Subscription {

    private Tier tier = Tier.FREE;
    private String stripeCustomerId;
    private String stripeSubscriptionId;
    private SubStatus status = SubStatus.NONE;
    private String priceId;
    private Instant currentPeriodEnd;
    private boolean cancelAtPeriodEnd = false;

    public Tier getTier() { return tier; }
    public void setTier(Tier tier) { this.tier = tier; }

    public String getStripeCustomerId() { return stripeCustomerId; }
    public void setStripeCustomerId(String stripeCustomerId) { this.stripeCustomerId = stripeCustomerId; }

    public String getStripeSubscriptionId() { return stripeSubscriptionId; }
    public void setStripeSubscriptionId(String stripeSubscriptionId) { this.stripeSubscriptionId = stripeSubscriptionId; }

    public SubStatus getStatus() { return status; }
    public void setStatus(SubStatus status) { this.status = status; }

    public String getPriceId() { return priceId; }
    public void setPriceId(String priceId) { this.priceId = priceId; }

    public Instant getCurrentPeriodEnd() { return currentPeriodEnd; }
    public void setCurrentPeriodEnd(Instant currentPeriodEnd) { this.currentPeriodEnd = currentPeriodEnd; }

    public boolean isCancelAtPeriodEnd() { return cancelAtPeriodEnd; }
    public void setCancelAtPeriodEnd(boolean cancelAtPeriodEnd) { this.cancelAtPeriodEnd = cancelAtPeriodEnd; }
}
```

Create `backend/src/main/java/com/dashdash/auth/User.java`:

```java
package com.dashdash.auth;

import com.dashdash.dashboard.Dashboard;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("users")
public class User {

    @Id
    private String id;
    private String email;
    private String passwordHash;   // null for OAuth-only accounts
    private String googleSub;      // null for password-only accounts; sparse-unique
    private String displayName;
    private boolean emailVerified;
    private Instant createdAt;
    private Dashboard dashboard;        // embedded
    private Subscription subscription;  // embedded

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getGoogleSub() { return googleSub; }
    public void setGoogleSub(String googleSub) { this.googleSub = googleSub; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Dashboard getDashboard() { return dashboard; }
    public void setDashboard(Dashboard dashboard) { this.dashboard = dashboard; }

    public Subscription getSubscription() { return subscription; }
    public void setSubscription(Subscription subscription) { this.subscription = subscription; }
}
```

Create `backend/src/main/java/com/dashdash/auth/UserRepository.java`:

```java
package com.dashdash.auth;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByGoogleSub(String googleSub);
    Optional<User> findBySubscriptionStripeCustomerId(String stripeCustomerId);
    Optional<User> findBySubscriptionStripeSubscriptionId(String stripeSubscriptionId);
}
```

- [ ] **Step 6: Write the failing Testcontainers repository test.** Create `backend/src/test/java/com/dashdash/auth/UserRepositoryTest.java`:

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dashdash.dashboard.Dashboard;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@DataMongoTest
class UserRepositoryTest {

    @Container
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

    @DynamicPropertySource
    static void mongoProps(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired UserRepository users;
    @Autowired MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.getCollection("users").drop();
        mongoTemplate.indexOps(User.class)
                .ensureIndex(new Index().on("email", Sort.Direction.ASC).unique());
    }

    private User newUser(String email) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash("{bcrypt}$2a$10$0123456789012345678901uWZ0aBcDeFgHiJkLmNoPqRsTuVwXy");
        u.setDisplayName("Test User");
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setDashboard(Dashboard.defaultFor(false));
        u.setSubscription(new Subscription());
        return u;
    }

    @Test
    void findByEmailReturnsSavedUser() {
        users.save(newUser("alice@example.com"));

        assertThat(users.findByEmail("alice@example.com"))
                .isPresent()
                .get()
                .extracting(User::getDisplayName)
                .isEqualTo("Test User");
    }

    @Test
    void findByEmailIsEmptyWhenAbsent() {
        assertThat(users.findByEmail("nobody@example.com")).isEmpty();
    }

    @Test
    void uniqueEmailIndexRejectsDuplicate() {
        users.save(newUser("dupe@example.com"));

        assertThatThrownBy(() -> users.save(newUser("dupe@example.com")))
                .isInstanceOf(DuplicateKeyException.class);
    }
}
```

- [ ] **Step 7: Run the repository test to verify it passes.** From `backend/` (Docker must be running for Testcontainers):

```
./gradlew test --tests "com.dashdash.auth.UserRepositoryTest"
```

Expected: `BUILD SUCCESSFUL`, 3 tests passed. (First run pulls the `mongo:7` image.)

- [ ] **Step 8: Add the user indexes to `MongoIndexConfig`.** Plan 01 created `backend/src/main/java/com/dashdash/config/MongoIndexConfig.java` as a `@Configuration` holding a `MongoTemplate` field and an `@EventListener(ApplicationReadyEvent) public void ensureIndexes()`. Add the imports `com.dashdash.auth.User`, `org.springframework.data.domain.Sort`, and `org.springframework.data.mongodb.core.index.Index`, then add this method and call it from `ensureIndexes()`:

```java
    // --- users (Plan 02) ---
    private void ensureUserIndexes() {
        var ops = mongoTemplate.indexOps(User.class);
        ops.ensureIndex(new Index().on("email", Sort.Direction.ASC).unique());
        ops.ensureIndex(new Index().on("googleSub", Sort.Direction.ASC).unique().sparse());
        ops.ensureIndex(new Index()
                .on("subscription.stripeCustomerId", Sort.Direction.ASC).unique().sparse());
        ops.ensureIndex(new Index()
                .on("subscription.stripeSubscriptionId", Sort.Direction.ASC).unique().sparse());
    }
```

Inside `ensureIndexes()` add the line `ensureUserIndexes();` (alongside any calls Plan 01 already placed there). Verify the whole module still compiles:

```
./gradlew compileJava
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 9: Commit.**

```
git add backend/src/main/java/com/dashdash/dashboard backend/src/main/java/com/dashdash/auth backend/src/main/java/com/dashdash/config/MongoIndexConfig.java backend/src/test/java/com/dashdash/dashboard backend/src/test/java/com/dashdash/auth
git commit -m "feat(auth): add User model, embedded Dashboard/Cell, tier enums, and Mongo indexes"
```

---
### Task 2: Security principals — `DashPrincipal`, `DashUserDetails`, `DashUserDetailsService`, `PasswordEncoder`

**Files:**
- Create: `backend/src/main/java/com/dashdash/auth/DashPrincipal.java`
- Create: `backend/src/main/java/com/dashdash/auth/DashUserDetails.java`
- Create: `backend/src/main/java/com/dashdash/auth/DashUserDetailsService.java`
- Create: `backend/src/main/java/com/dashdash/config/PasswordConfig.java`
- Test: `backend/src/test/java/com/dashdash/auth/DashUserDetailsServiceTest.java`
- Test: `backend/src/test/java/com/dashdash/config/PasswordConfigTest.java`

**Interfaces:**
- Consumes: `User`, `UserRepository` (Task 1).
- Produces:
  - `interface DashPrincipal { String getUserId(); String getEmail(); }` (implemented here by `DashUserDetails`, later by `DashOidcUser` in Task 6; consumed by controllers via `@AuthenticationPrincipal DashPrincipal`)
  - `class DashUserDetails implements UserDetails, DashPrincipal` (`username == email`, single authority `ROLE_USER`, password = `passwordHash`)
  - `class DashUserDetailsService implements UserDetailsService` (`loadUserByUsername(email)`)
  - `@Bean PasswordEncoder passwordEncoder()` (delegating bcrypt encoder) in `config.PasswordConfig`

- [ ] **Step 1: Write the failing test for `DashUserDetailsService`.** Create `backend/src/test/java/com/dashdash/auth/DashUserDetailsServiceTest.java`:

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@ExtendWith(MockitoExtension.class)
class DashUserDetailsServiceTest {

    @Mock UserRepository users;
    @InjectMocks DashUserDetailsService service;

    private User sample() {
        User u = new User();
        u.setId("u1");
        u.setEmail("bob@example.com");
        u.setPasswordHash("{bcrypt}$2a$10$hash");
        u.setDisplayName("Bob");
        return u;
    }

    @Test
    void loadsUserByEmailAsUsername() {
        when(users.findByEmail("bob@example.com")).thenReturn(Optional.of(sample()));

        UserDetails details = service.loadUserByUsername("bob@example.com");

        assertThat(details.getUsername()).isEqualTo("bob@example.com");
        assertThat(details.getPassword()).isEqualTo("{bcrypt}$2a$10$hash");
        assertThat(details.getAuthorities())
                .containsExactly(new SimpleGrantedAuthority("ROLE_USER"));
        assertThat(details).isInstanceOf(DashPrincipal.class);
        assertThat(((DashPrincipal) details).getUserId()).isEqualTo("u1");
        assertThat(((DashPrincipal) details).getEmail()).isEqualTo("bob@example.com");
    }

    @Test
    void throwsWhenEmailUnknown() {
        when(users.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadUserByUsername("ghost@example.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.DashUserDetailsServiceTest"
```

Expected: **compilation failure** — `cannot find symbol: class DashUserDetailsService` / `class DashPrincipal`. BUILD FAILED.

- [ ] **Step 3: Create `DashPrincipal`, `DashUserDetails`, `DashUserDetailsService`.** Create `backend/src/main/java/com/dashdash/auth/DashPrincipal.java`:

```java
package com.dashdash.auth;

/** Common shape for the authenticated principal, whether password- or Google-backed. */
public interface DashPrincipal {
    String getUserId();
    String getEmail();
}
```

Create `backend/src/main/java/com/dashdash/auth/DashUserDetails.java`:

```java
package com.dashdash.auth;

import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class DashUserDetails implements UserDetails, DashPrincipal {

    private final String userId;
    private final String email;
    private final String passwordHash;

    public DashUserDetails(User user) {
        this.userId = user.getId();
        this.email = user.getEmail();
        this.passwordHash = user.getPasswordHash();
    }

    @Override public String getUserId() { return userId; }
    @Override public String getEmail() { return email; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override public String getPassword() { return passwordHash; }
    @Override public String getUsername() { return email; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
```

Create `backend/src/main/java/com/dashdash/auth/DashUserDetailsService.java`:

```java
package com.dashdash.auth;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class DashUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public DashUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return users.findByEmail(username)
                .map(DashUserDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException("No user with email " + username));
    }
}
```

- [ ] **Step 4: Run the test to verify it passes.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.DashUserDetailsServiceTest"
```

Expected: `BUILD SUCCESSFUL`, 2 tests passed.

- [ ] **Step 5: Write the failing test for the password encoder bean.** Create `backend/src/test/java/com/dashdash/config/PasswordConfigTest.java`:

```java
package com.dashdash.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordConfigTest {

    private final PasswordEncoder encoder = new PasswordConfig().passwordEncoder();

    @Test
    void encodesWithBcryptPrefixAndMatches() {
        String hash = encoder.encode("s3cret-pass");

        assertThat(hash).startsWith("{bcrypt}");
        assertThat(encoder.matches("s3cret-pass", hash)).isTrue();
        assertThat(encoder.matches("wrong", hash)).isFalse();
    }
}
```

- [ ] **Step 6: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.config.PasswordConfigTest"
```

Expected: **compilation failure** — `cannot find symbol: class PasswordConfig`. BUILD FAILED.

- [ ] **Step 7: Create the `PasswordConfig` bean.** Create `backend/src/main/java/com/dashdash/config/PasswordConfig.java`:

```java
package com.dashdash.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
```

- [ ] **Step 8: Run the test to verify it passes.** From `backend/`:

```
./gradlew test --tests "com.dashdash.config.PasswordConfigTest"
```

Expected: `BUILD SUCCESSFUL`, 1 test passed.

- [ ] **Step 9: Commit.**

```
git add backend/src/main/java/com/dashdash/auth/DashPrincipal.java backend/src/main/java/com/dashdash/auth/DashUserDetails.java backend/src/main/java/com/dashdash/auth/DashUserDetailsService.java backend/src/main/java/com/dashdash/config/PasswordConfig.java backend/src/test/java/com/dashdash/auth/DashUserDetailsServiceTest.java backend/src/test/java/com/dashdash/config/PasswordConfigTest.java
git commit -m "feat(auth): add DashPrincipal, UserDetails service, and delegating password encoder"
```

---
### Task 3: Registration — DTOs, `UserService`, `AuthController.register`

**Files:**
- Create: `backend/src/main/java/com/dashdash/auth/dto/RegisterRequest.java`
- Create: `backend/src/main/java/com/dashdash/auth/dto/UserDto.java`
- Create: `backend/src/main/java/com/dashdash/auth/EmailInUseException.java`
- Create: `backend/src/main/java/com/dashdash/auth/UserService.java`
- Create: `backend/src/main/java/com/dashdash/auth/AuthController.java`
- Test: `backend/src/test/java/com/dashdash/auth/UserServiceTest.java`
- Test: `backend/src/test/java/com/dashdash/auth/AuthControllerRegisterTest.java`

**Interfaces:**
- Consumes: `User`, `UserRepository`, `Subscription`, `Tier`, `SubStatus` (Task 1); `DashUserDetails` (Task 2); `PasswordEncoder` bean (Task 2); `com.dashdash.common.ApiError` (Plan 01); `Dashboard.defaultFor` (Task 1).
- Produces:
  - `record RegisterRequest(@Email String email, @NotBlank String password, @NotBlank String displayName)`
  - `record UserDto(String id, String email, String displayName, Tier tier, boolean adFree)`
  - `class EmailInUseException extends RuntimeException`
  - `class UserService` with `User register(RegisterRequest)`, `UserDto toDto(User)`, `boolean isPremium(User)`
  - `@RestController AuthController` mapping `POST /api/v1/auth/register` → `201 UserDto` + established session; `@ExceptionHandler(EmailInUseException)` → `409 ApiError("EMAIL_IN_USE", ...)`. Task 4/5 extend this same controller with `/login`, `/me`, `/logout`.

> Note: this task uses the Spring reference "programmatic login" pattern — `AuthController` owns a `new HttpSessionSecurityContextRepository()` field, so registration establishes a session **without** depending on Task 4's `SecurityConfig`. Task 4's filter chain uses a matching `HttpSessionSecurityContextRepository` (same `SPRING_SECURITY_CONTEXT` session key), so the session written here authenticates later requests. `spring-boot-starter-validation` must be on the classpath (Plan 01) for `@Valid` to enforce constraints.

- [ ] **Step 1: Write the failing `UserService` unit test.** Create `backend/src/test/java/com/dashdash/auth/UserServiceTest.java`:

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.auth.dto.UserDto;
import com.dashdash.dashboard.CellType;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository users;
    private final PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    private UserService service() {
        return new UserService(users, encoder);
    }

    @Test
    void registerHashesPasswordAndBuildsFreeDefaults() {
        when(users.findByEmail("jane@example.com")).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("generated-id");
            return u;
        });

        User u = service().register(new RegisterRequest("Jane@Example.com", "topsecret1", "Jane"));

        assertThat(u.getEmail()).isEqualTo("jane@example.com");
        assertThat(u.getDisplayName()).isEqualTo("Jane");
        assertThat(u.getPasswordHash()).startsWith("{bcrypt}");
        assertThat(encoder.matches("topsecret1", u.getPasswordHash())).isTrue();
        assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
        assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.NONE);
        assertThat(u.getDashboard().getCells()).hasSize(6);
        assertThat(u.getDashboard().getCells().get(5).getType()).isEqualTo(CellType.AD);
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(users.findByEmail("dupe@example.com")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() ->
                service().register(new RegisterRequest("dupe@example.com", "whatever1", "Dupe")))
                .isInstanceOf(EmailInUseException.class);
        verify(users, never()).save(any());
    }

    @Test
    void toDtoMapsActiveSubscriptionToPremiumAdFree() {
        User u = new User();
        u.setId("id1");
        u.setEmail("p@example.com");
        u.setDisplayName("Prem");
        Subscription sub = new Subscription();
        sub.setStatus(SubStatus.ACTIVE);
        u.setSubscription(sub);

        UserDto dto = service().toDto(u);

        assertThat(dto.tier()).isEqualTo(Tier.PREMIUM);
        assertThat(dto.adFree()).isTrue();
    }

    @Test
    void isPremiumTrueForActiveAndTrialingOnly() {
        assertThat(service().isPremium(userWith(SubStatus.ACTIVE))).isTrue();
        assertThat(service().isPremium(userWith(SubStatus.TRIALING))).isTrue();
        assertThat(service().isPremium(userWith(SubStatus.NONE))).isFalse();
        assertThat(service().isPremium(userWith(SubStatus.PAST_DUE))).isFalse();
        assertThat(service().isPremium(userWith(SubStatus.CANCELED))).isFalse();
    }

    private User userWith(SubStatus status) {
        User u = new User();
        Subscription s = new Subscription();
        s.setStatus(status);
        u.setSubscription(s);
        return u;
    }
}
```

- [ ] **Step 2: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.UserServiceTest"
```

Expected: **compilation failure** — `cannot find symbol: class UserService` / `RegisterRequest` / `UserDto` / `EmailInUseException`. BUILD FAILED.

- [ ] **Step 3: Create the DTOs, exception, and `UserService`.** Create `backend/src/main/java/com/dashdash/auth/dto/RegisterRequest.java`:

```java
package com.dashdash.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RegisterRequest(@Email String email, @NotBlank String password, @NotBlank String displayName) {}
```

Create `backend/src/main/java/com/dashdash/auth/dto/UserDto.java`:

```java
package com.dashdash.auth.dto;

import com.dashdash.auth.Tier;

public record UserDto(String id, String email, String displayName, Tier tier, boolean adFree) {}
```

Create `backend/src/main/java/com/dashdash/auth/EmailInUseException.java`:

```java
package com.dashdash.auth;

public class EmailInUseException extends RuntimeException {
    public EmailInUseException(String email) {
        super("Email already in use: " + email);
    }
}
```

Create `backend/src/main/java/com/dashdash/auth/UserService.java`:

```java
package com.dashdash.auth;

import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.auth.dto.UserDto;
import com.dashdash.dashboard.Dashboard;
import java.time.Instant;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        users.findByEmail(email).ifPresent(existing -> { throw new EmailInUseException(email); });

        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setDisplayName(req.displayName().trim());
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setSubscription(new Subscription());          // tier=FREE, status=NONE
        u.setDashboard(Dashboard.defaultFor(false));    // FREE default → slot 5 = AD
        return users.save(u);
    }

    public UserDto toDto(User user) {
        Tier tier = isPremium(user) ? Tier.PREMIUM : Tier.FREE;
        boolean adFree = tier == Tier.PREMIUM;
        return new UserDto(user.getId(), user.getEmail(), user.getDisplayName(), tier, adFree);
    }

    public boolean isPremium(User user) {
        Subscription sub = user.getSubscription();
        if (sub == null || sub.getStatus() == null) {
            return false;
        }
        return sub.getStatus() == SubStatus.ACTIVE || sub.getStatus() == SubStatus.TRIALING;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.UserServiceTest"
```

Expected: `BUILD SUCCESSFUL`, 4 tests passed.

- [ ] **Step 5: Write the failing registration integration test.** Create `backend/src/test/java/com/dashdash/auth/AuthControllerRegisterTest.java`:

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.dashboard.CellType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
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
        r.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
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
```

- [ ] **Step 6: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.AuthControllerRegisterTest"
```

Expected: **compilation failure** — `cannot find symbol: class AuthController`. BUILD FAILED.

- [ ] **Step 7: Create `AuthController`.** Create `backend/src/main/java/com/dashdash/auth/AuthController.java`:

```java
package com.dashdash.auth;

import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.auth.dto.UserDto;
import com.dashdash.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;

    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest req,
                                            HttpServletRequest request,
                                            HttpServletResponse response) {
        User user = userService.register(req);
        establishSession(user, request, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.toDto(user));
    }

    /** Persist an authenticated SecurityContext into the session (emits the SESSION cookie in a real container). */
    void establishSession(User user, HttpServletRequest request, HttpServletResponse response) {
        DashUserDetails principal = new DashUserDetails(user);
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities());
        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(auth);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    @ExceptionHandler(EmailInUseException.class)
    public ResponseEntity<ApiError> handleEmailInUse(EmailInUseException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("EMAIL_IN_USE", ex.getMessage()));
    }
}
```

- [ ] **Step 8: Run the test to verify it passes.** From `backend/` (Docker running):

```
./gradlew test --tests "com.dashdash.auth.AuthControllerRegisterTest"
```

Expected: `BUILD SUCCESSFUL`, 2 tests passed.

- [ ] **Step 9: Commit.**

```
git add backend/src/main/java/com/dashdash/auth/dto backend/src/main/java/com/dashdash/auth/EmailInUseException.java backend/src/main/java/com/dashdash/auth/UserService.java backend/src/main/java/com/dashdash/auth/AuthController.java backend/src/test/java/com/dashdash/auth/UserServiceTest.java backend/src/test/java/com/dashdash/auth/AuthControllerRegisterTest.java
git commit -m "feat(auth): registration endpoint with bcrypt hashing, FREE defaults, and session establishment"
```

---
### Task 4: JSON login — refine `SecurityConfig`, `AuthenticationManager`, `AuthController.login`

**Files:**
- Create: `backend/src/main/java/com/dashdash/auth/dto/LoginRequest.java`
- Modify: `backend/src/main/java/com/dashdash/config/SecurityConfig.java` (Plan 01 baseline → final stateful chain: disable form/basic login, explicit `HttpSessionSecurityContextRepository`, tighten `permitAll` matchers, add `AuthenticationManager` bean)
- Modify: `backend/src/main/java/com/dashdash/auth/AuthController.java` (add `login`, inject `AuthenticationManager`/`UserRepository`, add `AuthenticationException` handler)
- Test: `backend/src/test/java/com/dashdash/auth/AuthControllerLoginTest.java`

**Interfaces:**
- Consumes: `DashUserDetailsService` (Task 2, `@Service`), `PasswordEncoder` bean (Task 2), `UserService`/`UserRepository`/`User` (Tasks 1/3), `CorsConfigurationSource` + `CsrfCookieFilter` + `SpaCsrfTokenRequestHandler` (Plan 01), `com.dashdash.common.ApiError` (Plan 01).
- Produces:
  - `record LoginRequest(@Email String email, @NotBlank String password)`
  - `@Bean AuthenticationManager authenticationManager(...)` (derived from `DashUserDetailsService` + `PasswordEncoder`)
  - Final `SecurityFilterChain`: stateful session via `HttpSessionSecurityContextRepository`, form/basic login disabled, `permitAll` only for `/api/v1/health`, `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/catalog`, `/api/v1/billing/webhook`, `/oauth2/**`, `/login/oauth2/**`; everything else authenticated (401 entry point from Plan 01 baseline retained).
  - `POST /api/v1/auth/login` (`LoginRequest`) → `200 UserDto` + session cookie; bad creds → `401 ApiError("INVALID_CREDENTIALS", ...)`.

> Note: the login endpoint uses the same `HttpSessionSecurityContextRepository` + `SecurityContextHolderStrategy` fields introduced in Task 3, so registration and login write the `SecurityContext` under the identical `SPRING_SECURITY_CONTEXT` session key the filter chain reads on later requests.

- [ ] **Step 1: Create the `LoginRequest` DTO.** Create `backend/src/main/java/com/dashdash/auth/dto/LoginRequest.java`:

```java
package com.dashdash.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@Email String email, @NotBlank String password) {}
```

- [ ] **Step 2: Refine `SecurityConfig`.** Replace the entire contents of `backend/src/main/java/com/dashdash/config/SecurityConfig.java` (Plan 01 baseline) with the final stateful chain:

```java
package com.dashdash.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Final DashDash security filter chain (Plan 02 owns this; it replaces the
 * Plan 01 walking-skeleton baseline). Stateful session auth: the SecurityContext
 * is persisted through an HttpSessionSecurityContextRepository so JSON /auth/login
 * and /auth/register establish a cookie-backed session. Google OIDC login
 * (oauth2Login) is layered in by Plan 02 Task 6.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${dashdash.session.cookie-domain:}")
    private String cookieDomain;

    @Value("${dashdash.session.cookie-secure:false}")
    private boolean cookieSecure;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf
                .csrfTokenRepository(cookieCsrfTokenRepository())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                .ignoringRequestMatchers("/api/v1/billing/webhook"))
            .securityContext(sc -> sc
                .securityContextRepository(new HttpSessionSecurityContextRepository()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/health",
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/catalog",
                    "/api/v1/billing/webhook",
                    "/oauth2/**",
                    "/login/oauth2/**").permitAll()
                .anyRequest().authenticated())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Built from the AuthenticationConfiguration, which auto-wires a
     * DaoAuthenticationProvider around the DashUserDetailsService (@Service) and
     * the PasswordEncoder bean (config.PasswordConfig).
     */
    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    private CookieCsrfTokenRepository cookieCsrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(builder -> {
            builder.sameSite("Lax");
            builder.secure(cookieSecure);
            builder.path("/");
            if (StringUtils.hasText(cookieDomain)) {
                builder.domain(cookieDomain);
            }
        });
        return repository;
    }
}
```

- [ ] **Step 3: Extend `AuthController` with `login`.** Replace the entire contents of `backend/src/main/java/com/dashdash/auth/AuthController.java` with the version that adds login, injects `AuthenticationManager` + `UserRepository`, and maps authentication failures to 401:

```java
package com.dashdash.auth;

import com.dashdash.auth.dto.LoginRequest;
import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.auth.dto.UserDto;
import com.dashdash.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;
    private final UserRepository users;
    private final AuthenticationManager authenticationManager;

    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    public AuthController(UserService userService,
                          UserRepository users,
                          AuthenticationManager authenticationManager) {
        this.userService = userService;
        this.users = users;
        this.authenticationManager = authenticationManager;
    }

    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest req,
                                            HttpServletRequest request,
                                            HttpServletResponse response) {
        User user = userService.register(req);
        establishSession(new DashUserDetails(user), request, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.toDto(user));
    }

    @PostMapping("/login")
    public ResponseEntity<UserDto> login(@Valid @RequestBody LoginRequest req,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        String email = req.email().trim().toLowerCase();
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, req.password()));

        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(authentication);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        DashPrincipal principal = (DashPrincipal) authentication.getPrincipal();
        User user = users.findByEmail(principal.getEmail()).orElseThrow();
        return ResponseEntity.ok(userService.toDto(user));
    }

    /** Persist an authenticated SecurityContext into the session (emits the SESSION cookie in a real container). */
    void establishSession(DashUserDetails principal, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities());
        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(auth);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    @ExceptionHandler(EmailInUseException.class)
    public ResponseEntity<ApiError> handleEmailInUse(EmailInUseException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("EMAIL_IN_USE", ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleBadCredentials(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("INVALID_CREDENTIALS", "Invalid email or password"));
    }
}
```

- [ ] **Step 4: Write the failing login integration test.** Create `backend/src/test/java/com/dashdash/auth/AuthControllerLoginTest.java`:

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.auth.dto.LoginRequest;
import com.dashdash.dashboard.Dashboard;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc   // full security filter chain active
class AuthControllerLoginTest {

    @Container
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
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
        u.setEmail("carol@example.com");
        u.setPasswordHash(passwordEncoder.encode("correct-horse"));
        u.setDisplayName("Carol");
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setSubscription(new Subscription());        // FREE / NONE
        u.setDashboard(Dashboard.defaultFor(false));
        users.save(u);
    }

    @Test
    void loginWithGoodCredentialsReturns200AndAuthenticatesSubsequentRequests() throws Exception {
        LoginRequest body = new LoginRequest("Carol@Example.com", "correct-horse");

        MvcResult login = mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("carol@example.com"))
                .andExpect(jsonPath("$.displayName").value("Carol"))
                .andExpect(jsonPath("$.tier").value("FREE"))
                .andExpect(jsonPath("$.adFree").value(false))
                .andReturn();

        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        assertThat(session).isNotNull();
        assertThat(session.getAttribute("SPRING_SECURITY_CONTEXT")).isNotNull();

        // Reusing the session cookie authenticates the next request.
        MvcResult next = mvc.perform(get("/api/v1/health").session(session))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(next.getRequest().getUserPrincipal()).isNotNull();
        assertThat(next.getRequest().getUserPrincipal().getName()).isEqualTo("carol@example.com");
    }

    @Test
    void loginWithBadPasswordReturns401() throws Exception {
        LoginRequest body = new LoginRequest("carol@example.com", "wrong-password");

        mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void loginWithUnknownEmailReturns401() throws Exception {
        LoginRequest body = new LoginRequest("nobody@example.com", "whatever1");

        mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }
}
```

- [ ] **Step 5: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.AuthControllerLoginTest"
```

Expected: **compilation failure** on the first run before Steps 1–3 exist — `cannot find symbol: class LoginRequest` / the `AuthController` constructor / `login`. After Steps 1–3 compile, this red state is resolved by Step 6. BUILD FAILED.

- [ ] **Step 6: Run the test to verify it passes.** From `backend/` (Docker running):

```
./gradlew test --tests "com.dashdash.auth.AuthControllerLoginTest"
```

Expected: `BUILD SUCCESSFUL`, 3 tests passed — good creds return `200` with `tier=FREE` and authenticate the follow-up `/health` call; bad password and unknown email both return `401` with `code=INVALID_CREDENTIALS`.

- [ ] **Step 7: Run the previously-green tests to confirm no regression.** From `backend/` (the register test used `addFilters=false` and still passes; the login refinements to `SecurityConfig` and `AuthController` must not break it):

```
./gradlew test --tests "com.dashdash.auth.AuthControllerRegisterTest" --tests "com.dashdash.config.SecurityBaselineTest"
```

Expected: `BUILD SUCCESSFUL`. (`SecurityBaselineTest` from Plan 01 still passes: `/api/v1/dashboard` → 401, CORS preflight OK, `XSRF-TOKEN` cookie issued. The tightened matchers keep `/api/v1/health` public.)

- [ ] **Step 8: Commit.**

```
git add backend/src/main/java/com/dashdash/auth/dto/LoginRequest.java backend/src/main/java/com/dashdash/config/SecurityConfig.java backend/src/main/java/com/dashdash/auth/AuthController.java backend/src/test/java/com/dashdash/auth/AuthControllerLoginTest.java
git commit -m "feat(auth): JSON login with AuthenticationManager, stateful session, and 401 on bad creds"
```

---
### Task 5: Session endpoints — `GET /auth/me` and `POST /auth/logout`

**Files:**
- Modify: `backend/src/main/java/com/dashdash/auth/AuthController.java` (add `me` + `logout`)
- Test: `backend/src/test/java/com/dashdash/auth/AuthControllerSessionTest.java`

**Interfaces:**
- Consumes: `DashPrincipal` (Task 2), `UserRepository`/`UserService`/`User` (Tasks 1/3), the stateful filter chain (Task 4), `@AuthenticationPrincipal`, `SecurityContextLogoutHandler`.
- Produces:
  - `GET /api/v1/auth/me` → `200 UserDto` for the authenticated user; `401` when anonymous (enforced by the filter chain, `anyRequest().authenticated()`).
  - `POST /api/v1/auth/logout` → `204`, invalidating the HTTP session (spring-session expires the `DASHSESSION` cookie on commit) and clearing the `SecurityContext`.

- [ ] **Step 1: Add `me` and `logout` to `AuthController`.** Replace the entire contents of `backend/src/main/java/com/dashdash/auth/AuthController.java` with the version below (adds the two endpoints and their imports; register/login are unchanged):

```java
package com.dashdash.auth;

import com.dashdash.auth.dto.LoginRequest;
import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.auth.dto.UserDto;
import com.dashdash.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;
    private final UserRepository users;
    private final AuthenticationManager authenticationManager;

    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();
    private final SecurityContextLogoutHandler logoutHandler = new SecurityContextLogoutHandler();

    public AuthController(UserService userService,
                          UserRepository users,
                          AuthenticationManager authenticationManager) {
        this.userService = userService;
        this.users = users;
        this.authenticationManager = authenticationManager;
    }

    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest req,
                                            HttpServletRequest request,
                                            HttpServletResponse response) {
        User user = userService.register(req);
        establishSession(new DashUserDetails(user), request, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.toDto(user));
    }

    @PostMapping("/login")
    public ResponseEntity<UserDto> login(@Valid @RequestBody LoginRequest req,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        String email = req.email().trim().toLowerCase();
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, req.password()));

        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(authentication);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        DashPrincipal principal = (DashPrincipal) authentication.getPrincipal();
        User user = users.findByEmail(principal.getEmail()).orElseThrow();
        return ResponseEntity.ok(userService.toDto(user));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal DashPrincipal principal) {
        User user = users.findById(principal.getUserId()).orElseThrow();
        return ResponseEntity.ok(userService.toDto(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = securityContextHolderStrategy.getContext().getAuthentication();
        // invalidateHttpSession=true + clearAuthentication=true by default; spring-session
        // expires the DASHSESSION cookie when the session is invalidated.
        logoutHandler.logout(request, response, auth);
        return ResponseEntity.noContent().build();
    }

    /** Persist an authenticated SecurityContext into the session (emits the SESSION cookie in a real container). */
    void establishSession(DashUserDetails principal, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities());
        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(auth);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    @ExceptionHandler(EmailInUseException.class)
    public ResponseEntity<ApiError> handleEmailInUse(EmailInUseException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("EMAIL_IN_USE", ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleBadCredentials(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("INVALID_CREDENTIALS", "Invalid email or password"));
    }
}
```

- [ ] **Step 2: Write the failing session-endpoints integration test.** Create `backend/src/test/java/com/dashdash/auth/AuthControllerSessionTest.java`:

```java
package com.dashdash.auth;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.auth.dto.LoginRequest;
import com.dashdash.dashboard.Dashboard;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerSessionTest {

    @Container
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
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

    private MockHttpSession loginSession() throws Exception {
        var result = mvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginRequest("dave@example.com", "passphrase9"))))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    @Test
    void meReturnsUserDtoForAuthenticatedSession() throws Exception {
        MockHttpSession session = loginSession();

        mvc.perform(get("/api/v1/auth/me").session(session))
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
        MockHttpSession session = loginSession();

        mvc.perform(post("/api/v1/auth/logout").with(csrf()).session(session))
                .andExpect(status().isNoContent());

        // The old session is invalid → /me with it is anonymous → 401.
        mvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.AuthControllerSessionTest"
```

Expected: before Step 1 is applied, **compilation failure** (`me`/`logout` absent) or the `/auth/me` assertions fail. After Step 1, this is resolved by Step 4. BUILD FAILED at first.

- [ ] **Step 4: Run the test to verify it passes.** From `backend/` (Docker running):

```
./gradlew test --tests "com.dashdash.auth.AuthControllerSessionTest"
```

Expected: `BUILD SUCCESSFUL`, 3 tests passed — authenticated `/me` returns the `UserDto`, anonymous `/me` returns `401`, and `logout` returns `204` after which the reused session is anonymous.

- [ ] **Step 5: Commit.**

```
git add backend/src/main/java/com/dashdash/auth/AuthController.java backend/src/test/java/com/dashdash/auth/AuthControllerSessionTest.java
git commit -m "feat(auth): add GET /auth/me and POST /auth/logout session endpoints"
```

---
### Task 6: Google OIDC — `DashOidcUser`, `DashOidcUserService`, `oauth2Login`

**Files:**
- Modify: `backend/build.gradle.kts` (add `spring-boot-starter-oauth2-client`)
- Modify: `backend/src/main/resources/application.yml` (add `spring.security.oauth2.client` google registration/provider + `dashdash.oauth2.success-url`)
- Create: `backend/src/main/java/com/dashdash/auth/DashOidcUser.java`
- Create: `backend/src/main/java/com/dashdash/auth/DashOidcUserService.java`
- Modify: `backend/src/main/java/com/dashdash/config/SecurityConfig.java` (enable `oauth2Login` with the OIDC user service + success redirect to the UI `/app`)
- Test: `backend/src/test/java/com/dashdash/auth/DashOidcUserServiceTest.java`

**Interfaces:**
- Consumes: `UserRepository`/`User`/`Subscription` (Task 1), `Dashboard.defaultFor` (Task 1), `DashPrincipal` (Task 2), Spring Security OAuth2 `OidcUserService`/`OidcUser`/`OidcUserRequest`/`OidcIdToken`.
- Produces:
  - `class DashOidcUser implements OidcUser, DashPrincipal` (wraps the delegate `OidcUser`, exposes `getUserId()`/`getEmail()`).
  - `@Service class DashOidcUserService extends OidcUserService` — `loadUser` upserts a `User`: match by `googleSub`, else link an existing account by **verified** email, else create a new user with `Subscription` (FREE/NONE) + `Dashboard.defaultFor(false)`; returns a `DashOidcUser`.
  - `oauth2Login()` on the filter chain using `DashOidcUserService` and redirecting to the env-driven UI `/app` URL on success.

> The session principal for OIDC logins is a `DashOidcUser`, which implements `DashPrincipal` → `@AuthenticationPrincipal DashPrincipal` in `/auth/me` and Plan 03/05 controllers works identically for password and Google logins. To keep context startup offline (no OIDC discovery network call), the google **provider** endpoints are declared statically and no `issuer-uri` is set; client-id/secret default to non-empty dummies so a `ClientRegistrationRepository` always exists in tests.

- [ ] **Step 1: Add the OAuth2 client dependency.** In `backend/build.gradle.kts`, add to the `dependencies { … }` block (alongside the existing `spring-boot-starter-security` line):

```kotlin
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
```

- [ ] **Step 2: Add the Google OAuth2 config to `application.yml`.** In `backend/src/main/resources/application.yml`, add the `oauth2` block under the existing `spring:` node and the `oauth2` block under the existing `dashdash:` node:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID:dummy-client-id}
            client-secret: ${GOOGLE_CLIENT_SECRET:dummy-client-secret}
            scope:
              - openid
              - email
              - profile
        provider:
          google:
            authorization-uri: https://accounts.google.com/o/oauth2/v2/auth
            token-uri: https://oauth2.googleapis.com/token
            user-info-uri: https://openidconnect.googleapis.com/v1/userinfo
            user-info-authentication-method: header
            jwk-set-uri: https://www.googleapis.com/oauth2/v3/certs
            user-name-attribute: sub
```

and under `dashdash:`:

```yaml
dashdash:
  oauth2:
    success-url: ${OAUTH2_SUCCESS_URL:https://dashdash.app/app}
```

(In dev, set `OAUTH2_SUCCESS_URL=http://localhost:4200/app`. Endpoints are static → no discovery call at startup, so tests boot offline.)

- [ ] **Step 3: Write the failing `DashOidcUserService` unit test.** Create `backend/src/test/java/com/dashdash/auth/DashOidcUserServiceTest.java`:

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dashdash.dashboard.CellType;
import com.dashdash.dashboard.Dashboard;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.StandardClaimNames;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

@ExtendWith(MockitoExtension.class)
class DashOidcUserServiceTest {

    @Mock UserRepository users;

    /** A DashOidcUserService whose network delegate is replaced with a fixed OidcUser. */
    private DashOidcUserService serviceReturning(OidcUser delegate) {
        return new DashOidcUserService(users) {
            @Override
            protected OidcUser loadDelegate(OidcUserRequest userRequest) {
                return delegate;
            }
        };
    }

    private OidcUser googleUser(String sub, String email, boolean verified, String name) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(StandardClaimNames.SUB, sub);
        claims.put(StandardClaimNames.EMAIL, email);
        claims.put(StandardClaimNames.EMAIL_VERIFIED, verified);
        claims.put(StandardClaimNames.NAME, name);
        OidcIdToken idToken = new OidcIdToken(
                "token-value", Instant.now(), Instant.now().plusSeconds(3600), claims);
        return new DefaultOidcUser(List.of(), idToken);
    }

    @Test
    void firstLoginCreatesUserWithFreeDefaults() {
        when(users.findByGoogleSub("google-sub-1")).thenReturn(Optional.empty());
        when(users.findByEmail("erin@example.com")).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("new-id");
            return u;
        });

        OidcUser mocked = googleUser("google-sub-1", "Erin@Example.com", true, "Erin");
        OidcUser result = serviceReturning(mocked).loadUser(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        User u = saved.getValue();
        assertThat(u.getGoogleSub()).isEqualTo("google-sub-1");
        assertThat(u.getEmail()).isEqualTo("erin@example.com");
        assertThat(u.getDisplayName()).isEqualTo("Erin");
        assertThat(u.isEmailVerified()).isTrue();
        assertThat(u.getPasswordHash()).isNull();
        assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
        assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.NONE);
        assertThat(u.getDashboard().getCells()).hasSize(6);
        assertThat(u.getDashboard().getCells().get(5).getType()).isEqualTo(CellType.AD);

        assertThat(result).isInstanceOf(DashPrincipal.class);
        assertThat(((DashPrincipal) result).getUserId()).isEqualTo("new-id");
        assertThat(((DashPrincipal) result).getEmail()).isEqualTo("erin@example.com");
    }

    @Test
    void loginLinksExistingAccountByVerifiedEmail() {
        User existing = new User();
        existing.setId("existing-id");
        existing.setEmail("frank@example.com");
        existing.setPasswordHash("{bcrypt}$2a$10$hash");
        existing.setDisplayName("Frank");
        existing.setEmailVerified(false);
        existing.setSubscription(new Subscription());
        existing.setDashboard(Dashboard.defaultFor(false));

        when(users.findByGoogleSub("google-sub-2")).thenReturn(Optional.empty());
        when(users.findByEmail("frank@example.com")).thenReturn(Optional.of(existing));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        OidcUser mocked = googleUser("google-sub-2", "frank@example.com", true, "Frank G");
        OidcUser result = serviceReturning(mocked).loadUser(null);

        assertThat(existing.getGoogleSub()).isEqualTo("google-sub-2");
        assertThat(existing.isEmailVerified()).isTrue();
        assertThat(((DashPrincipal) result).getUserId()).isEqualTo("existing-id");
        verify(users).save(existing);
    }

    @Test
    void returningUserMatchedByGoogleSubIsNotDuplicated() {
        User existing = new User();
        existing.setId("sub-id");
        existing.setEmail("gwen@example.com");
        existing.setGoogleSub("google-sub-3");
        existing.setDisplayName("Gwen");
        existing.setEmailVerified(true);
        existing.setSubscription(new Subscription());
        existing.setDashboard(Dashboard.defaultFor(false));

        when(users.findByGoogleSub("google-sub-3")).thenReturn(Optional.of(existing));

        OidcUser mocked = googleUser("google-sub-3", "gwen@example.com", true, "Gwen");
        OidcUser result = serviceReturning(mocked).loadUser(null);

        assertThat(((DashPrincipal) result).getUserId()).isEqualTo("sub-id");
        verify(users, never()).save(any(User.class));
    }
}
```

- [ ] **Step 4: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.DashOidcUserServiceTest"
```

Expected: **compilation failure** — `cannot find symbol: class DashOidcUserService` / `class DashOidcUser`. BUILD FAILED.

- [ ] **Step 5: Create `DashOidcUser` and `DashOidcUserService`.** Create `backend/src/main/java/com/dashdash/auth/DashOidcUser.java`:

```java
package com.dashdash.auth;

import java.util.Collection;
import java.util.Map;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/** Wraps the Google-issued OidcUser and adds DashDash identity (userId/email). */
public class DashOidcUser implements OidcUser, DashPrincipal {

    private final OidcUser delegate;
    private final String userId;
    private final String email;

    public DashOidcUser(OidcUser delegate, String userId, String email) {
        this.delegate = delegate;
        this.userId = userId;
        this.email = email;
    }

    @Override public String getUserId() { return userId; }
    @Override public String getEmail() { return email; }

    @Override public Map<String, Object> getClaims() { return delegate.getClaims(); }
    @Override public OidcUserInfo getUserInfo() { return delegate.getUserInfo(); }
    @Override public OidcIdToken getIdToken() { return delegate.getIdToken(); }
    @Override public Map<String, Object> getAttributes() { return delegate.getAttributes(); }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return java.util.List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override public String getName() { return userId; }
}
```

Create `backend/src/main/java/com/dashdash/auth/DashOidcUserService.java`:

```java
package com.dashdash.auth;

import com.dashdash.dashboard.Dashboard;
import java.time.Instant;
import java.util.Optional;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

/**
 * Loads the Google OIDC user, then upserts a DashDash {@link User}:
 * match by googleSub → link an existing account by verified email → create new.
 * The returned principal is a {@link DashOidcUser} implementing {@link DashPrincipal}.
 */
@Service
public class DashOidcUserService extends OidcUserService {

    private final UserRepository users;

    public DashOidcUserService(UserRepository users) {
        this.users = users;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
        OidcUser oidcUser = loadDelegate(userRequest);
        User user = upsert(oidcUser);
        return new DashOidcUser(oidcUser, user.getId(), user.getEmail());
    }

    /** Seam for tests: delegates to the network-backed superclass in production. */
    protected OidcUser loadDelegate(OidcUserRequest userRequest) {
        return super.loadUser(userRequest);
    }

    private User upsert(OidcUser oidcUser) {
        String googleSub = oidcUser.getSubject();
        String email = oidcUser.getEmail() == null ? null : oidcUser.getEmail().trim().toLowerCase();
        boolean emailVerified = Boolean.TRUE.equals(oidcUser.getEmailVerified());
        String displayName = oidcUser.getFullName() != null ? oidcUser.getFullName() : email;

        Optional<User> bySub = users.findByGoogleSub(googleSub);
        if (bySub.isPresent()) {
            return bySub.get();
        }

        if (email != null && emailVerified) {
            Optional<User> byEmail = users.findByEmail(email);
            if (byEmail.isPresent()) {
                User existing = byEmail.get();
                existing.setGoogleSub(googleSub);
                existing.setEmailVerified(true);
                return users.save(existing);
            }
        }

        User created = new User();
        created.setEmail(email);
        created.setGoogleSub(googleSub);
        created.setDisplayName(displayName);
        created.setEmailVerified(emailVerified);
        created.setCreatedAt(Instant.now());
        created.setSubscription(new Subscription());          // FREE / NONE
        created.setDashboard(Dashboard.defaultFor(false));    // FREE default → slot 5 = AD
        return users.save(created);
    }
}
```

- [ ] **Step 6: Run the test to verify it passes.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.DashOidcUserServiceTest"
```

Expected: `BUILD SUCCESSFUL`, 3 tests passed (create, link-by-verified-email, match-by-googleSub).

- [ ] **Step 7: Enable `oauth2Login` in `SecurityConfig`.** Replace the entire contents of `backend/src/main/java/com/dashdash/config/SecurityConfig.java` with the version that wires the OIDC user service and the success redirect:

```java
package com.dashdash.config;

import com.dashdash.auth.DashOidcUserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Final DashDash security filter chain (Plan 02 owns this). Stateful session auth
 * (HttpSessionSecurityContextRepository) for JSON /auth/login + /auth/register,
 * plus Google OIDC via oauth2Login. On OIDC success the browser is redirected to
 * the UI /app route (env-driven, since UI and API are different origins).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${dashdash.session.cookie-domain:}")
    private String cookieDomain;

    @Value("${dashdash.session.cookie-secure:false}")
    private boolean cookieSecure;

    @Value("${dashdash.oauth2.success-url:https://dashdash.app/app}")
    private String oauth2SuccessUrl;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            CorsConfigurationSource corsConfigurationSource,
                                            DashOidcUserService oidcUserService) throws Exception {
        SimpleUrlAuthenticationSuccessHandler successHandler =
                new SimpleUrlAuthenticationSuccessHandler(oauth2SuccessUrl);
        successHandler.setAlwaysUseDefaultTargetUrl(true);

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf
                .csrfTokenRepository(cookieCsrfTokenRepository())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                .ignoringRequestMatchers("/api/v1/billing/webhook"))
            .securityContext(sc -> sc
                .securityContextRepository(new HttpSessionSecurityContextRepository()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/health",
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/catalog",
                    "/api/v1/billing/webhook",
                    "/oauth2/**",
                    "/login/oauth2/**").permitAll()
                .anyRequest().authenticated())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .oauth2Login(oauth -> oauth
                .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService))
                .successHandler(successHandler))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    private CookieCsrfTokenRepository cookieCsrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(builder -> {
            builder.sameSite("Lax");
            builder.secure(cookieSecure);
            builder.path("/");
            if (StringUtils.hasText(cookieDomain)) {
                builder.domain(cookieDomain);
            }
        });
        return repository;
    }
}
```

- [ ] **Step 8: Verify the whole context still boots with OIDC enabled.** From `backend/` (Docker running) run the auth + config suites — the previously-green login/session/register/security-baseline tests must still pass now that `oauth2Login` is active and a dummy Google `ClientRegistrationRepository` is present:

```
./gradlew test --tests "com.dashdash.auth.*" --tests "com.dashdash.config.*"
```

Expected: `BUILD SUCCESSFUL` — all auth tests (`UserRepositoryTest`, `DashUserDetailsServiceTest`, `UserServiceTest`, `AuthControllerRegisterTest`, `AuthControllerLoginTest`, `AuthControllerSessionTest`, `DashOidcUserServiceTest`) and config tests (`PasswordConfigTest`, `SecurityBaselineTest`) pass. The static provider endpoints mean no network discovery at startup.

- [ ] **Step 9: Commit.**

```
git add backend/build.gradle.kts backend/src/main/resources/application.yml backend/src/main/java/com/dashdash/auth/DashOidcUser.java backend/src/main/java/com/dashdash/auth/DashOidcUserService.java backend/src/main/java/com/dashdash/config/SecurityConfig.java backend/src/test/java/com/dashdash/auth/DashOidcUserServiceTest.java
git commit -m "feat(auth): Google OIDC login with user upsert and UI success redirect"
```

---
### Task 7: Frontend auth — models, `AuthApi`, `AuthStore`, `authGuard`, login/register UI, routes

**Files:**
- Modify: `frontend/package.json` (add `@ngrx/signals` dependency via `npm install`)
- Create: `frontend/src/app/core/models/enums.ts`
- Create: `frontend/src/app/core/models/user.model.ts`
- Create: `frontend/src/app/core/api/auth.api.ts`
- Create: `frontend/src/app/stores/auth.store.ts`
- Create: `frontend/src/app/core/guards/auth.guard.ts`
- Create: `frontend/src/app/features/auth/login.component.ts`
- Create: `frontend/src/app/features/auth/register.component.ts`
- Create: `frontend/src/app/features/home/home.component.ts` (guarded `/app` placeholder; **Plan 03 replaces it at `/app` with `DashboardPageComponent`** — there is no `/dashboard` route)
- Modify: `frontend/src/app/app.routes.ts` (add `/login`, `/register`, guarded `/app`)
- Modify: `frontend/src/app/app.component.ts` (call `AuthStore.loadMe()` on init)
- Test: `frontend/src/app/stores/auth.store.spec.ts`
- Test: `frontend/src/app/core/guards/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `environment.apiBaseUrl` (Plan 01), `credentialsInterceptor` (Plan 01, adds `withCredentials`), `RouterOutlet`/`Router`/`CanActivateFn` (Angular), Signal Forms (`@angular/forms/signals`, Angular 22 experimental), `@ngrx/signals`.
- Produces:
  - `enums.ts`: `type Tier = 'FREE'|'PREMIUM'` (+ `CellType`/`OpenMode`/`Compatibility` type aliases mirroring the contract).
  - `user.model.ts`: `interface User { id; email; displayName; tier: Tier; adFree }`, `interface Credentials { email; password }`, `interface RegisterPayload { email; password; displayName }`.
  - `AuthApi` (`register`/`login`/`logout`/`me`) at `core/api/auth.api.ts`.
  - `AuthStore` (`@ngrx/signals` root SignalStore): state `user`/`status`/`error`; computed `isAuthenticated`/`tier`/`adFree`; methods `loadMe`/`login`/`register`/`logout`. **Plan 05 consumes `AuthStore.tier`; Plan 03/05 consume `authGuard`.**
  - `authGuard` (`CanActivateFn`) at `core/guards/auth.guard.ts`.
  - `LoginComponent`, `RegisterComponent`, `HomeComponent`; routes `/login`, `/register`, `/app` (guarded).

- [ ] **Step 1: Install `@ngrx/signals`.** From `frontend/` (use the release line matching Angular 22; `@latest` is fine if the pinned version does not resolve):

```
cd frontend
npm install @ngrx/signals
```

- [ ] **Step 2: Create the shared models.** Create `frontend/src/app/core/models/enums.ts`:

```ts
export type CellType = 'APP' | 'AD' | 'EMPTY';
export type OpenMode = 'FRAME' | 'WINDOW';
export type Tier = 'FREE' | 'PREMIUM';
export type Compatibility = 'FRAMES_CLEAN' | 'NEEDS_EXTENSION' | 'LOGIN_IN_TAB' | 'REFUSES_FRAME';
```

Create `frontend/src/app/core/models/user.model.ts`:

```ts
import { Tier } from './enums';

export interface User {
  id: string;
  email: string;
  displayName: string;
  tier: Tier;
  adFree: boolean;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}
```

- [ ] **Step 3: Create `AuthApi`.** Create `frontend/src/app/core/api/auth.api.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Credentials, RegisterPayload, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  register(body: RegisterPayload): Observable<User> {
    return this.http.post<User>(`${this.base}/auth/register`, body);
  }

  login(body: Credentials): Observable<User> {
    return this.http.post<User>(`${this.base}/auth/login`, body);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {});
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.base}/auth/me`);
  }
}
```

- [ ] **Step 4: Write the failing `AuthStore` test.** Create `frontend/src/app/stores/auth.store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthStore } from './auth.store';
import { environment } from '../../environments/environment';

describe('AuthStore', () => {
  let store: ReturnType<typeof TestBed.inject<typeof AuthStore>>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts idle and anonymous', () => {
    expect(store.status()).toBe('idle');
    expect(store.isAuthenticated()).toBe(false);
    expect(store.tier()).toBe('FREE');
    expect(store.adFree()).toBe(false);
  });

  it('login success populates the user and marks authenticated', () => {
    store.login({ email: 'a@b.com', password: 'secret123' });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: '1', email: 'a@b.com', displayName: 'A', tier: 'PREMIUM', adFree: true });

    expect(store.isAuthenticated()).toBe(true);
    expect(store.status()).toBe('authenticated');
    expect(store.tier()).toBe('PREMIUM');
    expect(store.adFree()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('login failure sets error status and stays anonymous', () => {
    store.login({ email: 'a@b.com', password: 'wrong' });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    req.flush(
      { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(store.isAuthenticated()).toBe(false);
    expect(store.status()).toBe('error');
    expect(store.error()).toBe('Invalid email or password');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails.** From `frontend/`:

```
npx vitest run src/app/stores/auth.store.spec.ts
```

Expected: failure — `Failed to resolve import "./auth.store"` (the store does not exist yet).

- [ ] **Step 6: Create `AuthStore`.** Create `frontend/src/app/stores/auth.store.ts`:

```ts
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, pipe, switchMap, tap } from 'rxjs';
import { AuthApi } from '../core/api/auth.api';
import { Tier } from '../core/models/enums';
import { Credentials, RegisterPayload, User } from '../core/models/user.model';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
}

const initialState: AuthState = { user: null, status: 'idle', error: null };

function messageFrom(err: unknown): string {
  const e = err as { error?: { message?: string } };
  return e?.error?.message ?? 'Something went wrong. Please try again.';
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({
    isAuthenticated: computed(() => user() !== null),
    tier: computed<Tier>(() => user()?.tier ?? 'FREE'),
    adFree: computed(() => user()?.adFree ?? false),
  })),
  withMethods((store, api = inject(AuthApi)) => ({
    loadMe: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(() =>
          api.me().pipe(
            tap((user) => patchState(store, { user, status: 'authenticated' })),
            catchError(() => {
              patchState(store, { user: null, status: 'anonymous' });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
    login: rxMethod<Credentials>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap((cred) =>
          api.login(cred).pipe(
            tap((user) => patchState(store, { user, status: 'authenticated', error: null })),
            catchError((err) => {
              patchState(store, { user: null, status: 'error', error: messageFrom(err) });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
    register: rxMethod<RegisterPayload>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap((payload) =>
          api.register(payload).pipe(
            tap((user) => patchState(store, { user, status: 'authenticated', error: null })),
            catchError((err) => {
              patchState(store, { user: null, status: 'error', error: messageFrom(err) });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
    logout: rxMethod<void>(
      pipe(
        switchMap(() =>
          api.logout().pipe(
            tap(() => patchState(store, { user: null, status: 'anonymous', error: null })),
            catchError(() => {
              patchState(store, { user: null, status: 'anonymous' });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
  })),
);
```

- [ ] **Step 7: Run the test to verify it passes.** From `frontend/`:

```
npx vitest run src/app/stores/auth.store.spec.ts
```

Expected: `Test Files 1 passed (1)`, `Tests 3 passed (3)` — idle default, login success → `authenticated`/`tier=PREMIUM`, login 401 → `status=error`/`error='Invalid email or password'`.

- [ ] **Step 8: Write the failing `authGuard` test.** Create `frontend/src/app/core/guards/auth.guard.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '../../stores/auth.store';

function runGuard(isAuthenticated: boolean) {
  const urlTree = {} as UrlTree;
  const router = { createUrlTree: vi.fn(() => urlTree) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: { isAuthenticated: signal(isAuthenticated) } },
      { provide: Router, useValue: router },
    ],
  });
  const result = TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return { result, router, urlTree };
}

describe('authGuard', () => {
  it('allows navigation when authenticated', () => {
    const { result } = runGuard(true);
    expect(result).toBe(true);
  });

  it('redirects to /login when anonymous', () => {
    const { result, router, urlTree } = runGuard(false);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(urlTree);
  });
});
```

- [ ] **Step 9: Run the test to verify it fails.** From `frontend/`:

```
npx vitest run src/app/core/guards/auth.guard.spec.ts
```

Expected: failure — `Failed to resolve import "./auth.guard"`.

- [ ] **Step 10: Create `authGuard`.** Create `frontend/src/app/core/guards/auth.guard.ts`:

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../stores/auth.store';

/**
 * Allows navigation only for authenticated users; otherwise redirects to /login.
 * AppComponent calls AuthStore.loadMe() at bootstrap, so the store is populated
 * before guarded navigations occur after the initial app load.
 */
export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
```

- [ ] **Step 11: Run the test to verify it passes.** From `frontend/`:

```
npx vitest run src/app/core/guards/auth.guard.spec.ts
```

Expected: `Tests 2 passed (2)` — allows when authenticated, returns the `/login` `UrlTree` when anonymous.

- [ ] **Step 12: Create the login and register components (Signal Forms).** Create `frontend/src/app/features/auth/login.component.ts` (Signal Forms is the Angular 22 experimental API at `@angular/forms/signals`):

```ts
import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Control, email, form, required } from '@angular/forms/signals';
import { AuthStore } from '../../stores/auth.store';

@Component({
  selector: 'app-login',
  imports: [Control],
  template: `
    <main class="auth" style="max-width: 24rem; margin: 3rem auto; font-family: system-ui, sans-serif;">
      <h1>Log in to DashDash</h1>
      <form (submit)="$event.preventDefault(); submit()">
        <label>Email
          <input type="email" autocomplete="email" [control]="loginForm.email" />
        </label>
        <label>Password
          <input type="password" autocomplete="current-password" [control]="loginForm.password" />
        </label>
        @if (store.status() === 'error') {
          <p class="error" role="alert">{{ store.error() }}</p>
        }
        <button type="submit" [disabled]="store.status() === 'loading'">Log in</button>
      </form>
      <p><a routerLink="/register" href="/register">Create an account</a></p>
    </main>
  `,
})
export class LoginComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly model = signal({ email: '', password: '' });
  readonly loginForm = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
  });

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });
  }

  submit(): void {
    if (this.loginForm().valid()) {
      this.store.login(this.model());
    }
  }
}
```

Create `frontend/src/app/features/auth/register.component.ts`:

```ts
import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Control, email, form, minLength, required } from '@angular/forms/signals';
import { AuthStore } from '../../stores/auth.store';

@Component({
  selector: 'app-register',
  imports: [Control],
  template: `
    <main class="auth" style="max-width: 24rem; margin: 3rem auto; font-family: system-ui, sans-serif;">
      <h1>Create your DashDash account</h1>
      <form (submit)="$event.preventDefault(); submit()">
        <label>Display name
          <input type="text" autocomplete="name" [control]="registerForm.displayName" />
        </label>
        <label>Email
          <input type="email" autocomplete="email" [control]="registerForm.email" />
        </label>
        <label>Password
          <input type="password" autocomplete="new-password" [control]="registerForm.password" />
        </label>
        @if (store.status() === 'error') {
          <p class="error" role="alert">{{ store.error() }}</p>
        }
        <button type="submit" [disabled]="store.status() === 'loading'">Sign up</button>
      </form>
      <p><a routerLink="/login" href="/login">Already have an account? Log in</a></p>
    </main>
  `,
})
export class RegisterComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly model = signal({ email: '', password: '', displayName: '' });
  readonly registerForm = form(this.model, (p) => {
    required(p.displayName);
    required(p.email);
    email(p.email);
    required(p.password);
    minLength(p.password, 8);
  });

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });
  }

  submit(): void {
    if (this.registerForm().valid()) {
      this.store.register(this.model());
    }
  }
}
```

- [ ] **Step 13: Create the guarded `/app` placeholder.** Create `frontend/src/app/features/home/home.component.ts`:

```ts
import { Component } from '@angular/core';

/** Placeholder for the authenticated area at /app. Plan 03 replaces this component
 *  at /app with DashboardPageComponent (there is no /dashboard route);
 *  Plan 05 adds /app/upgrade + /app/settings. See the shared-contract route table. */
@Component({
  selector: 'app-home',
  template: `
    <main style="padding: 2rem; font-family: system-ui, sans-serif;">
      <h1>DashDash</h1>
      <p>You are signed in. Your dashboard will load here.</p>
    </main>
  `,
})
export class HomeComponent {}
```

- [ ] **Step 14: Register the auth routes.** Overwrite `frontend/src/app/app.routes.ts`:

```ts
import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { HomeComponent } from './features/home/home.component';
import { authGuard } from './core/guards/auth.guard';

// Route table is authoritative in the shared contract (Canonical Resolutions v2 -> Frontend route table):
// /login + /register are top-level public; /app is guarded (HomeComponent now, DashboardPageComponent in Plan 03).
export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'app', component: HomeComponent, canActivate: [authGuard] },
  // Plan 03 replaces HomeComponent at /app with DashboardPageComponent (no /dashboard route);
  // Plan 05 adds app/upgrade + app/settings; Plan 06 owns the marketing site + final /.
];
```

- [ ] **Step 15: Call `loadMe()` at app init.** Overwrite `frontend/src/app/app.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from './stores/auth.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  private readonly authStore = inject(AuthStore);

  constructor() {
    // Restore the session (if the cookie is present) before guarded navigation.
    this.authStore.loadMe();
  }
}
```

- [ ] **Step 16: Run the auth suite + production build to confirm everything compiles.** From `frontend/`:

```
npx vitest run src/app/stores/auth.store.spec.ts src/app/core/guards/auth.guard.spec.ts
npx ng build --configuration production
```

Expected: `Tests 5 passed (5)` across the two spec files, then `Application bundle generation complete`. (The build compiles `LoginComponent`/`RegisterComponent`/`HomeComponent` and the updated routes/app component.)

- [ ] **Step 17: Commit.**

```
git add frontend/package.json frontend/package-lock.json frontend/src/app/core/models frontend/src/app/core/api/auth.api.ts frontend/src/app/stores/auth.store.ts frontend/src/app/stores/auth.store.spec.ts frontend/src/app/core/guards frontend/src/app/features/auth frontend/src/app/features/home frontend/src/app/app.routes.ts frontend/src/app/app.component.ts
git commit -m "feat(frontend): AuthStore, AuthApi, auth guard, login/register UI, and session bootstrap"
```

---
### Task 8: Frontend browser gate + "Continue with Google" button

**Files:**
- Create: `frontend/src/app/core/services/browser-detect.service.ts`
- Modify: `frontend/src/app/features/auth/login.component.ts` (add the Google button + `googleAuthUrl` helper)
- Modify: `frontend/src/app/app.component.ts` (dismissible non-Chromium notice banner)
- Test: `frontend/src/app/core/services/browser-detect.service.spec.ts`
- Test: `frontend/src/app/features/auth/login.google.spec.ts`

**Interfaces:**
- Consumes: `environment.apiBaseUrl` (Plan 01), `AuthStore` (Task 7), `BrowserDetectService`.
- Produces:
  - `BrowserDetectService` with `isChromium(): boolean` (prefers `navigator.userAgentData.brands`, falls back to a UA regex).
  - `export function googleAuthUrl(apiBaseUrl: string): string` → `apiBaseUrl.replace('/api/v1','') + '/oauth2/authorization/google'`; bound to the login page's "Continue with Google" anchor.
  - A dismissible banner in `AppComponent` shown only to non-Chromium browsers.

- [ ] **Step 1: Write the failing `BrowserDetectService` test.** Create `frontend/src/app/core/services/browser-detect.service.spec.ts`:

```ts
import { BrowserDetectService } from './browser-detect.service';

describe('BrowserDetectService', () => {
  const service = new BrowserDetectService();

  const uaDesc = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
  const dataDesc = Object.getOwnPropertyDescriptor(window.navigator, 'userAgentData');

  function setEnv(ua: string, brands?: Array<{ brand: string }>): void {
    Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
    Object.defineProperty(window.navigator, 'userAgentData', {
      value: brands ? { brands } : undefined,
      configurable: true,
    });
  }

  afterEach(() => {
    if (uaDesc) Object.defineProperty(window.navigator, 'userAgent', uaDesc);
    if (dataDesc) {
      Object.defineProperty(window.navigator, 'userAgentData', dataDesc);
    } else {
      Object.defineProperty(window.navigator, 'userAgentData', { value: undefined, configurable: true });
    }
  });

  it('returns true for Chrome via userAgentData brands', () => {
    setEnv('irrelevant', [{ brand: 'Chromium' }, { brand: 'Google Chrome' }, { brand: 'Not:A-Brand' }]);
    expect(service.isChromium()).toBe(true);
  });

  it('returns true for a Chrome user-agent string (no userAgentData)', () => {
    setEnv(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    );
    expect(service.isChromium()).toBe(true);
  });

  it('returns false for Firefox', () => {
    setEnv('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0');
    expect(service.isChromium()).toBe(false);
  });

  it('returns false for Safari', () => {
    setEnv(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );
    expect(service.isChromium()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.** From `frontend/`:

```
npx vitest run src/app/core/services/browser-detect.service.spec.ts
```

Expected: failure — `Failed to resolve import "./browser-detect.service"`.

- [ ] **Step 3: Create `BrowserDetectService`.** Create `frontend/src/app/core/services/browser-detect.service.ts`:

```ts
import { Injectable } from '@angular/core';

/** Detects whether the current browser is Chromium-based (Chrome/Edge/Chromium). */
@Injectable({ providedIn: 'root' })
export class BrowserDetectService {
  isChromium(): boolean {
    const nav = globalThis.navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand: string }> };
    };
    const brands = nav?.userAgentData?.brands;
    if (brands && brands.length > 0) {
      return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
    }
    const ua = nav?.userAgent ?? '';
    // Firefox/Safari user-agents do not contain "Chrome"/"Chromium".
    return /Chrom(e|ium)/i.test(ua);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes.** From `frontend/`:

```
npx vitest run src/app/core/services/browser-detect.service.spec.ts
```

Expected: `Tests 4 passed (4)` — Chrome (brands + UA) → true, Firefox/Safari → false.

- [ ] **Step 5: Write the failing `googleAuthUrl` test.** Create `frontend/src/app/features/auth/login.google.spec.ts`:

```ts
import { googleAuthUrl } from './login.component';
import { environment } from '../../../environments/environment';

describe('googleAuthUrl', () => {
  it('strips /api/v1 and targets the Spring OAuth2 authorization endpoint', () => {
    expect(googleAuthUrl('http://localhost:8080/api/v1')).toBe(
      'http://localhost:8080/oauth2/authorization/google',
    );
    expect(googleAuthUrl('https://api.dashdash.app/api/v1')).toBe(
      'https://api.dashdash.app/oauth2/authorization/google',
    );
  });

  it('derives a valid URL from the configured environment base', () => {
    const url = googleAuthUrl(environment.apiBaseUrl);
    expect(url).toContain('/oauth2/authorization/google');
    expect(url).not.toContain('/api/v1');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails.** From `frontend/`:

```
npx vitest run src/app/features/auth/login.google.spec.ts
```

Expected: failure — `googleAuthUrl` is not exported from `./login.component` yet (`"googleAuthUrl" is not exported`).

- [ ] **Step 7: Add the Google button + `googleAuthUrl` to `LoginComponent`.** Overwrite `frontend/src/app/features/auth/login.component.ts`:

```ts
import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Control, email, form, required } from '@angular/forms/signals';
import { AuthStore } from '../../stores/auth.store';
import { environment } from '../../../environments/environment';

/** Builds the Spring-managed Google OAuth2 authorization URL from the API base URL
 *  (a full-page navigation to the API origin, which 302-redirects to Google). */
export function googleAuthUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace('/api/v1', '') + '/oauth2/authorization/google';
}

@Component({
  selector: 'app-login',
  imports: [Control],
  template: `
    <main class="auth" style="max-width: 24rem; margin: 3rem auto; font-family: system-ui, sans-serif;">
      <h1>Log in to DashDash</h1>
      <form (submit)="$event.preventDefault(); submit()">
        <label>Email
          <input type="email" autocomplete="email" [control]="loginForm.email" />
        </label>
        <label>Password
          <input type="password" autocomplete="current-password" [control]="loginForm.password" />
        </label>
        @if (store.status() === 'error') {
          <p class="error" role="alert">{{ store.error() }}</p>
        }
        <button type="submit" [disabled]="store.status() === 'loading'">Log in</button>
      </form>
      <a class="google-btn" [href]="googleAuthUrl">Continue with Google</a>
      <p><a routerLink="/register" href="/register">Create an account</a></p>
    </main>
  `,
})
export class LoginComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly googleAuthUrl = googleAuthUrl(environment.apiBaseUrl);

  readonly model = signal({ email: '', password: '' });
  readonly loginForm = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
  });

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });
  }

  submit(): void {
    if (this.loginForm().valid()) {
      this.store.login(this.model());
    }
  }
}
```

- [ ] **Step 8: Run the test to verify it passes.** From `frontend/`:

```
npx vitest run src/app/features/auth/login.google.spec.ts
```

Expected: `Tests 2 passed (2)` — the helper strips `/api/v1` and appends `/oauth2/authorization/google` for both dev and prod bases.

- [ ] **Step 9: Add the dismissible non-Chromium banner to `AppComponent`.** Overwrite `frontend/src/app/app.component.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from './stores/auth.store';
import { BrowserDetectService } from './core/services/browser-detect.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (showBanner()) {
      <div
        class="browser-notice"
        role="status"
        style="display:flex; gap:1rem; align-items:center; justify-content:space-between; padding:.75rem 1rem; background:#fff3cd; color:#664d03; font-family: system-ui, sans-serif;">
        <span>DashDash works best in Chrome or a Chromium-based browser. Some features may be limited here.</span>
        <button type="button" aria-label="Dismiss notice" (click)="dismiss()">Dismiss</button>
      </div>
    }
    <router-outlet />
  `,
})
export class AppComponent {
  private readonly authStore = inject(AuthStore);
  private readonly browser = inject(BrowserDetectService);

  private readonly dismissed = signal(false);
  readonly showBanner = computed(() => !this.browser.isChromium() && !this.dismissed());

  constructor() {
    // Restore the session (if the cookie is present) before guarded navigation.
    this.authStore.loadMe();
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}
```

- [ ] **Step 10: Run the full frontend suite + production build.** From `frontend/`:

```
npx vitest run
npx ng build --configuration production
```

Expected: all spec files pass (Plan 01 health/interceptor specs + this plan's `auth.store`, `auth.guard`, `browser-detect.service`, `login.google` specs), then `Application bundle generation complete`.

- [ ] **Step 11: Commit.**

```
git add frontend/src/app/core/services/browser-detect.service.ts frontend/src/app/core/services/browser-detect.service.spec.ts frontend/src/app/features/auth/login.component.ts frontend/src/app/features/auth/login.google.spec.ts frontend/src/app/app.component.ts
git commit -m "feat(frontend): non-Chromium notice banner and Continue with Google button"
```

---
### Task 9: Password reset — `PasswordResetToken`, `EmailSender`, `PasswordResetService`, reset endpoints

**Files:**
- Create: `backend/src/main/java/com/dashdash/auth/PasswordResetToken.java`
- Create: `backend/src/main/java/com/dashdash/auth/PasswordResetTokenRepository.java`
- Create: `backend/src/main/java/com/dashdash/auth/EmailSender.java`
- Create: `backend/src/main/java/com/dashdash/auth/LoggingEmailSender.java`
- Create: `backend/src/main/java/com/dashdash/auth/InvalidResetTokenException.java`
- Create: `backend/src/main/java/com/dashdash/auth/PasswordResetService.java`
- Create: `backend/src/main/java/com/dashdash/auth/dto/PasswordResetRequest.java`
- Create: `backend/src/main/java/com/dashdash/auth/dto/PasswordResetConfirm.java`
- Modify: `backend/src/main/java/com/dashdash/auth/UserService.java` (add `updatePassword(User, String)`)
- Modify: `backend/src/main/java/com/dashdash/config/MongoIndexConfig.java` (add the TTL index on `password_reset_tokens.expiresAt`)
- Modify: `backend/src/main/java/com/dashdash/auth/AuthController.java` (add the two reset endpoints + `InvalidResetTokenException` handler)
- Modify: `backend/src/main/java/com/dashdash/config/SecurityConfig.java` (add `permitAll` for `/api/v1/auth/password-reset/**`)
- Test: `backend/src/test/java/com/dashdash/auth/PasswordResetServiceTest.java`
- Test: `backend/src/test/java/com/dashdash/auth/AuthControllerPasswordResetTest.java`

**Interfaces:**
- Consumes: `User`/`UserRepository` (Task 1), `UserService` (Task 3, extended here with `updatePassword`), `PasswordEncoder` bean (Task 2), `com.dashdash.common.ApiError` (Plan 01), the final `SecurityFilterChain` (Task 6), Plan 01 `MongoIndexConfig`.
- Produces:
  - `@Document("password_reset_tokens") class PasswordResetToken { @Id String id; String userId; String tokenHash; Instant expiresAt; }` + a TTL index on `expiresAt` in `MongoIndexConfig`.
  - `interface PasswordResetTokenRepository extends MongoRepository<PasswordResetToken,String>` with `Optional<PasswordResetToken> findByTokenHash(String)`.
  - `interface EmailSender { void send(String to, String subject, String body); }` + dev `@Component LoggingEmailSender` (logs the reset link; the prod SMTP/SES impl is a config-only bean swap, out of scope for v1 — $0 in dev).
  - `class PasswordResetService` with `void requestReset(String email)` (silent for unknown emails — no account enumeration) and `void confirmReset(String token, String newPassword)` (throws `InvalidResetTokenException` on unknown/expired token).
  - `record PasswordResetRequest(@Email String email)`, `record PasswordResetConfirm(@NotBlank String token, @NotBlank String newPassword)`.
  - `UserService.updatePassword(User user, String rawPassword)` — re-hash with the delegating bcrypt encoder and persist.
  - `POST /api/v1/auth/password-reset/request` (`{email}` → **204 always**) and `POST /api/v1/auth/password-reset/confirm` (`{token,newPassword}` → **204**, **400 `INVALID_RESET_TOKEN`** on invalid/expired) on `AuthController`; `permitAll` for `/api/v1/auth/password-reset/**`.

> Tokens are random **256-bit**, transmitted only in the emailed link, and stored **only** as a **SHA-256 hash**; they are **single-use** (deleted on successful confirm) with a **30-minute** expiry. The TTL index reaps expired rows, but `confirmReset` also rejects expired tokens explicitly (the TTL monitor is not instantaneous). The reset link points at the UI (`dashdash.ui.base-url`, default `https://dashdash.app`; dev sets `http://localhost:4200`); its confirm page is a later-plan UI concern — this task ships the backend flow.

- [ ] **Step 1: Write the failing `PasswordResetService` unit test.** Create `backend/src/test/java/com/dashdash/auth/PasswordResetServiceTest.java`:

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock UserRepository users;
    @Mock PasswordResetTokenRepository tokens;
    @Mock UserService userService;
    @Mock EmailSender emailSender;

    private PasswordResetService service() {
        return new PasswordResetService(users, tokens, userService, emailSender, "https://dashdash.app");
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void requestForKnownEmailStoresHashedTokenAndEmailsLink() {
        User user = new User();
        user.setId("u9");
        user.setEmail("real@example.com");
        when(users.findByEmail("real@example.com")).thenReturn(Optional.of(user));

        service().requestReset("Real@Example.com");   // case/space-insensitive lookup

        ArgumentCaptor<PasswordResetToken> saved = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokens).save(saved.capture());
        PasswordResetToken t = saved.getValue();
        assertThat(t.getUserId()).isEqualTo("u9");
        assertThat(t.getTokenHash()).hasSize(64);                 // SHA-256 hex is 64 chars
        assertThat(t.getExpiresAt()).isAfter(Instant.now());

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailSender).send(eq("real@example.com"), anyString(), body.capture());
        assertThat(body.getValue()).contains("https://dashdash.app/reset-password?token=");
    }

    @Test
    void requestForUnknownEmailIsSilentNoTokenNoEmail() {
        when(users.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        service().requestReset("Ghost@Example.com");   // must behave identically to a hit

        verify(tokens, never()).save(any());
        verify(emailSender, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void confirmWithValidTokenUpdatesPasswordAndDeletesToken() {
        String rawToken = "raw-token-value";
        PasswordResetToken entity = new PasswordResetToken();
        entity.setId("t1");
        entity.setUserId("u1");
        entity.setTokenHash(sha256Hex(rawToken));
        entity.setExpiresAt(Instant.now().plusSeconds(600));
        User user = new User();
        user.setId("u1");
        user.setEmail("h@example.com");

        when(tokens.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(entity));
        when(users.findById("u1")).thenReturn(Optional.of(user));

        service().confirmReset(rawToken, "brand-new-pass");

        verify(userService).updatePassword(user, "brand-new-pass");
        verify(tokens).delete(entity);   // single-use
    }

    @Test
    void confirmWithExpiredTokenIsRejectedAndDoesNotChangePassword() {
        String rawToken = "expired-token";
        PasswordResetToken entity = new PasswordResetToken();
        entity.setId("t2");
        entity.setUserId("u2");
        entity.setTokenHash(sha256Hex(rawToken));
        entity.setExpiresAt(Instant.now().minusSeconds(60));

        when(tokens.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service().confirmReset(rawToken, "whatever-pass"))
                .isInstanceOf(InvalidResetTokenException.class);
        verify(userService, never()).updatePassword(any(), anyString());
        verify(tokens, never()).delete(any());   // TTL index reaps expired rows
    }

    @Test
    void confirmWithUnknownTokenIsRejected() {
        when(tokens.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().confirmReset("nope", "whatever-pass"))
                .isInstanceOf(InvalidResetTokenException.class);
        verify(userService, never()).updatePassword(any(), anyString());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.PasswordResetServiceTest"
```

Expected: **compilation failure** — `cannot find symbol` for `PasswordResetService`, `PasswordResetToken`, `PasswordResetTokenRepository`, `EmailSender`, `InvalidResetTokenException`, and `UserService.updatePassword`. BUILD FAILED.

- [ ] **Step 3: Create the token document, repository, email sender, exception, DTOs, and service; extend `UserService`.** Create `backend/src/main/java/com/dashdash/auth/PasswordResetToken.java`:

```java
package com.dashdash.auth;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("password_reset_tokens")
public class PasswordResetToken {

    @Id
    private String id;
    private String userId;
    private String tokenHash;   // SHA-256 hex of the raw token; the raw token is never stored
    private Instant expiresAt;  // TTL-indexed in MongoIndexConfig

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}
```

Create `backend/src/main/java/com/dashdash/auth/PasswordResetTokenRepository.java`:

```java
package com.dashdash.auth;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PasswordResetTokenRepository extends MongoRepository<PasswordResetToken, String> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);
}
```

Create `backend/src/main/java/com/dashdash/auth/EmailSender.java`:

```java
package com.dashdash.auth;

/** Transactional email seam. Dev uses LoggingEmailSender; prod swaps in an SMTP/SES bean. */
public interface EmailSender {
    void send(String to, String subject, String body);
}
```

Create `backend/src/main/java/com/dashdash/auth/LoggingEmailSender.java`:

```java
package com.dashdash.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Dev EmailSender: logs the message (including the reset link) instead of sending it. */
@Component
public class LoggingEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("[email] to={} subject=\"{}\" body=\"{}\"", to, subject, body);
    }
}
```

Create `backend/src/main/java/com/dashdash/auth/InvalidResetTokenException.java`:

```java
package com.dashdash.auth;

public class InvalidResetTokenException extends RuntimeException {
    public InvalidResetTokenException() {
        super("Invalid or expired password reset token");
    }
}
```

Create `backend/src/main/java/com/dashdash/auth/dto/PasswordResetRequest.java`:

```java
package com.dashdash.auth.dto;

import jakarta.validation.constraints.Email;

public record PasswordResetRequest(@Email String email) {}
```

Create `backend/src/main/java/com/dashdash/auth/dto/PasswordResetConfirm.java`:

```java
package com.dashdash.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordResetConfirm(@NotBlank String token, @NotBlank String newPassword) {}
```

Create `backend/src/main/java/com/dashdash/auth/PasswordResetService.java`:

```java
package com.dashdash.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Password-reset flow. Requesting is silent for unknown emails (no account
 * enumeration). Tokens are random 256-bit values, emailed once, stored only as a
 * SHA-256 hash, single-use, and valid for 30 minutes.
 */
@Service
public class PasswordResetService {

    private static final Duration TOKEN_TTL = Duration.ofMinutes(30);

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final UserService userService;
    private final EmailSender emailSender;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String uiBaseUrl;

    public PasswordResetService(UserRepository users,
                                PasswordResetTokenRepository tokens,
                                UserService userService,
                                EmailSender emailSender,
                                @Value("${dashdash.ui.base-url:https://dashdash.app}") String uiBaseUrl) {
        this.users = users;
        this.tokens = tokens;
        this.userService = userService;
        this.emailSender = emailSender;
        this.uiBaseUrl = uiBaseUrl;
    }

    /** Always returns normally so the endpoint responds identically whether or not the email exists. */
    public void requestReset(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        Optional<User> maybeUser = users.findByEmail(email);
        if (maybeUser.isEmpty()) {
            return;   // silent: no token issued, no email sent
        }
        User user = maybeUser.get();

        byte[] raw = new byte[32];   // 256 bits
        secureRandom.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        PasswordResetToken entity = new PasswordResetToken();
        entity.setUserId(user.getId());
        entity.setTokenHash(sha256(token));
        entity.setExpiresAt(Instant.now().plus(TOKEN_TTL));
        tokens.save(entity);

        String link = uiBaseUrl + "/reset-password?token=" + token;
        emailSender.send(user.getEmail(),
                "Reset your DashDash password",
                "Use this link to reset your password (valid 30 minutes): " + link);
    }

    /** @throws InvalidResetTokenException if the token is unknown, expired, or already used. */
    public void confirmReset(String presentedToken, String newPassword) {
        String hash = sha256(presentedToken == null ? "" : presentedToken);
        PasswordResetToken entity = tokens.findByTokenHash(hash)
                .orElseThrow(InvalidResetTokenException::new);
        if (entity.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidResetTokenException();   // TTL index will reap the row
        }
        User user = users.findById(entity.getUserId())
                .orElseThrow(InvalidResetTokenException::new);
        userService.updatePassword(user, newPassword);
        tokens.delete(entity);   // single-use
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

Extend `UserService` — add this method (and no new imports are needed; `PasswordEncoder`/`User` are already in scope) alongside `register`/`toDto`/`isPremium` in `backend/src/main/java/com/dashdash/auth/UserService.java`:

```java
    /** Re-hash a new password with the delegating bcrypt encoder and persist. */
    public void updatePassword(User user, String rawPassword) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        users.save(user);
    }
```

- [ ] **Step 4: Run the unit test to verify it passes.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.PasswordResetServiceTest"
```

Expected: `BUILD SUCCESSFUL`, 5 tests passed — known-email stores a 64-char hash + emails the link, unknown-email is silent, valid confirm updates the password and deletes the token, expired and unknown tokens are rejected without touching the password.

- [ ] **Step 5: Add the TTL index to `MongoIndexConfig`.** In `backend/src/main/java/com/dashdash/config/MongoIndexConfig.java` add the import `com.dashdash.auth.PasswordResetToken`, add the method below, and call `ensurePasswordResetTokenIndexes();` from `ensureIndexes()` (alongside `ensureUserIndexes();`):

```java
    // --- password reset tokens (Plan 02 Task 9) ---
    private void ensurePasswordResetTokenIndexes() {
        // TTL index: expireAfterSeconds=0 on a date field makes each token expire
        // exactly at its `expiresAt` instant (Mongo's TTL monitor sweeps ~every 60s).
        mongoTemplate.indexOps(PasswordResetToken.class)
                .ensureIndex(new Index().on("expiresAt", Sort.Direction.ASC)
                        .expire(java.time.Duration.ZERO));
    }
```

Verify the module still compiles:

```
./gradlew compileJava
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Write the failing password-reset integration test.** Create `backend/src/test/java/com/dashdash/auth/AuthControllerPasswordResetTest.java` (the full security chain is active, so state-changing POSTs carry `csrf()`; `EmailSender` is replaced by a Mockito bean so the emailed link — and thus the raw token — can be captured):

```java
package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.auth.dto.PasswordResetConfirm;
import com.dashdash.auth.dto.PasswordResetRequest;
import com.dashdash.dashboard.Dashboard;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
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
        r.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
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
```

- [ ] **Step 7: Run the test to verify it fails.** From `backend/`:

```
./gradlew test --tests "com.dashdash.auth.AuthControllerPasswordResetTest"
```

Expected: **BUILD FAILED** — the two `/password-reset/**` endpoints are not mapped yet and not permitted (the anonymous request is rejected by the entry point / no handler), so `status().isNoContent()` fails. Step 8 wires the controller + security matcher.

- [ ] **Step 8: Add the reset endpoints to `AuthController` and permit the paths in `SecurityConfig`.** Replace the entire contents of `backend/src/main/java/com/dashdash/auth/AuthController.java` with the version below (register/login/me/logout are unchanged; it injects `PasswordResetService`, adds the two endpoints, and maps `InvalidResetTokenException` → `400`):

```java
package com.dashdash.auth;

import com.dashdash.auth.dto.LoginRequest;
import com.dashdash.auth.dto.PasswordResetConfirm;
import com.dashdash.auth.dto.PasswordResetRequest;
import com.dashdash.auth.dto.RegisterRequest;
import com.dashdash.auth.dto.UserDto;
import com.dashdash.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;
    private final UserRepository users;
    private final AuthenticationManager authenticationManager;
    private final PasswordResetService passwordResetService;

    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();
    private final SecurityContextLogoutHandler logoutHandler = new SecurityContextLogoutHandler();

    public AuthController(UserService userService,
                          UserRepository users,
                          AuthenticationManager authenticationManager,
                          PasswordResetService passwordResetService) {
        this.userService = userService;
        this.users = users;
        this.authenticationManager = authenticationManager;
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest req,
                                            HttpServletRequest request,
                                            HttpServletResponse response) {
        User user = userService.register(req);
        establishSession(new DashUserDetails(user), request, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.toDto(user));
    }

    @PostMapping("/login")
    public ResponseEntity<UserDto> login(@Valid @RequestBody LoginRequest req,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        String email = req.email().trim().toLowerCase();
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, req.password()));

        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(authentication);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        DashPrincipal principal = (DashPrincipal) authentication.getPrincipal();
        User user = users.findByEmail(principal.getEmail()).orElseThrow();
        return ResponseEntity.ok(userService.toDto(user));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal DashPrincipal principal) {
        User user = users.findById(principal.getUserId()).orElseThrow();
        return ResponseEntity.ok(userService.toDto(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = securityContextHolderStrategy.getContext().getAuthentication();
        logoutHandler.logout(request, response, auth);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequest req) {
        passwordResetService.requestReset(req.email());
        return ResponseEntity.noContent().build();   // 204 always — no account enumeration
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirm req) {
        passwordResetService.confirmReset(req.token(), req.newPassword());
        return ResponseEntity.noContent().build();   // 204
    }

    /** Persist an authenticated SecurityContext into the session (emits the SESSION cookie in a real container). */
    void establishSession(DashUserDetails principal, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities());
        SecurityContext context = securityContextHolderStrategy.createEmptyContext();
        context.setAuthentication(auth);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    @ExceptionHandler(EmailInUseException.class)
    public ResponseEntity<ApiError> handleEmailInUse(EmailInUseException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("EMAIL_IN_USE", ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleBadCredentials(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("INVALID_CREDENTIALS", "Invalid email or password"));
    }

    @ExceptionHandler(InvalidResetTokenException.class)
    public ResponseEntity<ApiError> handleInvalidResetToken(InvalidResetTokenException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("INVALID_RESET_TOKEN", ex.getMessage()));
    }
}
```

Then in `backend/src/main/java/com/dashdash/config/SecurityConfig.java` (the final Task 6 chain) add `"/api/v1/auth/password-reset/**"` to the `permitAll` `requestMatchers(...)` list so both public reset endpoints are reachable without authentication (CSRF still applies). The matcher block becomes:

```java
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/health",
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/auth/password-reset/**",
                    "/api/v1/catalog",
                    "/api/v1/billing/webhook",
                    "/oauth2/**",
                    "/login/oauth2/**").permitAll()
                .anyRequest().authenticated())
```

- [ ] **Step 9: Run the test to verify it passes.** From `backend/` (Docker running):

```
./gradlew test --tests "com.dashdash.auth.AuthControllerPasswordResetTest"
```

Expected: `BUILD SUCCESSFUL`, 3 tests passed — request → `204` and confirm with the captured token → `204` (new bcrypt password persisted), reusing the confirmed token → `400 INVALID_RESET_TOKEN`, unknown email → `204`.

- [ ] **Step 10: Run the full auth + config suites to confirm no regression.** From `backend/` (Docker running):

```
./gradlew test --tests "com.dashdash.auth.*" --tests "com.dashdash.config.*"
```

Expected: `BUILD SUCCESSFUL` — all prior auth/config tests plus `PasswordResetServiceTest` and `AuthControllerPasswordResetTest` pass; the added `permitAll` matcher does not loosen any previously-authenticated path.

- [ ] **Step 11: Commit.**

```
git add backend/src/main/java/com/dashdash/auth/PasswordResetToken.java backend/src/main/java/com/dashdash/auth/PasswordResetTokenRepository.java backend/src/main/java/com/dashdash/auth/EmailSender.java backend/src/main/java/com/dashdash/auth/LoggingEmailSender.java backend/src/main/java/com/dashdash/auth/InvalidResetTokenException.java backend/src/main/java/com/dashdash/auth/PasswordResetService.java backend/src/main/java/com/dashdash/auth/dto/PasswordResetRequest.java backend/src/main/java/com/dashdash/auth/dto/PasswordResetConfirm.java backend/src/main/java/com/dashdash/auth/UserService.java backend/src/main/java/com/dashdash/config/MongoIndexConfig.java backend/src/main/java/com/dashdash/auth/AuthController.java backend/src/main/java/com/dashdash/config/SecurityConfig.java backend/src/test/java/com/dashdash/auth/PasswordResetServiceTest.java backend/src/test/java/com/dashdash/auth/AuthControllerPasswordResetTest.java
git commit -m "feat(auth): password reset with hashed single-use tokens, TTL index, and email sender"
```

---

## Plan complete — exit criteria

When all nine tasks are committed you have: the `User` document (with embedded `Dashboard`/`Cell` model classes + `Dashboard.defaultFor`, `Subscription`, `Tier`/`SubStatus` enums) and its Mongo indexes; `DashPrincipal`/`DashUserDetails`/`DashUserDetailsService` + a delegating bcrypt `PasswordEncoder`; a full auth API — `POST /auth/register` (201 + session), `POST /auth/login` (200 + session, 401 on bad creds), `GET /auth/me` (200/401), `POST /auth/logout` (204) — behind the final stateful `SecurityFilterChain`; Google OIDC via `oauth2Login` with `DashOidcUserService` upserting users and redirecting to the UI `/app`; and, on the frontend, the `@ngrx/signals` `AuthStore`, `AuthApi`, `authGuard`, Signal-Forms login/register components, the guarded `/app` route, session bootstrap in `AppComponent`, a non-Chromium notice banner, and a "Continue with Google" button; and the public password-reset flow — `POST /auth/password-reset/request` (204 always, no account enumeration) and `POST /auth/password-reset/confirm` (204, 400 `INVALID_RESET_TOKEN` on invalid/expired) — backed by a SHA-256-hashed, single-use, 30-minute, TTL-indexed `PasswordResetToken` and a pluggable `EmailSender` (`LoggingEmailSender` in dev). The backend `Dashboard` model carries a nullable `parkedApp` cell (null after `defaultFor`; set by Plan 05's downgrade reconcile). Plans 03/05/06 consume `User`/`Subscription`/`Tier`/`SubStatus`/`UserRepository`/`DashPrincipal`, the model classes `Dashboard`/`Cell`/`CellType`/`OpenMode` + `Dashboard.defaultFor` (incl. `parkedApp`), `AuthStore` (esp. `tier`), and `authGuard` from this plan.








