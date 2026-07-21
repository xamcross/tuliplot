# DashDash — Walking Skeleton Implementation Plan (Plan 01 of 06)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Stand up the monorepo, a deployable Spring Boot API and Angular app under one registrable domain, and prove a credentialed CORS + session-cookie round-trip end to end.

**Architecture:** A single Git monorepo holds four concerns (`frontend/`, `backend/`, `extension/`, `content/`). The backend is a Spring Boot 4.1 modular monolith exposing only `/api/v1/**`, with credentialed CORS to the UI origin, CSRF via a cookie/header pair, and a MongoDB-backed HTTP session. The frontend is an Angular 22 standalone/zoneless app whose HTTP layer always sends credentials and echoes the CSRF header. Both run locally (API `:8080`, UI `:4200`) and share the registrable domain `dashdash.app` in production.

**Tech Stack:** Java 25 · Spring Boot 4.1 (Gradle Kotlin DSL) · Spring Security 7 · Spring Data MongoDB · spring-session-data-mongodb · Testcontainers-Mongo · JUnit 5 · Angular 22 (zoneless, signals) · Vitest · GitHub Actions · Fly.io · Cloudflare Pages · MongoDB Atlas.

**Depends on:** — (this is the first plan; nothing precedes it. Plans 02–06 assume the repo, Gradle build, Angular scaffold, security/CORS/CSRF config, `/api/v1/health`, `ApiError`, `credentialsInterceptor`, CI, and deploy configs produced here.)

## Global Constraints

See `2026-07-21-dashdash-00-shared-contract.md` (authoritative for names/types/signatures and global constraints). This plan additionally requires:

- **Backend build:** Java **25** toolchain · Spring Boot **4.1.0** · Gradle **9.0.0** wrapper · `io.spring.dependency-management` **1.1.7** · foojay toolchain resolver so JDK 25 auto-provisions.
- **API surface (Plan 01):** exactly one endpoint — `GET /api/v1/health` → `200 {"status":"UP"}` (public).
- **Error type:** `record ApiError(String code, String message)` in package `com.dashdash.common` (contract-owned, defined here).
- **CORS:** allowed origins **`https://dashdash.app`** and **`http://localhost:4200`** only; `allowCredentials=true`; allowed headers include **`Content-Type`** and **`X-XSRF-TOKEN`**.
- **CSRF:** `CookieCsrfTokenRepository.withHttpOnlyFalse()` (cookie **`XSRF-TOKEN`**, header **`X-XSRF-TOKEN`**) + SPA request handler; `/api/v1/billing/webhook` is CSRF-exempt.
- **Security baseline:** `permitAll` for `/api/v1/health`, `/api/v1/auth/**`, `/api/v1/catalog`, `/api/v1/billing/webhook`, `/oauth2/**`; every other request authenticated; unauthenticated → **401** via `HttpStatusEntryPoint`. (Plan 02 owns and refines the final security filter chain; this is the walking-skeleton baseline.)
- **Session cookie:** name `DASHSESSION`, `httpOnly`, `SameSite=Lax`, `Secure` and domain env-driven (`COOKIE_SECURE`, `COOKIE_DOMAIN`; `.dashdash.app` in prod).
- **Mongo:** connection via `MONGODB_URI`; pool capped `maxPoolSize=50` (within the 20–50 rule) in the connection string.
- **Frontend:** Angular **22**, standalone, **zoneless**, signals; Vitest via `@analogjs/vite-plugin-angular`; API base URL from `environments/` (prod `https://api.dashdash.app/api/v1`, dev `http://localhost:8080/api/v1`); every request carries `withCredentials:true`.
- **Dev ports:** API `8080`, UI `4200`. **Node 22 LTS**.
- **Windows note:** all `./gradlew …` commands below run as written in Git Bash / macOS / Linux and in CI. In native PowerShell use `.\gradlew.bat …`. All other commands (`npx`, `git`, `curl`) are cross-platform.

---

### Task 1: Monorepo init

**Files:**
- Create: `C:\Users\xamcr\DashDash\.gitignore`
- Create: `C:\Users\xamcr\DashDash\README.md`
- Create: `C:\Users\xamcr\DashDash\LICENSE`
- Create: `C:\Users\xamcr\DashDash\backend\.gitkeep`, `C:\Users\xamcr\DashDash\frontend\.gitkeep`, `C:\Users\xamcr\DashDash\extension\.gitkeep`, `C:\Users\xamcr\DashDash\content\.gitkeep`, `C:\Users\xamcr\DashDash\.github\workflows\.gitkeep`
- Test: none (repo bootstrap; verified with `git` commands).

**Interfaces:**
- Consumes: nothing.
- Produces: initialized Git repository at repo root; top-level directories `frontend/ backend/ extension/ content/ docs/ .github/`; root `.gitignore`, `README.md`, `LICENSE`. All later plans assume `git` is initialized here.

- [ ] **Step 1: Initialize the repository** — run from the repo root:
  ```bash
  cd /c/Users/xamcr/DashDash
  git init
  git symbolic-ref HEAD refs/heads/main
  ```
  (`docs/` already exists — it holds this plan. The other directories are created below.)

- [ ] **Step 2: Create the root `.gitignore`** — write `C:\Users\xamcr\DashDash\.gitignore`:
  ```gitignore
  # ---- Java / Gradle ----
  backend/.gradle/
  backend/build/
  backend/out/
  backend/bin/
  !gradle/wrapper/gradle-wrapper.jar

  # ---- Node / Angular ----
  frontend/node_modules/
  frontend/dist/
  frontend/.angular/
  frontend/coverage/
  extension/node_modules/

  # ---- Env / secrets ----
  *.env
  .env
  .env.*
  !/.env.example

  # ---- IDE / OS ----
  .idea/
  *.iml
  .vscode/
  .DS_Store
  Thumbs.db
  ```

- [ ] **Step 3: Create the `LICENSE`** — write `C:\Users\xamcr\DashDash\LICENSE`:
  ```text
  DashDash — Proprietary License

  Copyright (c) 2026 DashDash. All rights reserved.

  This software and associated documentation files (the "Software") are the
  confidential and proprietary property of the DashDash project owner. No part
  of the Software may be copied, modified, merged, published, distributed,
  sublicensed, or sold without the prior written permission of the copyright
  holder. Unauthorized use is prohibited.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  ```

- [ ] **Step 4: Create the `README.md`** — write `C:\Users\xamcr\DashDash\README.md`:
  ```markdown
  # DashDash

  Turn one browser window into a personal dashboard: a fixed 3×2 grid where each
  cell hosts a live web app (Gmail, Trello, a news site — any URL). Free tier
  reserves the bottom-right cell for an ad; Premium removes it and unlocks all 6.

  ## Monorepo layout

  | Path         | What                                                            | Hosting             |
  |--------------|-----------------------------------------------------------------|---------------------|
  | `frontend/`  | Angular 22 app — prerendered public site + CSR dashboard        | Cloudflare Pages    |
  | `backend/`   | Spring Boot 4.1 modular monolith — REST/JSON API only (`/api`)  | Fly.io              |
  | `extension/` | Chrome MV3 companion (static DNR ruleset + handshake)           | Chrome Web Store    |
  | `content/`   | Markdown for guides/blog, compiled into prerendered pages       | (built into `frontend`) |
  | `docs/`      | Design spec and implementation plans                            | —                   |

  Domains: UI `https://dashdash.app` · API `https://api.dashdash.app` (one
  registrable domain → same-site session cookie + credentialed CORS).

  ## Prerequisites

  - JDK 25 (or let Gradle's foojay resolver download it)
  - Node.js 22 LTS + npm
  - Docker (for Testcontainers-backed backend tests)

  ## Run locally

  ```bash
  # API on http://localhost:8080
  cd backend && ./gradlew bootRun

  # UI on http://localhost:4200
  cd frontend && npx ng serve
  ```

  See `docs/verify-skeleton.md` for the end-to-end credential round-trip check.

  ## Test

  ```bash
  cd backend && ./gradlew build          # unit + Testcontainers integration tests
  cd frontend && npx vitest run          # Vitest unit tests
  ```
  ```

- [ ] **Step 5: Create the directory scaffold** — the placeholder files keep empty directories under version control (Git does not track empty dirs). Run:
  ```bash
  cd /c/Users/xamcr/DashDash
  mkdir -p backend frontend extension content .github/workflows docs
  touch backend/.gitkeep frontend/.gitkeep extension/.gitkeep content/.gitkeep .github/workflows/.gitkeep
  ```

- [ ] **Step 6: Verify the scaffold** — run and confirm output:
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git status --short
  ```
  Expected (order may vary): each new path listed with `A` (added), including `A  .gitignore`, `A  LICENSE`, `A  README.md`, `A  backend/.gitkeep`, `A  frontend/.gitkeep`, `A  extension/.gitkeep`, `A  content/.gitkeep`, `A  .github/workflows/.gitkeep`. Then list the directories:
  ```bash
  git ls-files --others --exclude-standard --directory
  find . -maxdepth 1 -type d -not -path './.git*' | sort
  ```
  Expected `find` output: `.`, `./.github`, `./backend`, `./content`, `./docs`, `./extension`, `./frontend`.

- [ ] **Step 7: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "chore: initialize DashDash monorepo scaffold"
  ```

---

### Task 2: Backend Spring Boot 4.1 scaffold + `/health` + error handling

**Files:**
- Create: `C:\Users\xamcr\DashDash\backend\settings.gradle.kts`
- Create: `C:\Users\xamcr\DashDash\backend\build.gradle.kts`
- Create: `C:\Users\xamcr\DashDash\backend\gradle\wrapper\gradle-wrapper.properties` (+ `gradlew`, `gradlew.bat`, `gradle-wrapper.jar` via `gradle wrapper`)
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\DashdashApplication.java`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\common\ApiError.java`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\common\GlobalExceptionHandler.java`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\common\HealthController.java`
- Test: `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\common\GlobalExceptionHandlerTest.java`
- Test: `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\common\HealthControllerTest.java`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `com.dashdash.DashdashApplication` (`@SpringBootApplication`, component scan root `com.dashdash`).
  - `record ApiError(String code, String message)` — contract symbol, consumed by all plans.
  - `com.dashdash.common.GlobalExceptionHandler` (`@RestControllerAdvice` → `ApiError`).
  - `com.dashdash.common.HealthController` → `GET /api/v1/health` returns `{"status":"UP"}`.
  - Runnable Gradle build (`./gradlew build`, `./gradlew bootRun`, `./gradlew bootJar`).

- [ ] **Step 1: Bootstrap the Gradle wrapper** — from `backend/`, generate the wrapper (needs a system Gradle once; install via SDKMAN `sdk install gradle 9.0.0`, Homebrew `brew install gradle`, or Chocolatey `choco install gradle`. If you cannot install Gradle, copy `gradlew`, `gradlew.bat`, and `gradle/wrapper/` from any existing Gradle 9 project and set the version in `gradle-wrapper.properties`):
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  gradle wrapper --gradle-version 9.0.0 --distribution-type bin
  ```
  Confirm `gradle/wrapper/gradle-wrapper.properties` contains `distributionUrl=https\://services.gradle.org/distributions/gradle-9.0.0-bin.zip`.

- [ ] **Step 2: Write `settings.gradle.kts`** — write `C:\Users\xamcr\DashDash\backend\settings.gradle.kts`:
  ```kotlin
  plugins {
      id("org.gradle.toolchains.foojay-resolver-convention") version "0.9.0"
  }

  rootProject.name = "dashdash-backend"
  ```

- [ ] **Step 3: Write `build.gradle.kts`** — write `C:\Users\xamcr\DashDash\backend\build.gradle.kts`:
  ```kotlin
  plugins {
      java
      id("org.springframework.boot") version "4.1.0"
      id("io.spring.dependency-management") version "1.1.7"
  }

  group = "com.dashdash"
  version = "0.1.0"

  java {
      toolchain {
          languageVersion.set(JavaLanguageVersion.of(25))
      }
  }

  repositories {
      mavenCentral()
  }

  dependencies {
      implementation("org.springframework.boot:spring-boot-starter-web")
      implementation("org.springframework.boot:spring-boot-starter-actuator")

      testImplementation("org.springframework.boot:spring-boot-starter-test")
      testRuntimeOnly("org.junit.platform:junit-platform-launcher")
  }

  tasks.withType<Test> {
      useJUnitPlatform()
  }
  ```

- [ ] **Step 4: Write the application entry point** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\DashdashApplication.java`:
  ```java
  package com.dashdash;

  import org.springframework.boot.SpringApplication;
  import org.springframework.boot.autoconfigure.SpringBootApplication;

  @SpringBootApplication
  public class DashdashApplication {

      public static void main(String[] args) {
          SpringApplication.run(DashdashApplication.class, args);
      }
  }
  ```

- [ ] **Step 5: Create the `ApiError` record** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\common\ApiError.java`:
  ```java
  package com.dashdash.common;

  /** Uniform JSON error body returned by {@link GlobalExceptionHandler}. */
  public record ApiError(String code, String message) {
  }
  ```

- [ ] **Step 6: Write the failing test for `GlobalExceptionHandler`** — write `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\common\GlobalExceptionHandlerTest.java`:
  ```java
  package com.dashdash.common;

  import static org.assertj.core.api.Assertions.assertThat;

  import org.junit.jupiter.api.Test;
  import org.springframework.http.HttpStatus;
  import org.springframework.http.ResponseEntity;
  import org.springframework.web.server.ResponseStatusException;

  class GlobalExceptionHandlerTest {

      private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

      @Test
      void mapsIllegalArgumentToBadRequest() {
          ResponseEntity<ApiError> response =
                  handler.handleIllegalArgument(new IllegalArgumentException("bad input"));

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
          assertThat(response.getBody()).isNotNull();
          assertThat(response.getBody().code()).isEqualTo("bad_request");
          assertThat(response.getBody().message()).isEqualTo("bad input");
      }

      @Test
      void mapsResponseStatusExceptionToItsStatus() {
          ResponseStatusException ex = new ResponseStatusException(HttpStatus.NOT_FOUND, "missing");

          ResponseEntity<ApiError> response = handler.handleResponseStatus(ex);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
          assertThat(response.getBody()).isNotNull();
          assertThat(response.getBody().code()).isEqualTo("not_found");
          assertThat(response.getBody().message()).isEqualTo("missing");
      }
  }
  ```

- [ ] **Step 7: Run the test to verify it fails** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew test --tests "com.dashdash.common.GlobalExceptionHandlerTest"
  ```
  Expected: **compilation failure** — `cannot find symbol: class GlobalExceptionHandler` (the class does not exist yet). This is the intended red state.

- [ ] **Step 8: Implement `GlobalExceptionHandler`** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\common\GlobalExceptionHandler.java`:
  ```java
  package com.dashdash.common;

  import org.springframework.http.HttpStatus;
  import org.springframework.http.ResponseEntity;
  import org.springframework.web.bind.annotation.ExceptionHandler;
  import org.springframework.web.bind.annotation.RestControllerAdvice;
  import org.springframework.web.server.ResponseStatusException;

  /** Translates uncaught exceptions into a uniform {@link ApiError} JSON body. */
  @RestControllerAdvice
  public class GlobalExceptionHandler {

      @ExceptionHandler(IllegalArgumentException.class)
      public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex) {
          return ResponseEntity.badRequest()
                  .body(new ApiError("bad_request", ex.getMessage()));
      }

      @ExceptionHandler(ResponseStatusException.class)
      public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex) {
          HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
          String message = ex.getReason() != null ? ex.getReason() : status.getReasonPhrase();
          return ResponseEntity.status(status).body(new ApiError(codeFor(status), message));
      }

      @ExceptionHandler(Exception.class)
      public ResponseEntity<ApiError> handleGeneric(Exception ex) {
          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                  .body(new ApiError("internal_error", "An unexpected error occurred"));
      }

      private static String codeFor(HttpStatus status) {
          return status.name().toLowerCase();
      }
  }
  ```

- [ ] **Step 9: Run the test to verify it passes** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew test --tests "com.dashdash.common.GlobalExceptionHandlerTest"
  ```
  Expected: `BUILD SUCCESSFUL` — 2 tests, 0 failures.

- [ ] **Step 10: Write the failing `@WebMvcTest` for `/health`** — write `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\common\HealthControllerTest.java`:
  ```java
  package com.dashdash.common;

  import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
  import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
  import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
  import org.springframework.test.web.servlet.MockMvc;

  @WebMvcTest(HealthController.class)
  class HealthControllerTest {

      @Autowired
      MockMvc mockMvc;

      @Test
      void healthReturnsUp() throws Exception {
          mockMvc.perform(get("/api/v1/health"))
                  .andExpect(status().isOk())
                  .andExpect(jsonPath("$.status").value("UP"));
      }
  }
  ```

- [ ] **Step 11: Run the test to verify it fails** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew test --tests "com.dashdash.common.HealthControllerTest"
  ```
  Expected: **compilation failure** — `cannot find symbol: class HealthController`.

- [ ] **Step 12: Implement `HealthController`** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\common\HealthController.java`:
  ```java
  package com.dashdash.common;

  import java.util.Map;
  import org.springframework.web.bind.annotation.GetMapping;
  import org.springframework.web.bind.annotation.RestController;

  /** Liveness endpoint consumed by Fly.io health checks and the UI landing page. */
  @RestController
  public class HealthController {

      @GetMapping("/api/v1/health")
      public Map<String, String> health() {
          return Map.of("status", "UP");
      }
  }
  ```

- [ ] **Step 13: Run the full test suite to verify green** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew build
  ```
  Expected: `BUILD SUCCESSFUL`; all tests pass (`HealthControllerTest`, `GlobalExceptionHandlerTest`). Note: the first run downloads the JDK 25 toolchain via foojay if not present — this can take a few minutes.

- [ ] **Step 14: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "feat(backend): scaffold Spring Boot 4.1 app with /api/v1/health and ApiError"
  ```

---

### Task 3: Mongo + Spring Session + Testcontainers context test

**Files:**
- Modify: `C:\Users\xamcr\DashDash\backend\build.gradle.kts` (add data-mongodb, spring-session, testcontainers dependencies)
- Create: `C:\Users\xamcr\DashDash\backend\src\main\resources\application.yml`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\MongoIndexConfig.java`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\SessionConfig.java`
- Test: `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\SkeletonContextTest.java`

**Interfaces:**
- Consumes: `com.dashdash.DashdashApplication`, `GET /api/v1/health` (Task 2).
- Produces:
  - `application.yml` — env-driven `MONGODB_URI`, Mongo pool cap, Spring Session store on Mongo, session cookie property placeholders (`dashdash.session.*`).
  - `com.dashdash.config.MongoIndexConfig` — startup index hook (empty/extensible; plans 02 & 05 register indexes here).
  - `com.dashdash.config.SessionConfig` — `CookieSerializer` bean applying `httpOnly` + `SameSite=Lax` + env-driven `Secure`/domain + cookie name `DASHSESSION`.
  - Proof the full Spring context boots against a real MongoDB and round-trips a document.

- [ ] **Step 1: Add the dependencies** — replace the `dependencies { … }` block in `C:\Users\xamcr\DashDash\backend\build.gradle.kts` with:
  ```kotlin
  dependencies {
      implementation("org.springframework.boot:spring-boot-starter-web")
      implementation("org.springframework.boot:spring-boot-starter-actuator")
      implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
      implementation("org.springframework.session:spring-session-data-mongodb")

      testImplementation("org.springframework.boot:spring-boot-starter-test")
      testImplementation("org.springframework.boot:spring-boot-testcontainers")
      testImplementation("org.testcontainers:junit-jupiter")
      testImplementation("org.testcontainers:mongodb")
      testRuntimeOnly("org.junit.platform:junit-platform-launcher")
  }
  ```

- [ ] **Step 2: Write `application.yml`** — write `C:\Users\xamcr\DashDash\backend\src\main\resources\application.yml`:
  ```yaml
  spring:
    application:
      name: dashdash-backend
    data:
      mongodb:
        uri: ${MONGODB_URI:mongodb://localhost:27017/dashdash?maxPoolSize=50&minPoolSize=5}
    session:
      store-type: mongodb
      mongodb:
        collection-name: sessions

  server:
    port: 8080
    servlet:
      session:
        timeout: 30d

  # DashDash-specific, env-driven cookie settings consumed by SessionConfig (and CorsConfig/SecurityConfig in Task 4).
  dashdash:
    session:
      cookie-name: DASHSESSION
      cookie-domain: ${COOKIE_DOMAIN:}
      cookie-secure: ${COOKIE_SECURE:false}
  ```

- [ ] **Step 3: Write `MongoIndexConfig`** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\MongoIndexConfig.java`:
  ```java
  package com.dashdash.config;

  import org.springframework.boot.context.event.ApplicationReadyEvent;
  import org.springframework.context.annotation.Configuration;
  import org.springframework.context.event.EventListener;
  import org.springframework.data.mongodb.core.MongoTemplate;

  /**
   * Central, extensible place to declare MongoDB indexes explicitly at startup.
   * The walking skeleton has no application collections yet, so this hook is
   * intentionally empty. Later plans register indexes here, e.g.:
   *
   * <pre>
   *   mongoTemplate.indexOps("users")
   *       .createIndex(new Index().on("email", Sort.Direction.ASC).unique());
   * </pre>
   */
  @Configuration
  public class MongoIndexConfig {

      private final MongoTemplate mongoTemplate;

      public MongoIndexConfig(MongoTemplate mongoTemplate) {
          this.mongoTemplate = mongoTemplate;
      }

      @EventListener(ApplicationReadyEvent.class)
      public void ensureIndexes() {
          // No-op for the walking skeleton. Plans 02 (users) and 05 (stripe_events TTL)
          // add createIndex(...) calls here using this.mongoTemplate.indexOps(...).
      }
  }
  ```

- [ ] **Step 4: Write `SessionConfig`** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\SessionConfig.java`:
  ```java
  package com.dashdash.config;

  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  import org.springframework.session.web.http.CookieSerializer;
  import org.springframework.session.web.http.DefaultCookieSerializer;

  /** Configures the Spring Session cookie: httpOnly + SameSite=Lax, env-driven Secure/domain. */
  @Configuration
  public class SessionConfig {

      @Bean
      public CookieSerializer cookieSerializer(
              @Value("${dashdash.session.cookie-name:DASHSESSION}") String cookieName,
              @Value("${dashdash.session.cookie-domain:}") String cookieDomain,
              @Value("${dashdash.session.cookie-secure:false}") boolean cookieSecure) {

          DefaultCookieSerializer serializer = new DefaultCookieSerializer();
          serializer.setCookieName(cookieName);
          serializer.setUseHttpOnlyCookie(true);
          serializer.setUseSecureCookie(cookieSecure);
          serializer.setSameSite("Lax");
          serializer.setCookiePath("/");
          if (cookieDomain != null && !cookieDomain.isBlank()) {
              serializer.setDomainName(cookieDomain);
          }
          return serializer;
      }
  }
  ```

- [ ] **Step 5: Write the failing Testcontainers context test** — write `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\SkeletonContextTest.java`:
  ```java
  package com.dashdash;

  import static org.assertj.core.api.Assertions.assertThat;

  import org.bson.Document;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.context.SpringBootTest;
  import org.springframework.boot.test.web.client.TestRestTemplate;
  import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
  import org.springframework.data.mongodb.core.MongoTemplate;
  import org.springframework.http.HttpStatus;
  import org.springframework.http.ResponseEntity;
  import org.testcontainers.containers.MongoDBContainer;
  import org.testcontainers.junit.jupiter.Container;
  import org.testcontainers.junit.jupiter.Testcontainers;

  @Testcontainers
  @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
  class SkeletonContextTest {

      @Container
      @ServiceConnection
      static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

      @Autowired
      TestRestTemplate rest;

      @Autowired
      MongoTemplate mongoTemplate;

      @Test
      void contextBootsAndHealthIsUp() {
          ResponseEntity<String> response = rest.getForEntity("/api/v1/health", String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getBody()).contains("\"status\":\"UP\"");
      }

      @Test
      void roundTripsADocument() {
          mongoTemplate.getCollection("skeleton_pings")
                  .insertOne(new Document("_id", "ping-1").append("note", "hello"));

          Document found = mongoTemplate.getCollection("skeleton_pings")
                  .find(new Document("_id", "ping-1"))
                  .first();

          assertThat(found).isNotNull();
          assertThat(found.getString("note")).isEqualTo("hello");
      }
  }
  ```

- [ ] **Step 6: Run the test to verify it fails** — (Docker must be running.)
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew test --tests "com.dashdash.SkeletonContextTest"
  ```
  Expected before `application.yml` / config classes are picked up correctly, this **must be run after Steps 2–4 are in place**; if you run it with Steps 2–4 missing it fails at context startup (`Failed to load ApplicationContext` / no `MongoTemplate` bean). With Steps 2–4 present but the Mongo starter absent it fails to compile (`MongoTemplate` not found). Confirm you see a red run first if you temporarily comment out the `spring-boot-starter-data-mongodb` line; then restore it.

- [ ] **Step 7: Run the test to verify it passes** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew test --tests "com.dashdash.SkeletonContextTest"
  ```
  Expected: Testcontainers pulls `mongo:7`, starts a single-node replica set, the Spring context boots, and both tests pass — `BUILD SUCCESSFUL`, 2 tests, 0 failures. (First run downloads the Mongo image.)

- [ ] **Step 8: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "feat(backend): add MongoDB + Spring Session with Testcontainers context test"
  ```

---

### Task 4: CORS + CSRF + security baseline

**Files:**
- Modify: `C:\Users\xamcr\DashDash\backend\build.gradle.kts` (add spring-security + spring-security-test)
- Modify: `C:\Users\xamcr\DashDash\backend\src\main\resources\application.yml` (add `dashdash.cors.allowed-origins`)
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\CorsConfig.java`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\SecurityConfig.java`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\SpaCsrfTokenRequestHandler.java`
- Create: `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\CsrfCookieFilter.java`
- Test: `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\config\SecurityBaselineTest.java`

**Interfaces:**
- Consumes: `com.dashdash.common.HealthController` (Task 2), `dashdash.session.cookie-*` props (Task 3).
- Produces:
  - `com.dashdash.config.CorsConfig` → `CorsConfigurationSource` bean (credentialed CORS, UI origins only).
  - `com.dashdash.config.SecurityConfig` → baseline `SecurityFilterChain` (permitAll public routes, 401 entry point, CSRF cookie/header, webhook exempt). **Plan 02 owns the final security filter chain and extends this.**
  - `com.dashdash.config.SpaCsrfTokenRequestHandler`, `com.dashdash.config.CsrfCookieFilter` — SPA CSRF plumbing that guarantees an `XSRF-TOKEN` cookie on every response.

- [ ] **Step 1: Add security dependencies** — replace the `dependencies { … }` block in `C:\Users\xamcr\DashDash\backend\build.gradle.kts` with:
  ```kotlin
  dependencies {
      implementation("org.springframework.boot:spring-boot-starter-web")
      implementation("org.springframework.boot:spring-boot-starter-actuator")
      implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
      implementation("org.springframework.boot:spring-boot-starter-security")
      implementation("org.springframework.session:spring-session-data-mongodb")

      testImplementation("org.springframework.boot:spring-boot-starter-test")
      testImplementation("org.springframework.boot:spring-boot-testcontainers")
      testImplementation("org.springframework.security:spring-security-test")
      testImplementation("org.testcontainers:junit-jupiter")
      testImplementation("org.testcontainers:mongodb")
      testRuntimeOnly("org.junit.platform:junit-platform-launcher")
  }
  ```

- [ ] **Step 2: Add the CORS origins property** — append to the `dashdash:` block in `C:\Users\xamcr\DashDash\backend\src\main\resources\application.yml` so it reads:
  ```yaml
  dashdash:
    session:
      cookie-name: DASHSESSION
      cookie-domain: ${COOKIE_DOMAIN:}
      cookie-secure: ${COOKIE_SECURE:false}
    cors:
      allowed-origins: ${CORS_ALLOWED_ORIGINS:https://dashdash.app,http://localhost:4200}
  ```

- [ ] **Step 3: Write the SPA CSRF request handler** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\SpaCsrfTokenRequestHandler.java`:
  ```java
  package com.dashdash.config;

  import java.util.function.Supplier;
  import jakarta.servlet.http.HttpServletRequest;
  import jakarta.servlet.http.HttpServletResponse;
  import org.springframework.security.web.csrf.CsrfToken;
  import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
  import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
  import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
  import org.springframework.util.StringUtils;

  /**
   * SPA-friendly CSRF handler (Spring Security reference pattern).
   * Renders the token with BREACH protection (XOR) into the response, but reads
   * the raw token value from the {@code X-XSRF-TOKEN} request header that the SPA
   * echoes back from the {@code XSRF-TOKEN} cookie.
   */
  public final class SpaCsrfTokenRequestHandler implements CsrfTokenRequestHandler {

      private final CsrfTokenRequestHandler plain = new CsrfTokenRequestAttributeHandler();
      private final CsrfTokenRequestHandler xor = new XorCsrfTokenRequestAttributeHandler();

      @Override
      public void handle(HttpServletRequest request, HttpServletResponse response,
                         Supplier<CsrfToken> csrfToken) {
          this.xor.handle(request, response, csrfToken);
      }

      @Override
      public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
          String headerValue = request.getHeader(csrfToken.getHeaderName());
          return StringUtils.hasText(headerValue)
                  ? this.plain.resolveCsrfTokenValue(request, csrfToken)
                  : this.xor.resolveCsrfTokenValue(request, csrfToken);
      }
  }
  ```

- [ ] **Step 4: Write the CSRF cookie filter** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\CsrfCookieFilter.java`:
  ```java
  package com.dashdash.config;

  import java.io.IOException;
  import jakarta.servlet.FilterChain;
  import jakarta.servlet.ServletException;
  import jakarta.servlet.http.HttpServletRequest;
  import jakarta.servlet.http.HttpServletResponse;
  import org.springframework.security.web.csrf.CsrfToken;
  import org.springframework.web.filter.OncePerRequestFilter;

  /**
   * Forces the deferred CSRF token to load on every request so the
   * {@code XSRF-TOKEN} cookie is written to the response and the SPA can read it.
   */
  public final class CsrfCookieFilter extends OncePerRequestFilter {

      @Override
      protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                      FilterChain filterChain) throws ServletException, IOException {
          CsrfToken csrfToken = (CsrfToken) request.getAttribute("_csrf");
          if (csrfToken != null) {
              csrfToken.getToken(); // triggers Set-Cookie: XSRF-TOKEN
          }
          filterChain.doFilter(request, response);
      }
  }
  ```

- [ ] **Step 5: Write `CorsConfig`** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\CorsConfig.java`:
  ```java
  package com.dashdash.config;

  import java.util.List;
  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  import org.springframework.web.cors.CorsConfiguration;
  import org.springframework.web.cors.CorsConfigurationSource;
  import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

  /** Credentialed CORS limited to the UI origins. */
  @Configuration
  public class CorsConfig {

      @Bean
      public CorsConfigurationSource corsConfigurationSource(
              @Value("${dashdash.cors.allowed-origins}") List<String> allowedOrigins) {

          CorsConfiguration config = new CorsConfiguration();
          config.setAllowedOrigins(allowedOrigins);
          config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
          config.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
          config.setAllowCredentials(true);
          config.setMaxAge(3600L);

          UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
          source.registerCorsConfiguration("/**", config);
          return source;
      }
  }
  ```

- [ ] **Step 6: Write `SecurityConfig`** — write `C:\Users\xamcr\DashDash\backend\src\main\java\com\dashdash\config\SecurityConfig.java`:
  ```java
  package com.dashdash.config;

  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  import org.springframework.http.HttpStatus;
  import org.springframework.security.config.annotation.web.builders.HttpSecurity;
  import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
  import org.springframework.security.web.SecurityFilterChain;
  import org.springframework.security.web.authentication.HttpStatusEntryPoint;
  import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
  import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
  import org.springframework.util.StringUtils;
  import org.springframework.web.cors.CorsConfigurationSource;

  /**
   * Walking-skeleton security baseline. Plan 02 owns the final filter chain and
   * layers in form login, OAuth2 login, and DashPrincipal-based authorization.
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
              .authorizeHttpRequests(auth -> auth
                  .requestMatchers(
                      "/api/v1/health",
                      "/api/v1/auth/**",
                      "/api/v1/catalog",
                      "/api/v1/billing/webhook",
                      "/oauth2/**").permitAll()
                  .anyRequest().authenticated())
              .exceptionHandling(ex -> ex
                  .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
              .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class);

          return http.build();
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

- [ ] **Step 7: Write the failing security baseline test** — write `C:\Users\xamcr\DashDash\backend\src\test\java\com\dashdash\config\SecurityBaselineTest.java`:
  ```java
  package com.dashdash.config;

  import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
  import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
  import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
  import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
  import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

  import com.dashdash.common.HealthController;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
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
  ```

- [ ] **Step 8: Run the test to verify it fails** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew test --tests "com.dashdash.config.SecurityBaselineTest"
  ```
  Expected before Steps 3–6 exist: **compilation failure** — `cannot find symbol: class SecurityConfig` / `CorsConfig`. (If you write the test last, run it once to confirm red.)

- [ ] **Step 9: Run the test to verify it passes** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew test --tests "com.dashdash.config.SecurityBaselineTest"
  ```
  Expected: `BUILD SUCCESSFUL` — 3 tests pass. The preflight returns `200` with `Access-Control-Allow-Origin: http://localhost:4200` and `Access-Control-Allow-Credentials: true`; the GET sets an `XSRF-TOKEN` cookie; and `/api/v1/dashboard` (no handler, `anyRequest().authenticated()`) is denied with `401` by the entry point.

- [ ] **Step 10: Run the full build to confirm nothing regressed** —
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew build
  ```
  Expected: `BUILD SUCCESSFUL`; all tests (`HealthControllerTest`, `GlobalExceptionHandlerTest`, `SkeletonContextTest`, `SecurityBaselineTest`) pass.

- [ ] **Step 11: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "feat(backend): credentialed CORS + SPA CSRF + security baseline (401 entry point)"
  ```

---

### Task 5: Frontend Angular 22 scaffold + HealthApi + landing placeholder

**Files:**
- Create (via `ng new`, then overwrite): the `frontend/` Angular project
- Create: `C:\Users\xamcr\DashDash\frontend\src\environments\environment.ts`
- Create: `C:\Users\xamcr\DashDash\frontend\src\environments\environment.development.ts`
- Overwrite: `C:\Users\xamcr\DashDash\frontend\src\main.ts`
- Create: `C:\Users\xamcr\DashDash\frontend\src\app\app.component.ts`
- Overwrite: `C:\Users\xamcr\DashDash\frontend\src\app\app.config.ts`
- Overwrite: `C:\Users\xamcr\DashDash\frontend\src\app\app.routes.ts`
- Create: `C:\Users\xamcr\DashDash\frontend\src\app\core\interceptors\credentials.interceptor.ts` (stub — implemented in Task 6)
- Create: `C:\Users\xamcr\DashDash\frontend\src\app\core\api\health.api.ts`
- Create: `C:\Users\xamcr\DashDash\frontend\src\app\features\landing\landing.component.ts`
- Create: `C:\Users\xamcr\DashDash\frontend\vitest.config.ts`
- Create: `C:\Users\xamcr\DashDash\frontend\src\test-setup.ts`
- Modify: `C:\Users\xamcr\DashDash\frontend\angular.json` (environment fileReplacements + `.component` schematics suffix)
- Test: `C:\Users\xamcr\DashDash\frontend\src\app\core\api\health.api.spec.ts`

**Interfaces:**
- Consumes: `GET /api/v1/health` (Task 2/4); `credentialsInterceptor` symbol name (Task 6 delivers behavior).
- Produces:
  - `environment.apiBaseUrl` (prod `https://api.dashdash.app/api/v1`, dev `http://localhost:8080/api/v1`).
  - `appConfig` with `provideZonelessChangeDetection`, `provideRouter(routes)`, `provideHttpClient(withXsrfConfiguration({cookieName:'XSRF-TOKEN',headerName:'X-XSRF-TOKEN'}), withInterceptors([credentialsInterceptor]))`.
  - `routes`, `AppComponent`, `LandingComponent`.
  - `HealthApi` (`check(): Observable<{status:string}>`) at `core/api/health.api.ts`.
  - `credentialsInterceptor` (`HttpInterceptorFn`) stub at the contract path `core/interceptors/credentials.interceptor.ts`.
  - Working Vitest harness (`vitest.config.ts` + `src/test-setup.ts`).

- [ ] **Step 1: Generate the Angular project** — from the repo root, remove the placeholder and scaffold:
  ```bash
  cd /c/Users/xamcr/DashDash
  rm -rf frontend
  NG_CLI_ANALYTICS=false npx @angular/cli@22 new frontend \
    --style=scss --ssr=false --zoneless --skip-git --package-manager=npm
  ```
  Accept defaults for any remaining prompt. This creates `frontend/` with `package.json`, `angular.json`, `src/main.ts`, `src/app/app.config.ts`, `src/app/app.routes.ts`, and a root component, and runs `npm install`.

- [ ] **Step 2: Install the Vitest + Angular test toolchain** —
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npm install -D vitest jsdom @analogjs/vite-plugin-angular
  ```
  (Use the `@analogjs/vite-plugin-angular` release that supports Angular 22; `@latest` is fine if the version above does not resolve.)

- [ ] **Step 3: Write the Vitest config** — write `C:\Users\xamcr\DashDash\frontend\vitest.config.ts`:
  ```ts
  /// <reference types="vitest" />
  import { defineConfig } from 'vitest/config';
  import angular from '@analogjs/vite-plugin-angular';

  export default defineConfig(({ mode }) => ({
    plugins: [angular()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['src/**/*.spec.ts'],
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  }));
  ```

- [ ] **Step 4: Write the test setup (zoneless test environment)** — write `C:\Users\xamcr\DashDash\frontend\src\test-setup.ts`:
  ```ts
  import '@angular/compiler';
  import { getTestBed } from '@angular/core/testing';
  import {
    BrowserTestingModule,
    platformBrowserTesting,
  } from '@angular/platform-browser/testing';

  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  ```

- [ ] **Step 5: Add a `test` script** — in `C:\Users\xamcr\DashDash\frontend\package.json`, add to `"scripts"`:
  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```

- [ ] **Step 6: Create the environment files** — write `C:\Users\xamcr\DashDash\frontend\src\environments\environment.ts`:
  ```ts
  export const environment = {
    production: true,
    apiBaseUrl: 'https://api.dashdash.app/api/v1',
  };
  ```
  and write `C:\Users\xamcr\DashDash\frontend\src\environments\environment.development.ts`:
  ```ts
  export const environment = {
    production: false,
    apiBaseUrl: 'http://localhost:8080/api/v1',
  };
  ```

- [ ] **Step 7: Wire environment file replacement + component suffix in `angular.json`** — in `C:\Users\xamcr\DashDash\frontend\angular.json`:
  1. Under the project's `"architect" > "build" > "configurations" > "development"` object, add:
     ```json
     "fileReplacements": [
       {
         "replace": "src/environments/environment.ts",
         "with": "src/environments/environment.development.ts"
       }
     ]
     ```
     (Leave the `"production"` configuration without a replacement so it uses `environment.ts`. `ng serve` uses `development` by default → dev API base URL.)
  2. At the project object level (sibling of `"architect"`), add:
     ```json
     "schematics": {
       "@schematics/angular:component": { "type": "component" }
     }
     ```
     so future `ng generate component` produces `*.component.ts` with the `Component` class suffix (matches the contract's file naming).

- [ ] **Step 8: Create the credentials interceptor stub** — write `C:\Users\xamcr\DashDash\frontend\src\app\core\interceptors\credentials.interceptor.ts`:
  ```ts
  import { HttpInterceptorFn } from '@angular/common/http';

  // Walking-skeleton stub — credentialed behavior is test-driven in Plan 01 Task 6.
  export const credentialsInterceptor: HttpInterceptorFn = (req, next) => next(req);
  ```

- [ ] **Step 9: Overwrite `app.config.ts`** — write `C:\Users\xamcr\DashDash\frontend\src\app\app.config.ts`:
  ```ts
  import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
  import { provideRouter } from '@angular/router';
  import {
    provideHttpClient,
    withInterceptors,
    withXsrfConfiguration,
  } from '@angular/common/http';
  import { routes } from './app.routes';
  import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';

  export const appConfig: ApplicationConfig = {
    providers: [
      provideZonelessChangeDetection(),
      provideRouter(routes),
      provideHttpClient(
        withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
        withInterceptors([credentialsInterceptor]),
      ),
    ],
  };
  ```

- [ ] **Step 10: Overwrite `app.routes.ts`** — write `C:\Users\xamcr\DashDash\frontend\src\app\app.routes.ts`:
  ```ts
  import { Routes } from '@angular/router';
  import { LandingComponent } from './features/landing/landing.component';

  export const routes: Routes = [
    { path: '', component: LandingComponent },
    // Plan 06 replaces the placeholder landing with the real prerendered marketing site.
  ];
  ```

- [ ] **Step 11: Create the root `AppComponent`** — write `C:\Users\xamcr\DashDash\frontend\src\app\app.component.ts`:
  ```ts
  import { Component } from '@angular/core';
  import { RouterOutlet } from '@angular/router';

  @Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: `<router-outlet />`,
  })
  export class AppComponent {}
  ```
  Then delete the root component files that `ng new` generated (they vary by CLI version; remove whichever exist so the build uses `AppComponent`):
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  rm -f src/app/app.ts src/app/app.html src/app/app.scss src/app/app.spec.ts \
        src/app/app.component.html src/app/app.component.scss src/app/app.component.spec.ts
  ```

- [ ] **Step 12: Point `main.ts` at `AppComponent`** — overwrite `C:\Users\xamcr\DashDash\frontend\src\main.ts`:
  ```ts
  import { bootstrapApplication } from '@angular/platform-browser';
  import { appConfig } from './app/app.config';
  import { AppComponent } from './app/app.component';

  bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
  ```

- [ ] **Step 13: Write the failing `HealthApi` test** — write `C:\Users\xamcr\DashDash\frontend\src\app\core\api\health.api.spec.ts`:
  ```ts
  import { TestBed } from '@angular/core/testing';
  import { provideHttpClient } from '@angular/common/http';
  import {
    HttpTestingController,
    provideHttpClientTesting,
  } from '@angular/common/http/testing';
  import { HealthApi } from './health.api';
  import { environment } from '../../../environments/environment';

  describe('HealthApi', () => {
    let api: HealthApi;
    let httpMock: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), HealthApi],
      });
      api = TestBed.inject(HealthApi);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it('GETs /health and returns the status payload', () => {
      let result: { status: string } | undefined;
      api.check().subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/health`);
      expect(req.request.method).toBe('GET');
      req.flush({ status: 'UP' });

      expect(result).toEqual({ status: 'UP' });
    });
  });
  ```

- [ ] **Step 14: Run the test to verify it fails** —
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npx vitest run src/app/core/api/health.api.spec.ts
  ```
  Expected: failure — `Failed to resolve import "./health.api"` (the service does not exist yet).

- [ ] **Step 15: Implement `HealthApi`** — write `C:\Users\xamcr\DashDash\frontend\src\app\core\api\health.api.ts`:
  ```ts
  import { HttpClient } from '@angular/common/http';
  import { Injectable, inject } from '@angular/core';
  import { Observable } from 'rxjs';
  import { environment } from '../../../environments/environment';

  export interface HealthStatus {
    status: string;
  }

  @Injectable({ providedIn: 'root' })
  export class HealthApi {
    private readonly http = inject(HttpClient);

    check(): Observable<HealthStatus> {
      return this.http.get<HealthStatus>(`${environment.apiBaseUrl}/health`);
    }
  }
  ```

- [ ] **Step 16: Run the test to verify it passes** —
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npx vitest run src/app/core/api/health.api.spec.ts
  ```
  Expected:
  ```
   ✓ src/app/core/api/health.api.spec.ts (1 test)
   Test Files  1 passed (1)
        Tests  1 passed (1)
  ```

- [ ] **Step 17: Create the landing placeholder component** — write `C:\Users\xamcr\DashDash\frontend\src\app\features\landing\landing.component.ts`:
  ```ts
  import { Component, OnInit, inject, signal } from '@angular/core';
  import { HealthApi } from '../../core/api/health.api';

  @Component({
    selector: 'app-landing',
    template: `
      <main style="font-family: system-ui, sans-serif; padding: 2rem;">
        <h1>DashDash</h1>
        <p>API health: <strong data-testid="health">{{ status() }}</strong></p>
      </main>
    `,
  })
  export class LandingComponent implements OnInit {
    private readonly health = inject(HealthApi);
    readonly status = signal<string>('checking…');

    ngOnInit(): void {
      this.health.check().subscribe({
        next: (r) => this.status.set(r.status),
        error: () => this.status.set('DOWN'),
      });
    }
  }
  ```
  **NOTE (temporary placeholder):** this `features/landing/landing.component.ts` and its `''` route are a walking-skeleton placeholder only — Plan 06 **deletes both** and replaces them with `features/marketing/landing.component.ts` (selector `dd-landing`) as the final `/` route (per the shared contract's canonical route table).

- [ ] **Step 18: Verify the production build compiles** —
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npx ng build --configuration production
  ```
  Expected: `Application bundle generation complete`; output written to `dist/frontend/browser/`.

- [ ] **Step 19: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "feat(frontend): Angular 22 zoneless scaffold with HealthApi, env config, Vitest"
  ```

---

### Task 6: Frontend credentials interceptor (test-driven)

**Files:**
- Modify: `C:\Users\xamcr\DashDash\frontend\src\app\core\interceptors\credentials.interceptor.ts` (replace the Task 5 stub with the real implementation)
- Test: `C:\Users\xamcr\DashDash\frontend\src\app\core\interceptors\credentials.interceptor.spec.ts`

**Interfaces:**
- Consumes: `credentialsInterceptor` stub + `appConfig` wiring (Task 5).
- Produces: `credentialsInterceptor` (`HttpInterceptorFn`) that sets `withCredentials: true` on every outgoing request. Consumed unchanged by Plan 02 (`2026-07-21-dashdash-02-auth.md`) and every later API service (the session cookie only travels on credentialed requests).

- [ ] **Step 1: Write the failing test** — write `C:\Users\xamcr\DashDash\frontend\src\app\core\interceptors\credentials.interceptor.spec.ts`:
  ```ts
  import { TestBed } from '@angular/core/testing';
  import {
    HttpClient,
    provideHttpClient,
    withInterceptors,
  } from '@angular/common/http';
  import {
    HttpTestingController,
    provideHttpClientTesting,
  } from '@angular/common/http/testing';
  import { credentialsInterceptor } from './credentials.interceptor';

  describe('credentialsInterceptor', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([credentialsInterceptor])),
          provideHttpClientTesting(),
        ],
      });
      http = TestBed.inject(HttpClient);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it('sets withCredentials on every outgoing request', () => {
      let resolved = false;
      http
        .get('http://localhost:8080/api/v1/health')
        .subscribe(() => (resolved = true));

      const req = httpMock.expectOne('http://localhost:8080/api/v1/health');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ status: 'UP' });

      expect(resolved).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails** —
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npx vitest run src/app/core/interceptors/credentials.interceptor.spec.ts
  ```
  Expected: failure — `expected false to be true` (the Task 5 stub forwards the request unchanged, so `withCredentials` is `false`).

- [ ] **Step 3: Implement the interceptor** — overwrite `C:\Users\xamcr\DashDash\frontend\src\app\core\interceptors\credentials.interceptor.ts`:
  ```ts
  import { HttpInterceptorFn } from '@angular/common/http';

  /**
   * Ensures the first-party session cookie (and the XSRF cookie) travel with
   * every API call by setting withCredentials on each outgoing request.
   */
  export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
    next(req.clone({ withCredentials: true }));
  ```

- [ ] **Step 4: Run the test to verify it passes** —
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npx vitest run src/app/core/interceptors/credentials.interceptor.spec.ts
  ```
  Expected:
  ```
   ✓ src/app/core/interceptors/credentials.interceptor.spec.ts (1 test)
   Test Files  1 passed (1)
        Tests  1 passed (1)
  ```

- [ ] **Step 5: Run the full frontend suite + build to confirm no regression** —
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npx vitest run
  npx ng build --configuration production
  ```
  Expected: `Test Files  2 passed (2)` / `Tests  2 passed (2)`, then `Application bundle generation complete`.

- [ ] **Step 6: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "feat(frontend): credentials interceptor sets withCredentials on every request"
  ```

---

### Task 7: Continuous Integration (GitHub Actions)

**Files:**
- Create: `C:\Users\xamcr\DashDash\.github\workflows\ci.yml`
- Delete: `C:\Users\xamcr\DashDash\.github\workflows\.gitkeep` (superseded by `ci.yml`)
- Test: none (verified by running the same commands locally + the workflow on push).

**Interfaces:**
- Consumes: backend Gradle build (Tasks 2–4), frontend Vitest + `ng build` (Tasks 5–6).
- Produces: `.github/workflows/ci.yml` with two jobs — `backend` (JDK 25, `./gradlew build`, Mongo via Testcontainers on the Docker-enabled runner) and `frontend` (`npm ci`, `vitest run`, `ng build`).

- [ ] **Step 1: Write the workflow** — write `C:\Users\xamcr\DashDash\.github\workflows\ci.yml`:
  ```yaml
  name: CI

  on:
    push:
      branches: [main]
    pull_request:

  jobs:
    backend:
      name: Backend (Gradle + Testcontainers)
      runs-on: ubuntu-latest
      defaults:
        run:
          working-directory: backend
      steps:
        - uses: actions/checkout@v4

        - name: Set up JDK 25
          uses: actions/setup-java@v4
          with:
            distribution: temurin
            java-version: '25'

        - name: Cache Gradle
          uses: actions/cache@v4
          with:
            path: |
              ~/.gradle/caches
              ~/.gradle/wrapper
            key: gradle-${{ runner.os }}-${{ hashFiles('backend/**/*.gradle.kts', 'backend/gradle/wrapper/gradle-wrapper.properties') }}
            restore-keys: gradle-${{ runner.os }}-

        - name: Make gradlew executable
          run: chmod +x ./gradlew

        - name: Build and test
          run: ./gradlew --no-daemon build

    frontend:
      name: Frontend (Vitest + ng build)
      runs-on: ubuntu-latest
      defaults:
        run:
          working-directory: frontend
      steps:
        - uses: actions/checkout@v4

        - name: Set up Node 22
          uses: actions/setup-node@v4
          with:
            node-version: '22'
            cache: npm
            cache-dependency-path: frontend/package-lock.json

        - name: Install dependencies
          run: npm ci

        - name: Unit tests
          run: npx vitest run

        - name: Production build
          run: npx ng build --configuration production
  ```
  (Docker is preinstalled on `ubuntu-latest`, so Testcontainers-Mongo works with no extra service. `./gradlew build` runs the unit and integration tests.)

- [ ] **Step 2: Remove the placeholder** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git rm .github/workflows/.gitkeep
  ```

- [ ] **Step 3: Verify the backend job locally** — reproduce the CI command:
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  ./gradlew --no-daemon build
  ```
  Expected: `BUILD SUCCESSFUL`; all four backend test classes pass.

- [ ] **Step 4: Verify the frontend job locally** — reproduce the CI commands (use `npm ci` to mirror CI; requires the committed `package-lock.json`):
  ```bash
  cd /c/Users/xamcr/DashDash/frontend
  npm ci
  npx vitest run
  npx ng build --configuration production
  ```
  Expected: `Test Files  2 passed (2)`, then `Application bundle generation complete`.

- [ ] **Step 5: Validate the YAML syntax** —
  ```bash
  cd /c/Users/xamcr/DashDash
  npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "ci.yml is valid YAML"
  ```
  Expected: `ci.yml is valid YAML`.

- [ ] **Step 6: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "ci: add GitHub Actions workflow for backend and frontend"
  ```

---

### Task 8: Deploy config + skeleton verification

**Files:**
- Create: `C:\Users\xamcr\DashDash\backend\Dockerfile`
- Create: `C:\Users\xamcr\DashDash\backend\.dockerignore`
- Create: `C:\Users\xamcr\DashDash\backend\fly.toml`
- Create: `C:\Users\xamcr\DashDash\frontend\public\_redirects`
- Create: `C:\Users\xamcr\DashDash\docs\deploy-frontend-cloudflare.md`
- Create: `C:\Users\xamcr\DashDash\docs\verify-skeleton.md`
- Test: none (config/deploy/doc task; verified with `docker build`, `curl`, and the documented checklist).

**Interfaces:**
- Consumes: backend Gradle `bootJar` (Task 2), `GET /api/v1/health` (Tasks 2/4), CORS + CSRF baseline (Task 4), frontend `ng build` output `dist/frontend/browser` (Task 5), credentials interceptor (Task 6).
- Produces: containerized backend for Fly.io (`api-dashdash`), Cloudflare Pages build recipe + SPA `_redirects`, and `docs/verify-skeleton.md` proving the credentialed round-trip + XSRF cookie locally, plus staging DNS/domain steps. (`ads.txt` is **not** produced here — Plan 06 owns it solely, at `frontend/public/ads.txt`.)

- [ ] **Step 1: Write the backend `Dockerfile`** — write `C:\Users\xamcr\DashDash\backend\Dockerfile`:
  ```dockerfile
  # ---- build stage ----
  FROM eclipse-temurin:25-jdk AS build
  WORKDIR /app
  COPY . .
  RUN chmod +x ./gradlew && ./gradlew --no-daemon clean bootJar

  # ---- runtime stage ----
  FROM eclipse-temurin:25-jre AS runtime
  WORKDIR /app
  COPY --from=build /app/build/libs/*.jar app.jar
  ENV JAVA_OPTS="-Xmx300m"
  EXPOSE 8080
  ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
  ```

- [ ] **Step 2: Write the `.dockerignore`** — write `C:\Users\xamcr\DashDash\backend\.dockerignore`:
  ```dockerignore
  build/
  .gradle/
  out/
  bin/
  *.iml
  .idea/
  ```

- [ ] **Step 3: Write `fly.toml`** — write `C:\Users\xamcr\DashDash\backend\fly.toml`:
  ```toml
  app = "api-dashdash"
  primary_region = "iad"

  [build]
    dockerfile = "Dockerfile"

  [http_service]
    internal_port = 8080
    force_https = true
    auto_stop_machines = "stop"
    auto_start_machines = true
    min_machines_running = 0

    [[http_service.checks]]
      interval = "30s"
      timeout = "5s"
      grace_period = "20s"
      method = "GET"
      path = "/api/v1/health"

  [[vm]]
    size = "shared-cpu-1x"
    memory = "512mb"
  ```
  (Spring Boot listens on `8080`, matching `internal_port`. Secrets — `MONGODB_URI`, `COOKIE_DOMAIN=.dashdash.app`, `COOKIE_SECURE=true`, `CORS_ALLOWED_ORIGINS=https://dashdash.app` — are set with `fly secrets set …`, never committed.)

- [ ] **Step 4: Write the SPA `_redirects`** — write `C:\Users\xamcr\DashDash\frontend\public\_redirects`:
  ```text
  /* /index.html 200
  ```
  (Angular copies `public/` to `dist/frontend/browser/`, so Cloudflare Pages serves `_redirects` at the site root, rewriting all deep links to the SPA shell. Note: Plan 06 adds prerendered public routes as real files, which take precedence over this catch-all.)

- [ ] **Step 5: Write the Cloudflare Pages deploy doc** — write `C:\Users\xamcr\DashDash\docs\deploy-frontend-cloudflare.md`:
  ```markdown
  # Frontend deploy — Cloudflare Pages

  ## Project settings

  | Setting                | Value                                   |
  |------------------------|-----------------------------------------|
  | Framework preset       | Angular                                 |
  | Root directory         | `frontend`                              |
  | Build command          | `npm ci && npx ng build --configuration production` |
  | Build output directory | `dist/frontend/browser`                 |
  | Node version           | `22` (set env var `NODE_VERSION=22`)    |

  ## SPA routing

  `frontend/public/_redirects` contains `/* /index.html 200`. Angular copies
  `public/` into the build output, so Cloudflare Pages serves it at the site root
  and every client-side route resolves to the SPA shell. Prerendered public pages
  (added in Plan 06) are emitted as real files and win over this catch-all.

  ## Custom domain

  1. Cloudflare Pages → project → **Custom domains** → add `dashdash.app`.
  2. Add `www.dashdash.app` and redirect it to the apex.
  3. DNS records are created automatically when the domain is on the same
     Cloudflare account (register `dashdash.app` via Cloudflare Registrar).

  ## Environment / API base URL

  The production bundle uses `src/environments/environment.ts`
  (`apiBaseUrl = https://api.dashdash.app/api/v1`). No build-time env vars are
  needed for the API URL. `ng serve` (local dev) uses
  `environment.development.ts` (`http://localhost:8080/api/v1`).
  ```

- [ ] **Step 6: Write the local + staging verification checklist** — write `C:\Users\xamcr\DashDash\docs\verify-skeleton.md`:
  ```markdown
  # Walking-skeleton verification

  Proves the UI can call the API with credentials and receive the XSRF cookie.

  ## A. Start both apps locally

  ```bash
  # Terminal 1 — API on http://localhost:8080 (needs a local Mongo or Atlas URI)
  cd backend
  MONGODB_URI="mongodb://localhost:27017/dashdash?maxPoolSize=50" ./gradlew bootRun

  # Terminal 2 — UI on http://localhost:4200
  cd frontend
  npx ng serve
  ```

  ## B. Health endpoint returns UP

  ```bash
  curl -i http://localhost:8080/api/v1/health
  ```
  Expect: `HTTP/1.1 200` and body `{"status":"UP"}`.

  ## C. XSRF-TOKEN cookie is issued (readable by JS)

  ```bash
  curl -i -c cookies.txt http://localhost:8080/api/v1/health
  ```
  Expect a response header `Set-Cookie: XSRF-TOKEN=...; Path=/; SameSite=Lax`
  (no `HttpOnly` flag — the SPA must read it). Confirm it landed:
  ```bash
  grep XSRF-TOKEN cookies.txt
  ```

  ## D. Credentialed CORS preflight from the UI origin

  ```bash
  curl -i -X OPTIONS http://localhost:8080/api/v1/health \
    -H "Origin: http://localhost:4200" \
    -H "Access-Control-Request-Method: GET"
  ```
  Expect: `HTTP/1.1 200`, `Access-Control-Allow-Origin: http://localhost:4200`,
  `Access-Control-Allow-Credentials: true`.

  ## E. Protected route rejects anonymous callers

  ```bash
  curl -i http://localhost:8080/api/v1/dashboard
  ```
  Expect: `HTTP/1.1 401`.

  ## F. End-to-end in the browser

  Open http://localhost:4200. The landing page shows **API health: UP**.
  In DevTools → Network, the `health` request shows request header
  `Cookie:` and `withCredentials` true; Application → Cookies shows `XSRF-TOKEN`.
  This confirms the credentialed cross-origin round-trip works before auth exists.

  ## G. Optional: build the backend container

  ```bash
  cd backend
  docker build -t dashdash-api:local .
  docker run --rm -p 8080:8080 \
    -e MONGODB_URI="mongodb://host.docker.internal:27017/dashdash?maxPoolSize=50" \
    dashdash-api:local
  curl -s http://localhost:8080/api/v1/health   # -> {"status":"UP"}
  ```

  ## H. Staging DNS / domain setup (one registrable domain)

  1. Register `dashdash.app` on Cloudflare Registrar (same account as Pages).
  2. **UI:** Cloudflare Pages custom domain `dashdash.app` (see
     `deploy-frontend-cloudflare.md`).
  3. **API:** `fly launch --no-deploy` (uses `backend/fly.toml`, app `api-dashdash`),
     then `fly deploy`. Map the subdomain:
     - `fly certs add api.dashdash.app`
     - In Cloudflare DNS add a `CNAME api → api-dashdash.fly.dev`
       (DNS-only / grey-cloud until the Fly cert is issued).
  4. **Cookies across the registrable domain:** set backend secrets
     `fly secrets set COOKIE_DOMAIN=.dashdash.app COOKIE_SECURE=true CORS_ALLOWED_ORIGINS=https://dashdash.app`.
     The session cookie (`DASHSESSION`) and `XSRF-TOKEN` are then scoped to
     `.dashdash.app`, so `dashdash.app` (UI) and `api.dashdash.app` (API) are
     same-site → the session cookie flows on credentialed requests.
  5. Re-run checks B–F against `https://dashdash.app` /
     `https://api.dashdash.app/api/v1/health`.
  ```

- [ ] **Step 7: Validate the deploy configs** — confirm the Dockerfile builds and the TOML/redirects are well-formed:
  ```bash
  cd /c/Users/xamcr/DashDash/backend
  docker build -t dashdash-api:local .
  ```
  Expected: image builds; final line `naming to docker.io/library/dashdash-api:local`. (If Docker is unavailable on the dev host, skip the build and instead confirm the file exists and the `fly.toml` parses with `fly config validate` once `flyctl` is installed.) Then confirm the redirects file:
  ```bash
  cat /c/Users/xamcr/DashDash/frontend/public/_redirects
  ```
  Expected: `/* /index.html 200`.

- [ ] **Step 8: Commit** —
  ```bash
  cd /c/Users/xamcr/DashDash
  git add -A
  git commit -m "chore(deploy): add Dockerfile, fly.toml, Cloudflare Pages config, and skeleton verification docs"
  ```

---

## Plan complete — exit criteria

When all eight tasks are committed you have: an initialized monorepo; a Spring Boot 4.1 API that boots against MongoDB (Testcontainers-verified), serves `GET /api/v1/health → {"status":"UP"}`, enforces credentialed CORS to the UI origin only, issues an `XSRF-TOKEN` cookie, and returns `401` for unauthenticated protected routes; an Angular 22 zoneless app whose every request is credentialed and whose landing page renders live API health; green CI for both halves; and reproducible deploy configs for Fly.io + Cloudflare Pages under the single registrable domain `dashdash.app`. Plan 02 (`2026-07-21-dashdash-02-auth.md`) builds on this baseline — it extends the `SecurityFilterChain`, adds `User`/`Subscription`/auth endpoints, and consumes `ApiError`, the CORS/CSRF config, and `credentialsInterceptor` unchanged.
