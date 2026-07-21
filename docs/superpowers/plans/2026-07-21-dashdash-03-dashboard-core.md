# DashDash — Dashboard Core Implementation Plan (Plan 03 of 06)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement the 3×2 grid with cell CRUD, drag-to-swap, sandboxed iframes with sleep/wake, plan-invariant server persistence, and the app catalog.

**Architecture:** Backend `dashboard` + `catalog` packages add a read/write REST surface over the `Dashboard`/`Cell` model that Plan 02 embeds in `User`; a `DashboardService` enforces the FREE/PREMIUM slot invariants and https-only URL validation on every write, and `reconcileForTier` is the pure downgrade/upgrade transform Plan 05 calls from Stripe webhooks. Frontend adds a `@ngrx/signals` `DashboardStore` (optimistic, 500 ms-debounced persist) driving a CDK drag-swap grid of six single-item drop lists, where each `CellComponent` renders an add-button, an `AdCellComponent` placeholder, or a `SafeFrameComponent` that owns one sandboxed iframe with sleep/wake and staggered mount.

**Tech Stack:** Backend — Java 25, Spring Boot 4.1, Spring Data MongoDB, JUnit 5 + Mockito + Spring Test (standalone MockMvc) + Testcontainers-Mongo. Frontend — Angular 22 (standalone, zoneless, OnPush, signals), `@ngrx/signals` SignalStore, `@angular/cdk` drag-drop + dialog, Vitest.

**Depends on:** 01 (repo, Gradle, Angular scaffold, CORS/CSRF/session, `ApiError`, `GlobalExceptionHandler`, Testcontainers base, `environment.apiBaseUrl`), 02 (`User`, `UserRepository`, `UserService.isPremium`, `DashPrincipal`, embedded model classes `Dashboard` (incl. the `parkedApp` field)/`Cell`/`CellType`/`OpenMode` + `Dashboard.defaultFor(boolean)`, `core/models/enums.ts`, security filter chain, `DashboardStore` siblings).

## Global Constraints

See `2026-07-21-dashdash-00-shared-contract.md` (authoritative for names/types/signatures and global constraints). This plan additionally requires:

- Grid geometry is exactly **3 columns × 2 rows**: `grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr)`. Cells are laid out row-major by slot, so **slot 5 = bottom-right = the ad slot for FREE**.
- Server write invariants (enforced in `DashboardService.updateCells`): a payload always has exactly 6 cells covering slots 0..5 with no duplicates; **FREE** → slot 5 `AD` and exactly one `AD` total; **PREMIUM** → no `AD` cell at all; every `APP` cell's `url` must pass `UrlValidator.isSafeHttpsUrl`; `EMPTY`/`AD` cells persist with `url`/`title`/`catalogAppId`/`iconUrl` cleared to `null`.
- Error mapping: structural DTO violations (wrong cell count via `@Size(min=6,max=6)`) → **400**; semantic invariant/URL violations (`InvalidCellsException`) → **422** with an `ApiError` body.
- The iframe `sandbox` attribute is exactly `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads` (never `allow-top-navigation`); `allow="fullscreen; clipboard-write; autoplay"`; `referrerpolicy="strict-origin-when-cross-origin"`.
- The `AD` cell is native DOM labeled exactly **"Advertisements"** — a placeholder in this plan; Plan 06 drops in `AdCellComponent`. The extension-driven cell states `needs-extension` / `login-in-tab` / `load-failed` are **static stub templates with no behavior**; Plan 04 wires them.
- `DashboardStore.persist()` debounces exactly **500 ms** before calling `DashboardApi.updateCells`; updates are optimistic.
- Frontend commands run from the `frontend/` directory; backend commands from `backend/`. Use `./gradlew` (Git Bash) for backend tests.

---

### Task 1: Dashboard read API (`getDashboard` + DTO mapping + `GET /api/v1/dashboard`)

**Files:**
- Create: `backend/src/main/java/com/dashdash/dashboard/dto/CellDto.java`
- Create: `backend/src/main/java/com/dashdash/dashboard/dto/DashboardDto.java`
- Create: `backend/src/main/java/com/dashdash/dashboard/DashboardService.java`
- Create: `backend/src/main/java/com/dashdash/dashboard/DashboardController.java`
- Test: `backend/src/test/java/com/dashdash/dashboard/DashboardServiceTest.java`

**Interfaces:**
- Consumes: `User` (`getId()`, `getDashboard()`), `UserRepository.findById(String)`, `UserService` (constructor dep, used in Task 3), `DashPrincipal.getUserId()`, `Dashboard` (`getCells()`), `Cell` (getters), `CellType`, `OpenMode`, `Dashboard.defaultFor(boolean)` — all from Plan 02.
- Produces: `record CellDto(int slot, CellType type, String url, String title, String catalogAppId, String iconUrl, OpenMode openMode)`; `record DashboardDto(List<CellDto> cells, CellDto parkedApp)`; `class DashboardService { DashboardDto getDashboard(String userId); }` + package-private static mappers `toDto(Dashboard)`, `toCellDto(Cell)`, `toCell(CellDto)`; `DashboardController` `GET /api/v1/dashboard`.

- [ ] **Step 1: Write the failing test** — create `DashboardServiceTest.java`:
```java
package com.dashdash.dashboard;

import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.auth.UserService;
import com.dashdash.dashboard.dto.DashboardDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock UserRepository userRepository;
    @Mock UserService userService;
    @InjectMocks DashboardService dashboardService;

    @Test
    void getDashboard_returnsFreeDefault_slot5IsAd() {
        User user = new User();
        user.setId("u1");
        user.setDashboard(Dashboard.defaultFor(false)); // FREE default

        when(userRepository.findById("u1")).thenReturn(Optional.of(user));

        DashboardDto dto = dashboardService.getDashboard("u1");

        assertThat(dto.cells()).hasSize(6);
        assertThat(dto.cells().get(5).type()).isEqualTo(CellType.AD);
        assertThat(dto.cells().stream().filter(c -> c.type() == CellType.AD).count()).isEqualTo(1);
        for (int i = 0; i < 5; i++) {
            assertThat(dto.cells().get(i).type()).isEqualTo(CellType.EMPTY);
            assertThat(dto.cells().get(i).slot()).isEqualTo(i);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.DashboardServiceTest"
```
Expected: **compilation failure** — `DashboardService`, `DashboardDto`, `CellDto` do not exist (`cannot find symbol`). This confirms the test drives new code.

- [ ] **Step 3: Write minimal implementation** — create the two DTO records and the service.

`dto/CellDto.java`:
```java
package com.dashdash.dashboard.dto;

import com.dashdash.dashboard.CellType;
import com.dashdash.dashboard.OpenMode;

public record CellDto(int slot, CellType type, String url, String title,
                      String catalogAppId, String iconUrl, OpenMode openMode) {}
```

`dto/DashboardDto.java`:
```java
package com.dashdash.dashboard.dto;

import java.util.List;

public record DashboardDto(List<CellDto> cells, CellDto parkedApp) {}
```

> `parkedApp` is `null` unless a downgrade parked an app (see Task 4 / Canonical Resolutions v2). It is what drives the frontend "parked app" prompt, so it MUST be serialized here — the frontend `Dashboard` interface carries the matching `parkedApp?: Cell`.

`DashboardService.java`:
```java
package com.dashdash.dashboard;

import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.auth.UserService;
import com.dashdash.dashboard.dto.CellDto;
import com.dashdash.dashboard.dto.DashboardDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class DashboardService {

    private final UserRepository userRepository;
    private final UserService userService;

    public DashboardService(UserRepository userRepository, UserService userService) {
        this.userRepository = userRepository;
        this.userService = userService;
    }

    public DashboardDto getDashboard(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + userId));
        return toDto(user.getDashboard());
    }

    static DashboardDto toDto(Dashboard dashboard) {
        List<CellDto> cells = dashboard.getCells().stream()
                .map(DashboardService::toCellDto)
                .toList();
        CellDto parked = dashboard.getParkedApp() == null ? null : toCellDto(dashboard.getParkedApp());
        return new DashboardDto(cells, parked);
    }

    static CellDto toCellDto(Cell c) {
        return new CellDto(c.getSlot(), c.getType(), c.getUrl(), c.getTitle(),
                c.getCatalogAppId(), c.getIconUrl(), c.getOpenMode());
    }

    static Cell toCell(CellDto d) {
        Cell c = new Cell();
        c.setSlot(d.slot());
        c.setType(d.type());
        c.setUrl(d.url());
        c.setTitle(d.title());
        c.setCatalogAppId(d.catalogAppId());
        c.setIconUrl(d.iconUrl());
        c.setOpenMode(d.openMode() == null ? OpenMode.FRAME : d.openMode());
        return c;
    }
}
```

- [ ] **Step 4: Run test to verify it passes** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.DashboardServiceTest"
```
Expected: `BUILD SUCCESSFUL`, 1 test passing.

- [ ] **Step 5: Add the controller** — create `DashboardController.java`:
```java
package com.dashdash.dashboard;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.dashboard.dto.DashboardDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardDto getDashboard(@AuthenticationPrincipal DashPrincipal principal) {
        return dashboardService.getDashboard(principal.getUserId());
    }
}
```

- [ ] **Step 6: Verify full module still compiles** — from `backend/`:
```bash
./gradlew compileJava compileTestJava
```
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit**
```bash
git add backend/src/main/java/com/dashdash/dashboard backend/src/test/java/com/dashdash/dashboard
git commit -m "feat(dashboard): add dashboard read API with Cell/Dashboard DTO mapping"
```

---

### Task 2: URL validation (`common/UrlValidator.isSafeHttpsUrl`)

**Files:**
- Create: `backend/src/main/java/com/dashdash/common/UrlValidator.java`
- Test: `backend/src/test/java/com/dashdash/common/UrlValidatorTest.java`

**Interfaces:**
- Consumes: nothing (pure JDK).
- Produces: `final class UrlValidator { static boolean isSafeHttpsUrl(String url); }` — https scheme only; rejects `javascript:`/`data:`/`blob:`/`file:`/`http:`/other schemes, embedded credentials, hostless URIs, blank/null. Consumed by Task 3 (`updateCells`) and, in spirit, by the frontend `url.util.ts` (Task 9).

- [ ] **Step 1: Write the failing test** — create `UrlValidatorTest.java`:
```java
package com.dashdash.common;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class UrlValidatorTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "https://mail.google.com",
            "https://trello.com/b/abc",
            "https://example.com:8443/path?q=1#frag",
            "HTTPS://Example.COM",
            "  https://news.ycombinator.com  "
    })
    void accepts_safe_https(String url) {
        assertThat(UrlValidator.isSafeHttpsUrl(url)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://example.com",
            "javascript:alert(1)",
            "data:text/plain,hello",
            "blob:https://example.com/uuid",
            "file:///etc/passwd",
            "https://user:pass@example.com",
            "ftp://example.com",
            "//example.com",
            "https://",
            "not a url",
            "https:// example.com"
    })
    void rejects_unsafe(String url) {
        assertThat(UrlValidator.isSafeHttpsUrl(url)).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t"})
    void rejects_blank(String url) {
        assertThat(UrlValidator.isSafeHttpsUrl(url)).isFalse();
    }
}
```

- [ ] **Step 2: Run test to verify it fails** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.common.UrlValidatorTest"
```
Expected: **compilation failure** — `UrlValidator` does not exist (`cannot find symbol`).

- [ ] **Step 3: Write minimal implementation** — create `UrlValidator.java`:
```java
package com.dashdash.common;

import java.net.URI;
import java.net.URISyntaxException;

public final class UrlValidator {

    private UrlValidator() {}

    /**
     * True only for absolute https URLs with a real host, no embedded credentials,
     * and no dangerous schemes (javascript:/data:/blob:/file:/http:...).
     */
    public static boolean isSafeHttpsUrl(String url) {
        if (url == null) {
            return false;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        final URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException e) {
            return false;
        }
        String scheme = uri.getScheme();
        if (scheme == null || !scheme.equalsIgnoreCase("https")) {
            return false;
        }
        if (uri.getRawUserInfo() != null) { // reject user:pass@host
            return false;
        }
        String host = uri.getHost();
        return host != null && !host.isBlank();
    }
}
```

- [ ] **Step 4: Run test to verify it passes** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.common.UrlValidatorTest"
```
Expected: `BUILD SUCCESSFUL`, all parameterized cases green (21 invocations).

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/dashdash/common/UrlValidator.java backend/src/test/java/com/dashdash/common/UrlValidatorTest.java
git commit -m "feat(common): add https-only UrlValidator with exhaustive tests"
```

---

### Task 3: Dashboard write API (`updateCells` + invariants + `PUT /api/v1/dashboard/cells`)

**Files:**
- Create: `backend/src/main/java/com/dashdash/dashboard/dto/UpdateCellsRequest.java`
- Create: `backend/src/main/java/com/dashdash/dashboard/InvalidCellsException.java`
- Modify: `backend/src/main/java/com/dashdash/dashboard/DashboardService.java` (add `updateCells` + private validators/normalizer)
- Modify: `backend/src/main/java/com/dashdash/dashboard/DashboardController.java` (add `PUT /cells` + local `@ExceptionHandler`)
- Test: `backend/src/test/java/com/dashdash/dashboard/DashboardServiceUpdateTest.java`
- Test: `backend/src/test/java/com/dashdash/dashboard/DashboardControllerTest.java`

**Interfaces:**
- Consumes: `UserService.isPremium(User)`, `UserRepository.findById/save`, `UrlValidator.isSafeHttpsUrl` (Task 2), `Cell`/`CellType`/`OpenMode`/`Dashboard` (Plan 02), `DashPrincipal` (Plan 02), `ApiError(String code, String message)` (Plan 01).
- Produces: `record UpdateCellsRequest(@Size(min=6,max=6) @Valid List<CellDto> cells)`; `class InvalidCellsException extends RuntimeException`; `DashboardService.updateCells(String userId, List<CellDto> cells): DashboardDto`; `DashboardController` `PUT /api/v1/dashboard/cells`.

- [ ] **Step 1: Write the failing service test** — create `DashboardServiceUpdateTest.java`:
```java
package com.dashdash.dashboard;

import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.auth.UserService;
import com.dashdash.dashboard.dto.CellDto;
import com.dashdash.dashboard.dto.DashboardDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceUpdateTest {

    @Mock UserRepository userRepository;
    @Mock UserService userService;
    @InjectMocks DashboardService service;

    private User userWith(Dashboard d) {
        User u = new User();
        u.setId("u1");
        u.setDashboard(d);
        return u;
    }

    private static CellDto empty(int slot) {
        return new CellDto(slot, CellType.EMPTY, null, null, null, null, OpenMode.FRAME);
    }

    @Test
    void updateCells_validFreeLayout_persistsAndReturns() {
        User user = userWith(Dashboard.defaultFor(false));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(false);

        List<CellDto> cells = new ArrayList<>();
        cells.add(new CellDto(0, CellType.APP, "https://mail.google.com", "Gmail", null, null, OpenMode.FRAME));
        for (int i = 1; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.AD, null, null, null, null, OpenMode.FRAME));

        DashboardDto dto = service.updateCells("u1", cells);

        assertThat(dto.cells()).hasSize(6);
        assertThat(dto.cells().get(0).type()).isEqualTo(CellType.APP);
        assertThat(dto.cells().get(0).url()).isEqualTo("https://mail.google.com");
        assertThat(dto.cells().get(5).type()).isEqualTo(CellType.AD);
        verify(userRepository).save(user);
    }

    @Test
    void updateCells_validPremiumLayout_allowsAppInSlot5_noAd() {
        User user = userWith(Dashboard.defaultFor(true));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(true);

        List<CellDto> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.APP, "https://trello.com", "Trello", null, null, OpenMode.FRAME));

        DashboardDto dto = service.updateCells("u1", cells);

        assertThat(dto.cells().get(5).type()).isEqualTo(CellType.APP);
        assertThat(dto.cells().stream().noneMatch(c -> c.type() == CellType.AD)).isTrue();
    }

    @Test
    void updateCells_freeWithAppInSlot5_throws() {
        User user = userWith(Dashboard.defaultFor(false));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(false);

        List<CellDto> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.APP, "https://trello.com", "Trello", null, null, OpenMode.FRAME));

        assertThatThrownBy(() -> service.updateCells("u1", cells))
                .isInstanceOf(InvalidCellsException.class);
    }

    @Test
    void updateCells_badUrl_throws() {
        User user = userWith(Dashboard.defaultFor(false));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(false);

        List<CellDto> cells = new ArrayList<>();
        cells.add(new CellDto(0, CellType.APP, "javascript:alert(1)", "x", null, null, OpenMode.FRAME));
        for (int i = 1; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.AD, null, null, null, null, OpenMode.FRAME));

        assertThatThrownBy(() -> service.updateCells("u1", cells))
                .isInstanceOf(InvalidCellsException.class);
    }
}
```

- [ ] **Step 2: Run test to verify it fails** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.DashboardServiceUpdateTest"
```
Expected: **compilation failure** — `InvalidCellsException` and `DashboardService.updateCells` do not exist.

- [ ] **Step 3: Create the exception** — `InvalidCellsException.java`:
```java
package com.dashdash.dashboard;

/** Thrown when a cell payload violates the FREE/PREMIUM slot invariants or URL rules. Mapped to HTTP 422. */
public class InvalidCellsException extends RuntimeException {
    public InvalidCellsException(String message) {
        super(message);
    }
}
```

- [ ] **Step 4: Add `updateCells` + validators to `DashboardService`** — append these members inside the existing `DashboardService` class (after `getDashboard`), and add the imports shown:
```java
// add to imports at top of DashboardService.java:
import com.dashdash.common.UrlValidator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
```
```java
    public DashboardDto updateCells(String userId, List<CellDto> cells) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + userId));
        boolean premium = userService.isPremium(user);

        validateStructure(cells);
        validateInvariants(cells, premium);

        List<Cell> newCells = new ArrayList<>(6);
        cells.stream()
                .sorted(Comparator.comparingInt(CellDto::slot))
                .forEach(d -> newCells.add(normalize(d)));

        Dashboard dashboard = user.getDashboard();
        dashboard.setCells(newCells);
        dashboard.setParkedApp(null); // a cells PUT is the resolution of the parked-app prompt: clear it so the prompt does not re-appear on reload
        userRepository.save(user);
        return toDto(dashboard);
    }

    private static void validateStructure(List<CellDto> cells) {
        if (cells == null || cells.size() != 6) {
            throw new InvalidCellsException("Dashboard must have exactly 6 cells");
        }
        Set<Integer> seen = new HashSet<>();
        for (CellDto c : cells) {
            int s = c.slot();
            if (s < 0 || s > 5) {
                throw new InvalidCellsException("Slot out of range: " + s);
            }
            if (!seen.add(s)) {
                throw new InvalidCellsException("Duplicate slot: " + s);
            }
            if (c.type() == null) {
                throw new InvalidCellsException("Cell type is required at slot " + s);
            }
        }
    }

    private static void validateInvariants(List<CellDto> cells, boolean premium) {
        long adCount = cells.stream().filter(c -> c.type() == CellType.AD).count();
        CellDto slot5 = cells.stream().filter(c -> c.slot() == 5).findFirst().orElseThrow();

        if (premium) {
            if (adCount > 0) {
                throw new InvalidCellsException("Premium dashboards cannot contain an AD cell");
            }
        } else {
            if (slot5.type() != CellType.AD) {
                throw new InvalidCellsException("Free tier requires slot 5 to be the AD cell");
            }
            if (adCount != 1) {
                throw new InvalidCellsException("Free tier must have exactly one AD cell (slot 5)");
            }
        }

        for (CellDto c : cells) {
            if (c.type() == CellType.APP && !UrlValidator.isSafeHttpsUrl(c.url())) {
                throw new InvalidCellsException("APP cell at slot " + c.slot() + " has an invalid URL");
            }
        }
    }

    private static Cell normalize(CellDto d) {
        Cell c = new Cell();
        c.setSlot(d.slot());
        c.setType(d.type());
        c.setOpenMode(d.openMode() == null ? OpenMode.FRAME : d.openMode());
        if (d.type() == CellType.APP) {
            c.setUrl(d.url());
            c.setTitle(d.title());
            c.setCatalogAppId(d.catalogAppId());
            c.setIconUrl(d.iconUrl());
        }
        // AD / EMPTY: url/title/catalogAppId/iconUrl left null (cleared)
        return c;
    }
```

- [ ] **Step 5: Run the service test to verify it passes** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.DashboardServiceUpdateTest"
```
Expected: `BUILD SUCCESSFUL`, 4 tests passing.

- [ ] **Step 6: Write the failing controller test** — create `DashboardControllerTest.java` (standalone MockMvc, hand-built JSON so no Jackson-version assumptions, custom `DashPrincipal` resolver):
```java
package com.dashdash.dashboard;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.dashboard.dto.CellDto;
import com.dashdash.dashboard.dto.DashboardDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardControllerTest {

    DashboardService service = mock(DashboardService.class);
    MockMvc mockMvc;

    @BeforeEach
    void setup() {
        HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter p) {
                return DashPrincipal.class.isAssignableFrom(p.getParameterType());
            }
            @Override
            public Object resolveArgument(MethodParameter p, ModelAndViewContainer m,
                                          NativeWebRequest w, WebDataBinderFactory b) {
                return new DashPrincipal() {
                    @Override public String getUserId() { return "u1"; }
                    @Override public String getEmail() { return "u1@example.com"; }
                };
            }
        };
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(new DashboardController(service))
                .setCustomArgumentResolvers(principalResolver)
                .setValidator(validator)
                .build();
    }

    private static String cell(int slot, String type) {
        return "{\"slot\":" + slot + ",\"type\":\"" + type + "\",\"url\":null,\"title\":null,"
                + "\"catalogAppId\":null,\"iconUrl\":null,\"openMode\":\"FRAME\"}";
    }

    private static String body(List<String> cells) {
        return "{\"cells\":[" + String.join(",", cells) + "]}";
    }

    @Test
    void put_wrongSlotCount_returns400() throws Exception {
        List<String> five = IntStream.range(0, 5).mapToObj(i -> cell(i, "EMPTY")).collect(Collectors.toList());
        mockMvc.perform(put("/api/v1/dashboard/cells")
                        .contentType("application/json").content(body(five)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void put_validFreeLayout_returns200() throws Exception {
        List<String> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, "EMPTY"));
        cells.add(cell(5, "AD"));
        List<CellDto> returned = new ArrayList<>();
        for (int i = 0; i < 5; i++) returned.add(new CellDto(i, CellType.EMPTY, null, null, null, null, OpenMode.FRAME));
        returned.add(new CellDto(5, CellType.AD, null, null, null, null, OpenMode.FRAME));
        when(service.updateCells(eq("u1"), any())).thenReturn(new DashboardDto(returned, null));

        mockMvc.perform(put("/api/v1/dashboard/cells")
                        .contentType("application/json").content(body(cells)))
                .andExpect(status().isOk());
    }

    @Test
    void put_invariantViolation_returns422() throws Exception {
        List<String> cells = IntStream.range(0, 6).mapToObj(i -> cell(i, "EMPTY")).collect(Collectors.toList());
        when(service.updateCells(eq("u1"), any())).thenThrow(new InvalidCellsException("bad"));

        mockMvc.perform(put("/api/v1/dashboard/cells")
                        .contentType("application/json").content(body(cells)))
                .andExpect(status().isUnprocessableEntity());
    }
}
```

- [ ] **Step 7: Run controller test to verify it fails** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.DashboardControllerTest"
```
Expected: **compilation failure** — `UpdateCellsRequest` / the `PUT` mapping / the exception handler don't exist yet.

- [ ] **Step 8: Create the request DTO** — `dto/UpdateCellsRequest.java`:
```java
package com.dashdash.dashboard.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateCellsRequest(@Size(min = 6, max = 6) @Valid List<CellDto> cells) {}
```

- [ ] **Step 9: Add the PUT endpoint + 422 handler to `DashboardController`** — add these imports and members to the existing controller class:
```java
// add to imports:
import com.dashdash.common.ApiError;
import com.dashdash.dashboard.dto.UpdateCellsRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
```
```java
    @PutMapping("/cells")
    public DashboardDto updateCells(@AuthenticationPrincipal DashPrincipal principal,
                                    @Valid @RequestBody UpdateCellsRequest request) {
        return dashboardService.updateCells(principal.getUserId(), request.cells());
    }

    @ExceptionHandler(InvalidCellsException.class)
    public ResponseEntity<ApiError> handleInvalidCells(InvalidCellsException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ApiError("invalid_cells", ex.getMessage()));
    }
```

- [ ] **Step 10: Run the full dashboard suite to verify green** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.*"
```
Expected: `BUILD SUCCESSFUL` — `DashboardServiceTest` (1), `DashboardServiceUpdateTest` (4), `DashboardControllerTest` (3) all pass.

- [ ] **Step 11: Commit**
```bash
git add backend/src/main/java/com/dashdash/dashboard backend/src/test/java/com/dashdash/dashboard
git commit -m "feat(dashboard): add PUT /dashboard/cells with FREE/PREMIUM invariants and 422 mapping"
```

---

### Task 4: Tier reconciliation (`DashboardService.reconcileForTier`)

**Files:**
- Modify: `backend/src/main/java/com/dashdash/dashboard/DashboardService.java` (add `reconcileForTier` + copy helpers)
- Test: `backend/src/test/java/com/dashdash/dashboard/DashboardReconcileTest.java`

**Interfaces:**
- Consumes: `Dashboard` (`getCells()`/`setCells()`, `getParkedApp()`/`setParkedApp()` — the Plan-02 model field), `Cell` (getters/setters), `CellType`, `OpenMode` (Plan 02).
- Produces: `Dashboard reconcileForTier(Dashboard current, boolean premium)` (the contract-pinned signature; Plan 05 downgrade consumes it). On a downgrade that displaces the slot-5 app with no free slot, it sets that app on the returned `Dashboard.parkedApp` (never discarded) so Plan 05/UI can prompt about the parked app; the whole `Dashboard` — including `parkedApp` — is what gets returned and persisted verbatim.

> **Downgrade to FREE:** if slot 5 holds an `APP`, move it to the first `EMPTY` slot among 0..4 and set slot 5 to `AD`; if no `EMPTY` slot exists, set slot 5 to `AD` and store the displaced app on the returned `Dashboard.parkedApp` (never discarded). If slot 5 is already `AD`/`EMPTY`, just force it to `AD` and leave `parkedApp` null.
> **Upgrade to PREMIUM:** if slot 5 is `AD`, clear it to `EMPTY`; leave any existing `parkedApp` untouched.

- [ ] **Step 1: Write the failing test** — create `DashboardReconcileTest.java`:
```java
package com.dashdash.dashboard;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardReconcileTest {

    private final DashboardService service = new DashboardService(null, null);

    private static Cell cell(int slot, CellType type, String url) {
        Cell c = new Cell();
        c.setSlot(slot);
        c.setType(type);
        c.setUrl(url);
        c.setOpenMode(OpenMode.FRAME);
        return c;
    }

    private static Dashboard board(List<Cell> cells) {
        Dashboard d = new Dashboard();
        d.setCells(cells);
        return d;
    }

    @Test
    void downgrade_movesSlot5AppToFirstEmpty_andSetsAd() {
        List<Cell> cells = new ArrayList<>();
        cells.add(cell(0, CellType.EMPTY, null));       // first empty
        cells.add(cell(1, CellType.APP, "https://a.com"));
        cells.add(cell(2, CellType.EMPTY, null));
        cells.add(cell(3, CellType.EMPTY, null));
        cells.add(cell(4, CellType.EMPTY, null));
        cells.add(cell(5, CellType.APP, "https://slot5.com"));

        Dashboard result = service.reconcileForTier(board(cells), false);

        assertThat(result.getParkedApp()).isNull();
        assertThat(result.getCells().get(0).getType()).isEqualTo(CellType.APP);
        assertThat(result.getCells().get(0).getUrl()).isEqualTo("https://slot5.com");
        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.AD);
        assertThat(result.getCells().get(5).getUrl()).isNull();
    }

    @Test
    void downgrade_noEmpty_parksDisplacedApp_andSetsAd() {
        List<Cell> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, CellType.APP, "https://app" + i + ".com"));
        cells.add(cell(5, CellType.APP, "https://slot5.com"));

        Dashboard result = service.reconcileForTier(board(cells), false);

        // No empty slot: the displaced slot-5 app is parked on the Dashboard, never discarded.
        assertThat(result.getParkedApp()).isNotNull();
        assertThat(result.getParkedApp().getUrl()).isEqualTo("https://slot5.com");
        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.AD);
        for (int i = 0; i < 5; i++) {
            assertThat(result.getCells().get(i).getType()).isEqualTo(CellType.APP);
            assertThat(result.getCells().get(i).getUrl()).isEqualTo("https://app" + i + ".com");
        }
    }

    @Test
    void downgrade_slot5AlreadyAd_isUnchanged_noPark() {
        List<Cell> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, CellType.EMPTY, null));
        cells.add(cell(5, CellType.AD, null));

        Dashboard result = service.reconcileForTier(board(cells), false);

        assertThat(result.getParkedApp()).isNull();
        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.AD);
    }

    @Test
    void upgrade_turnsSlot5AdIntoEmpty_leavesParkedAppUntouched() {
        List<Cell> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, CellType.EMPTY, null));
        cells.add(cell(5, CellType.AD, null));

        Dashboard result = service.reconcileForTier(board(cells), true);

        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.EMPTY);
        assertThat(result.getCells().get(5).getUrl()).isNull();
        assertThat(result.getParkedApp()).isNull();
    }
}
```

- [ ] **Step 2: Run test to verify it fails** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.DashboardReconcileTest"
```
Expected: **compilation failure** — `reconcileForTier` does not exist.

- [ ] **Step 3: Add reconcile methods to `DashboardService`** — add these members (the `java.util.ArrayList`, `java.util.Comparator`, `java.util.List` imports added in Task 3 already suffice):
```java
    public Dashboard reconcileForTier(Dashboard current, boolean premium) {
        List<Cell> cells = new ArrayList<>(6);
        for (Cell c : current.getCells()) {
            cells.add(copyOf(c));
        }
        cells.sort(Comparator.comparingInt(Cell::getSlot));

        // Carry any existing parked app across unchanged; only a no-free-slot downgrade overwrites it.
        Cell parked = current.getParkedApp() == null ? null : copyOf(current.getParkedApp());
        Cell slot5 = cells.get(5);

        if (premium) {
            if (slot5.getType() == CellType.AD) {
                clearContent(slot5);
                slot5.setType(CellType.EMPTY);
            }
            // parkedApp is left untouched on upgrade.
        } else {
            if (slot5.getType() == CellType.APP) {
                int target = firstEmptySlot(cells);
                if (target >= 0) {
                    copyContentInto(cells.get(target), slot5);
                } else {
                    parked = copyOf(slot5); // no free slot: park the displaced app, never discard it
                }
            }
            clearContent(slot5);
            slot5.setType(CellType.AD);
        }

        Dashboard result = new Dashboard();
        result.setCells(cells);
        result.setParkedApp(parked); // whole Dashboard, including parkedApp, is what gets returned and persisted
        return result;
    }

    private static int firstEmptySlot(List<Cell> cells) {
        for (int i = 0; i < 5; i++) {
            if (cells.get(i).getType() == CellType.EMPTY) {
                return i;
            }
        }
        return -1;
    }

    private static Cell copyOf(Cell c) {
        Cell n = new Cell();
        n.setSlot(c.getSlot());
        n.setType(c.getType());
        n.setUrl(c.getUrl());
        n.setTitle(c.getTitle());
        n.setCatalogAppId(c.getCatalogAppId());
        n.setIconUrl(c.getIconUrl());
        n.setOpenMode(c.getOpenMode());
        return n;
    }

    private static void copyContentInto(Cell dest, Cell src) {
        dest.setType(src.getType());
        dest.setUrl(src.getUrl());
        dest.setTitle(src.getTitle());
        dest.setCatalogAppId(src.getCatalogAppId());
        dest.setIconUrl(src.getIconUrl());
        dest.setOpenMode(src.getOpenMode());
        // dest.slot deliberately unchanged
    }

    private static void clearContent(Cell c) {
        c.setUrl(null);
        c.setTitle(null);
        c.setCatalogAppId(null);
        c.setIconUrl(null);
        c.setOpenMode(OpenMode.FRAME);
    }
```

- [ ] **Step 4: Run test to verify it passes** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.dashboard.DashboardReconcileTest"
```
Expected: `BUILD SUCCESSFUL`, 4 tests passing.

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/dashdash/dashboard/DashboardService.java backend/src/test/java/com/dashdash/dashboard/DashboardReconcileTest.java
git commit -m "feat(dashboard): add reconcileForTier with parkedApp for upgrade/downgrade slot handling"
```

---

### Task 5: Catalog (`CatalogApp` document, repository, service, controller, seeder)

**Files:**
- Create: `backend/src/main/java/com/dashdash/catalog/Compatibility.java`
- Create: `backend/src/main/java/com/dashdash/catalog/CatalogApp.java`
- Create: `backend/src/main/java/com/dashdash/catalog/CatalogAppRepository.java`
- Create: `backend/src/main/java/com/dashdash/catalog/dto/CatalogAppDto.java`
- Create: `backend/src/main/java/com/dashdash/catalog/CatalogService.java`
- Create: `backend/src/main/java/com/dashdash/catalog/CatalogController.java`
- Create: `backend/src/main/java/com/dashdash/catalog/CatalogSeeder.java`
- Test: `backend/src/test/java/com/dashdash/catalog/CatalogSeederTest.java`
- Test: `backend/src/test/java/com/dashdash/catalog/CatalogControllerTest.java`

**Interfaces:**
- Consumes: MongoDB (`@Document`, `MongoRepository`), Testcontainers-Mongo base from Plan 01, `ApplicationRunner`.
- Produces: `enum Compatibility { FRAMES_CLEAN, NEEDS_EXTENSION, LOGIN_IN_TAB, REFUSES_FRAME }`; `@Document("catalog_apps") class CatalogApp`; `interface CatalogAppRepository extends MongoRepository<CatalogApp,String> { List<CatalogApp> findAllByOrderByCategoryAscOrderAsc(); }`; `record CatalogAppDto(...)`; `class CatalogService { List<CatalogAppDto> list(); }`; `CatalogController` `GET /api/v1/catalog` (public); `CatalogSeeder` (idempotent `ApplicationRunner`, ~8 apps) with a package-visible static `List<CatalogApp> seedData()`.

- [ ] **Step 1: Create the enum, document, repository, DTO** (no test yet — these are the types the tests reference).

`Compatibility.java`:
```java
package com.dashdash.catalog;

public enum Compatibility { FRAMES_CLEAN, NEEDS_EXTENSION, LOGIN_IN_TAB, REFUSES_FRAME }
```

`CatalogApp.java`:
```java
package com.dashdash.catalog;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("catalog_apps")
public class CatalogApp {

    @Id
    private String id;
    private String name;
    private String url;
    private String iconUrl;
    private String category;
    private int order;
    private Compatibility compatibility;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getIconUrl() { return iconUrl; }
    public void setIconUrl(String iconUrl) { this.iconUrl = iconUrl; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }
    public Compatibility getCompatibility() { return compatibility; }
    public void setCompatibility(Compatibility compatibility) { this.compatibility = compatibility; }
}
```

`CatalogAppRepository.java`:
```java
package com.dashdash.catalog;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CatalogAppRepository extends MongoRepository<CatalogApp, String> {
    List<CatalogApp> findAllByOrderByCategoryAscOrderAsc();
}
```

`dto/CatalogAppDto.java`:
```java
package com.dashdash.catalog.dto;

import com.dashdash.catalog.Compatibility;

public record CatalogAppDto(String id, String name, String url, String iconUrl,
                            String category, int order, Compatibility compatibility) {}
```

- [ ] **Step 2: Write the failing seeder test** — create `CatalogSeederTest.java` (Testcontainers-Mongo, `@DataMongoTest` slice):
```java
package com.dashdash.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataMongoTest
class CatalogSeederTest {

    @Container
    @ServiceConnection
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

    @Autowired
    CatalogAppRepository repository;

    @Test
    void seeder_isIdempotent() {
        CatalogSeeder seeder = new CatalogSeeder(repository);
        seeder.run(null);
        seeder.run(null); // run twice — must not duplicate

        long expected = CatalogSeeder.seedData().size();
        assertThat(repository.count()).isEqualTo(expected);
        assertThat(expected).isGreaterThanOrEqualTo(8);
    }

    @Test
    void repository_returnsOrderedByCategoryThenOrder() {
        new CatalogSeeder(repository).run(null);

        List<CatalogApp> apps = repository.findAllByOrderByCategoryAscOrderAsc();
        assertThat(apps).isNotEmpty();
        for (int i = 1; i < apps.size(); i++) {
            CatalogApp prev = apps.get(i - 1);
            CatalogApp cur = apps.get(i);
            int catCmp = prev.getCategory().compareTo(cur.getCategory());
            assertThat(catCmp).isLessThanOrEqualTo(0);
            if (catCmp == 0) {
                assertThat(prev.getOrder()).isLessThanOrEqualTo(cur.getOrder());
            }
        }
    }
}
```

- [ ] **Step 3: Run test to verify it fails** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.catalog.CatalogSeederTest"
```
Expected: **compilation failure** — `CatalogSeeder` does not exist.

- [ ] **Step 4: Write the seeder** — create `CatalogSeeder.java` (fixed ids ⇒ idempotent; ~8 apps across categories with realistic compatibility values):
```java
package com.dashdash.catalog;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CatalogSeeder implements ApplicationRunner {

    private final CatalogAppRepository repository;

    public CatalogSeeder(CatalogAppRepository repository) {
        this.repository = repository;
    }

    static List<CatalogApp> seedData() {
        return List.of(
                app("gmail", "Gmail", "https://mail.google.com",
                        "https://mail.google.com/favicon.ico", "Email", 0, Compatibility.LOGIN_IN_TAB),
                app("outlook", "Outlook", "https://outlook.office.com/mail",
                        "https://outlook.office.com/favicon.ico", "Email", 1, Compatibility.LOGIN_IN_TAB),
                app("trello", "Trello", "https://trello.com",
                        "https://trello.com/favicon.ico", "Productivity", 0, Compatibility.NEEDS_EXTENSION),
                app("notion", "Notion", "https://www.notion.so",
                        "https://www.notion.so/favicon.ico", "Productivity", 1, Compatibility.NEEDS_EXTENSION),
                app("todoist", "Todoist", "https://app.todoist.com",
                        "https://todoist.com/favicon.ico", "Productivity", 2, Compatibility.NEEDS_EXTENSION),
                app("gcal", "Google Calendar", "https://calendar.google.com",
                        "https://calendar.google.com/favicon.ico", "Productivity", 3, Compatibility.REFUSES_FRAME),
                app("hackernews", "Hacker News", "https://news.ycombinator.com",
                        "https://news.ycombinator.com/favicon.ico", "News", 0, Compatibility.FRAMES_CLEAN),
                app("youtube", "YouTube", "https://www.youtube.com",
                        "https://www.youtube.com/favicon.ico", "Media", 0, Compatibility.NEEDS_EXTENSION)
        );
    }

    private static CatalogApp app(String id, String name, String url, String iconUrl,
                                  String category, int order, Compatibility compatibility) {
        CatalogApp a = new CatalogApp();
        a.setId(id);
        a.setName(name);
        a.setUrl(url);
        a.setIconUrl(iconUrl);
        a.setCategory(category);
        a.setOrder(order);
        a.setCompatibility(compatibility);
        return a;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (CatalogApp a : seedData()) {
            if (!repository.existsById(a.getId())) {
                repository.save(a);
            }
        }
    }
}
```

- [ ] **Step 5: Run seeder test to verify it passes** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.catalog.CatalogSeederTest"
```
Expected: `BUILD SUCCESSFUL` (Docker required for Testcontainers), 2 tests passing.

- [ ] **Step 6: Write the failing controller test** — create `CatalogControllerTest.java` (standalone MockMvc over a mocked `CatalogService`):
```java
package com.dashdash.catalog;

import com.dashdash.catalog.dto.CatalogAppDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CatalogControllerTest {

    CatalogService catalogService = mock(CatalogService.class);
    MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.standaloneSetup(new CatalogController(catalogService)).build();
    }

    @Test
    void returnsOrderedList() throws Exception {
        when(catalogService.list()).thenReturn(List.of(
                new CatalogAppDto("gmail", "Gmail", "https://mail.google.com", "i", "Email", 0, Compatibility.LOGIN_IN_TAB),
                new CatalogAppDto("hackernews", "Hacker News", "https://news.ycombinator.com", "i", "News", 0, Compatibility.FRAMES_CLEAN)
        ));

        mockMvc.perform(get("/api/v1/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("gmail"))
                .andExpect(jsonPath("$[0].compatibility").value("LOGIN_IN_TAB"))
                .andExpect(jsonPath("$[1].category").value("News"));
    }
}
```

- [ ] **Step 7: Run controller test to verify it fails** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.catalog.CatalogControllerTest"
```
Expected: **compilation failure** — `CatalogService` / `CatalogController` do not exist.

- [ ] **Step 8: Write the service and controller.**

`CatalogService.java`:
```java
package com.dashdash.catalog;

import com.dashdash.catalog.dto.CatalogAppDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CatalogService {

    private final CatalogAppRepository repository;

    public CatalogService(CatalogAppRepository repository) {
        this.repository = repository;
    }

    public List<CatalogAppDto> list() {
        return repository.findAllByOrderByCategoryAscOrderAsc().stream()
                .map(a -> new CatalogAppDto(a.getId(), a.getName(), a.getUrl(), a.getIconUrl(),
                        a.getCategory(), a.getOrder(), a.getCompatibility()))
                .toList();
    }
}
```

`CatalogController.java`:
```java
package com.dashdash.catalog;

import com.dashdash.catalog.dto.CatalogAppDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/catalog")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public List<CatalogAppDto> list() {
        return catalogService.list();
    }
}
```

- [ ] **Step 9: Run the whole catalog suite** — from `backend/`:
```bash
./gradlew test --tests "com.dashdash.catalog.*"
```
Expected: `BUILD SUCCESSFUL` — `CatalogSeederTest` (2) + `CatalogControllerTest` (1) pass.

> **Security note (already provided by Plan 01/02):** `/api/v1/catalog` is in the `permitAll` list of the security filter chain. No change required here; if a later smoke test shows 401, confirm `/catalog` is listed in `SecurityConfig`.

- [ ] **Step 10: Commit**
```bash
git add backend/src/main/java/com/dashdash/catalog backend/src/test/java/com/dashdash/catalog
git commit -m "feat(catalog): add CatalogApp document, repository, service, controller, and idempotent seeder"
```

---

### Task 6: Frontend data layer (models, API services, `DashboardStore`)

**Files:**
- Create: `frontend/src/app/core/models/dashboard.model.ts`
- Create: `frontend/src/app/core/models/catalog.model.ts`
- Create: `frontend/src/app/core/api/dashboard.api.ts`
- Create: `frontend/src/app/core/api/catalog.api.ts`
- Create: `frontend/src/app/stores/dashboard.store.ts`
- Test: `frontend/src/app/stores/dashboard.store.spec.ts`

**Interfaces:**
- Consumes: `core/models/enums.ts` (`CellType`, `OpenMode`, `Compatibility` — Plan 02), `environment.apiBaseUrl` (Plan 01), `HttpClient`, `@ngrx/signals`.
- Produces: `interface Cell`, `interface Dashboard` (dashboard.model.ts); `interface CatalogApp` (catalog.model.ts); `DashboardApi` (`get()`, `updateCells(cells)`); `CatalogApi` (`list()`); `DashboardStore` (state `cells`/`parkedApp`/`loaded`/`saving`/`error`; computed `adSlotIndex`=5/`filledCount`; methods `load`/`swap`/`setCell`/`clearCell`/`persist`/`resolveParked`).

> **Note:** `ads.model.ts` (`AdConfig`) is **owned solely by Plan 06** — Plan 03 does not create it and does not need `AdConfig` (the `AD` cell is a native-DOM placeholder here). Plan 06 defines `AdConfig` when it drops in `AdCellComponent`/`AdsApi`.

- [ ] **Step 1: Create the two model interfaces.**

`dashboard.model.ts`:
```ts
import { CellType, OpenMode } from './enums';

export interface Cell {
  slot: number;
  type: CellType;
  url?: string;
  title?: string;
  catalogAppId?: string;
  iconUrl?: string;
  openMode: OpenMode;
}

export interface Dashboard {
  cells: Cell[]; // always length 6, indexed by slot 0..5
  parkedApp?: Cell; // set only after a downgrade with no empty slot; the user is prompted to place or discard it
}
```

`catalog.model.ts`:
```ts
import { Compatibility } from './enums';

export interface CatalogApp {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
  category: string;
  order: number;
  compatibility: Compatibility;
}
```

- [ ] **Step 2: Create the two API services.**

`dashboard.api.ts`:
```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cell, Dashboard } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/dashboard`;

  get(): Observable<Dashboard> {
    return this.http.get<Dashboard>(this.base);
  }

  updateCells(cells: Cell[]): Observable<Dashboard> {
    return this.http.put<Dashboard>(`${this.base}/cells`, { cells });
  }
}
```

`catalog.api.ts`:
```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CatalogApp } from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private http = inject(HttpClient);

  list(): Observable<CatalogApp[]> {
    return this.http.get<CatalogApp[]>(`${environment.apiBaseUrl}/catalog`);
  }
}
```

- [ ] **Step 3: Write the failing store test** — create `dashboard.store.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardStore } from './dashboard.store';
import { DashboardApi } from '../core/api/dashboard.api';
import { Cell } from '../core/models/dashboard.model';

function freeCells(): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < 5; i++) cells.push({ slot: i, type: 'EMPTY', openMode: 'FRAME' });
  cells.push({ slot: 5, type: 'AD', openMode: 'FRAME' });
  return cells;
}

describe('DashboardStore', () => {
  let apiMock: { get: ReturnType<typeof vi.fn>; updateCells: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = {
      get: vi.fn().mockReturnValue(of({ cells: freeCells() })),
      updateCells: vi.fn().mockImplementation((cells: Cell[]) => of({ cells })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApi, useValue: apiMock },
      ],
    });
  });

  it('swap swaps two slots (optimistic)', () => {
    const store = TestBed.inject(DashboardStore);
    const cells = freeCells();
    cells[0] = { slot: 0, type: 'APP', url: 'https://a.com', openMode: 'FRAME' };
    apiMock.get.mockReturnValue(of({ cells }));
    store.load();

    store.swap(0, 1);

    expect(store.cells()[1].type).toBe('APP');
    expect(store.cells()[1].url).toBe('https://a.com');
    expect(store.cells()[1].slot).toBe(1);
    expect(store.cells()[0].type).toBe('EMPTY');
    expect(store.cells()[0].slot).toBe(0);
  });

  it('persist debounces then calls the API once', () => {
    vi.useFakeTimers();
    const store = TestBed.inject(DashboardStore);
    store.load();

    store.persist();
    store.persist();
    store.persist();
    expect(apiMock.updateCells).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(apiMock.updateCells).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('setCell fills a slot and clearCell empties it', () => {
    const store = TestBed.inject(DashboardStore);
    store.load();

    store.setCell({ slot: 2, type: 'APP', url: 'https://x.com', title: 'X', openMode: 'FRAME' });
    expect(store.cells()[2].type).toBe('APP');
    expect(store.cells()[2].url).toBe('https://x.com');
    expect(store.filledCount()).toBe(2); // slot2 APP + slot5 AD

    store.clearCell(2);
    expect(store.cells()[2].type).toBe('EMPTY');
    expect(store.cells()[2].url).toBeUndefined();
  });

  it('exposes adSlotIndex of 5', () => {
    const store = TestBed.inject(DashboardStore);
    expect(store.adSlotIndex()).toBe(5);
  });
});
```

- [ ] **Step 4: Run test to verify it fails** — from `frontend/`:
```bash
npx vitest run src/app/stores/dashboard.store.spec.ts
```
Expected: **failure** — cannot resolve `./dashboard.store` (module does not exist).

- [ ] **Step 5: Write the store** — create `dashboard.store.ts`:
```ts
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, debounceTime, pipe, switchMap, tap } from 'rxjs';
import { DashboardApi } from '../core/api/dashboard.api';
import { Cell, Dashboard } from '../core/models/dashboard.model';

interface DashboardState {
  cells: Cell[];
  parkedApp: Cell | null;
  loaded: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  cells: [],
  parkedApp: null,
  loaded: false,
  saving: false,
  error: null,
};

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    adSlotIndex: computed(() => 5),
    filledCount: computed(() => state.cells().filter((c) => c.type !== 'EMPTY').length),
  })),
  withMethods((store, api = inject(DashboardApi)) => {
    const persist = rxMethod<void>(
      pipe(
        debounceTime(500),
        tap(() => patchState(store, { saving: true, error: null })),
        switchMap(() =>
          api.updateCells(store.cells()).pipe(
            tap((dash: Dashboard) => patchState(store, { cells: dash.cells, saving: false })),
            catchError((err) => {
              patchState(store, { saving: false, error: String(err?.message ?? err) });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const load = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { error: null })),
        switchMap(() =>
          api.get().pipe(
            tap((dash: Dashboard) =>
              patchState(store, { cells: dash.cells, parkedApp: dash.parkedApp ?? null, loaded: true }),
            ),
            catchError((err) => {
              patchState(store, { error: String(err?.message ?? err), loaded: true });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    return {
      load,
      persist,
      swap(a: number, b: number): void {
        const cells = [...store.cells()];
        const contentA = cells[a];
        const contentB = cells[b];
        cells[a] = { ...contentB, slot: a };
        cells[b] = { ...contentA, slot: b };
        patchState(store, { cells });
        persist();
      },
      setCell(cell: Cell): void {
        const cells = store.cells().map((c) => (c.slot === cell.slot ? { ...cell } : c));
        patchState(store, { cells });
        persist();
      },
      clearCell(slot: number): void {
        const cells = store.cells().map((c) =>
          c.slot === slot ? ({ slot, type: 'EMPTY', openMode: 'FRAME' } as Cell) : c,
        );
        patchState(store, { cells });
        persist();
      },
      resolveParked(slot: number | null): void {
        const parked = store.parkedApp();
        if (!parked) {
          return;
        }
        if (slot !== null) {
          // Place the parked app into the chosen slot, replacing whatever is there.
          const cells = store.cells().map((c) => (c.slot === slot ? ({ ...parked, slot } as Cell) : c));
          patchState(store, { cells, parkedApp: null });
        } else {
          // Discard the parked app.
          patchState(store, { parkedApp: null });
        }
        persist();
      },
    };
  }),
);
```

- [ ] **Step 6: Run test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/stores/dashboard.store.spec.ts
```
Expected: `4 passed`.

- [ ] **Step 7: Commit**
```bash
git add frontend/src/app/core/models/dashboard.model.ts frontend/src/app/core/models/catalog.model.ts frontend/src/app/core/api/dashboard.api.ts frontend/src/app/core/api/catalog.api.ts frontend/src/app/stores/dashboard.store.ts frontend/src/app/stores/dashboard.store.spec.ts
git commit -m "feat(dashboard): add frontend models, api services, and debounced DashboardStore"
```

---

### Task 7: Grid component (CDK drag-swap + iframe shield)

**Files:**
- Create: `frontend/src/app/features/dashboard/grid.component.ts`
- Test: `frontend/src/app/features/dashboard/grid.component.spec.ts`

**Interfaces:**
- Consumes: `DashboardStore` (`cells()`, `swap(a,b)`), `@angular/cdk/drag-drop` (`CdkDropListGroup`, `CdkDropList`, `CdkDrag`, `CdkDragDrop`).
- Produces: `GridComponent` with `readonly dragging = signal<boolean>(false)`, `readonly edit = output<number>()`, `onDropped(event: CdkDragDrop<number>): void` → `dashboardStore.swap(from, to)`. Renders 6 single-item `cdkDropList`s in one `cdkDropListGroup`, `[cdkDropListSortingDisabled]="true"`, AD cell is not a drop target, drag disabled unless `APP`; a `pointer-events` shield covers iframes while dragging.

> **Build-order note:** `CellComponent` (Task 8) and `SafeFrameComponent` (Task 9) do not exist yet, so this task renders a *minimal inline cell body*. Task 8 modifies this file to render `<dd-cell>`; the drag/drop/shield machinery and its tests defined here remain unchanged and stay green.

- [ ] **Step 1: Write the failing test** — create `grid.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { GridComponent } from './grid.component';
import { DashboardStore } from '../../stores/dashboard.store';
import { DashboardApi } from '../../core/api/dashboard.api';
import { Cell } from '../../core/models/dashboard.model';

function freeCells(): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < 5; i++) cells.push({ slot: i, type: 'EMPTY', openMode: 'FRAME' });
  cells.push({ slot: 5, type: 'AD', openMode: 'FRAME' });
  return cells;
}

describe('GridComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: DashboardApi,
          useValue: {
            get: vi.fn().mockReturnValue(of({ cells: freeCells() })),
            updateCells: vi.fn().mockImplementation((c: Cell[]) => of({ cells: c })),
          },
        },
      ],
    });
  });

  it('drop event swaps store cells', () => {
    const fixture = TestBed.createComponent(GridComponent);
    const store = TestBed.inject(DashboardStore);
    const swapSpy = vi.spyOn(store, 'swap').mockImplementation(() => {});

    fixture.componentInstance.onDropped({ item: { data: 0 }, container: { data: 3 } } as any);

    expect(swapSpy).toHaveBeenCalledWith(0, 3);
  });

  it('drop onto the same slot does nothing', () => {
    const fixture = TestBed.createComponent(GridComponent);
    const store = TestBed.inject(DashboardStore);
    const swapSpy = vi.spyOn(store, 'swap').mockImplementation(() => {});

    fixture.componentInstance.onDropped({ item: { data: 2 }, container: { data: 2 } } as any);

    expect(swapSpy).not.toHaveBeenCalled();
  });

  it('dragging toggles the iframe shield', () => {
    const fixture = TestBed.createComponent(GridComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="iframe-shield"]')).toBeNull();

    fixture.componentInstance.dragging.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="iframe-shield"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/grid.component.spec.ts
```
Expected: **failure** — cannot resolve `./grid.component`.

- [ ] **Step 3: Write the grid** — create `grid.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DashboardStore } from '../../stores/dashboard.store';

@Component({
  selector: 'dd-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  template: `
    <div class="grid" cdkDropListGroup [class.dragging]="dragging()">
      @for (cell of store.cells(); track cell.slot) {
        <div
          class="cell"
          cdkDropList
          [cdkDropListData]="cell.slot"
          [cdkDropListSortingDisabled]="true"
          [cdkDropListDisabled]="cell.type === 'AD'"
          (cdkDropListDropped)="onDropped($event)"
        >
          <div
            class="drag"
            cdkDrag
            [cdkDragData]="cell.slot"
            [cdkDragDisabled]="cell.type !== 'APP'"
            (cdkDragStarted)="dragging.set(true)"
            (cdkDragEnded)="dragging.set(false)"
          >
            @switch (cell.type) {
              @case ('EMPTY') {
                <button type="button" class="add-btn" data-testid="add-btn" (click)="edit.emit(cell.slot)">
                  + Add app
                </button>
              }
              @case ('AD') {
                <div class="ad-slot" data-testid="ad-slot">Advertisements</div>
              }
              @case ('APP') {
                <div class="app-body" data-testid="app-body">{{ cell.title || cell.url }}</div>
              }
            }
          </div>
        </div>
      }
      @if (dragging()) {
        <div class="iframe-shield" data-testid="iframe-shield"></div>
      }
    </div>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 8px;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .cell { position: relative; min-height: 0; min-width: 0; overflow: hidden; border: 1px solid #e2e2e2; border-radius: 6px; }
    .drag { width: 100%; height: 100%; }
    .add-btn { width: 100%; height: 100%; border: none; background: #fafafa; cursor: pointer; }
    .ad-slot { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; }
    .app-body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .iframe-shield { position: absolute; inset: 0; z-index: 50; pointer-events: auto; background: transparent; }
    .grid.dragging iframe { pointer-events: none; }
  `],
})
export class GridComponent {
  protected store = inject(DashboardStore);
  readonly dragging = signal(false);
  readonly edit = output<number>();

  onDropped(event: CdkDragDrop<number>): void {
    const from = event.item.data as number;
    const to = event.container.data;
    if (from === to) {
      return;
    }
    this.store.swap(from, to);
  }
}
```

- [ ] **Step 4: Run test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/grid.component.spec.ts
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/app/features/dashboard/grid.component.ts frontend/src/app/features/dashboard/grid.component.spec.ts
git commit -m "feat(dashboard): add CDK drag-swap grid with dragging iframe shield"
```

---

### Task 8: Cell + toolbar (branch rendering, focus mode wiring)

**Files:**
- Create: `frontend/src/app/features/dashboard/cell.component.ts`
- Create: `frontend/src/app/features/dashboard/cell-toolbar.component.ts`
- Modify: `frontend/src/app/features/dashboard/grid.component.ts` (render `<dd-cell>`, add asleep/focus/remove wiring)
- Test: `frontend/src/app/features/dashboard/cell.component.spec.ts`
- Test: `frontend/src/app/features/dashboard/cell-toolbar.component.spec.ts`
- Test: `frontend/src/app/features/dashboard/grid-focus.spec.ts`

**Interfaces:**
- Consumes: `Cell` model, `DashboardStore.clearCell` (via grid), `GridComponent` (modified).
- Produces: `CellComponent` — `cell = input.required<Cell>()`, `dragging = input<boolean>(false)`, `asleep = input<boolean>(false)`, `state = input<'ok'|'needs-extension'|'login-in-tab'|'load-failed'>('ok')`; outputs `edit`/`remove`/`sleepToggle` (contract) plus extensions `popOut`/`openInTab`/`focusToggle` (all `output<number>()`); `onReload()` (no-op stub, wired in Task 9). `CellToolbarComponent` — inputs `title`/`asleep`; outputs `reload`/`focusToggle`/`popOut`/`openInTab`/`edit`/`sleep`/`remove` (`output<void>()`). Grid gains `readonly focusedSlot = signal<number|null>(null)`, `onFocusToggle(slot)`, `onEscape()`, `onRemove(slot)`, `onSleepToggle(slot)`.

- [ ] **Step 1: Write the failing cell test** — create `cell.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { CellComponent } from './cell.component';
import { Cell } from '../../core/models/dashboard.model';

function render(cell: Cell) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const f = TestBed.createComponent(CellComponent);
  f.componentRef.setInput('cell', cell);
  f.detectChanges();
  return f;
}

describe('CellComponent', () => {
  it('renders an add button for EMPTY', () => {
    const f = render({ slot: 0, type: 'EMPTY', openMode: 'FRAME' });
    expect(f.nativeElement.querySelector('[data-testid="add-btn"]')).not.toBeNull();
  });

  it('renders the Advertisements placeholder for AD', () => {
    const f = render({ slot: 5, type: 'AD', openMode: 'FRAME' });
    const ad = f.nativeElement.querySelector('[data-testid="ad-slot"]');
    expect(ad).not.toBeNull();
    expect(ad!.textContent).toContain('Advertisements');
  });

  it('renders the toolbar and app body for APP', () => {
    const f = render({ slot: 1, type: 'APP', url: 'https://example.com', title: 'Ex', openMode: 'FRAME' });
    expect(f.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="app-body"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/cell.component.spec.ts
```
Expected: **failure** — cannot resolve `./cell.component`.

- [ ] **Step 3: Write the toolbar** — create `cell-toolbar.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'dd-cell-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar" data-testid="cell-toolbar">
      <span class="title">{{ title() }}</span>
      <span class="spacer"></span>
      <button type="button" title="Reload" data-testid="tb-reload" (click)="reload.emit()">&#8635;</button>
      <button type="button" title="Expand" data-testid="tb-focus" (click)="focusToggle.emit()">&#8690;</button>
      <button type="button" title="Pop out" data-testid="tb-popout" (click)="popOut.emit()">&#9099;</button>
      <button type="button" title="Open in tab" data-testid="tb-opentab" (click)="openInTab.emit()">&#8599;</button>
      <button type="button" title="Edit" data-testid="tb-edit" (click)="edit.emit()">&#9998;</button>
      <button type="button" [title]="asleep() ? 'Wake' : 'Sleep'" data-testid="tb-sleep" (click)="sleep.emit()">
        {{ asleep() ? '☾' : '☀' }}
      </button>
      <button type="button" title="Remove" data-testid="tb-remove" (click)="remove.emit()">&#128465;</button>
    </div>
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 2px; padding: 2px 6px; background: rgba(0,0,0,0.05); font-size: 12px; }
    .spacer { flex: 1; }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40%; }
    button { border: none; background: transparent; cursor: pointer; padding: 2px 4px; line-height: 1; }
  `],
})
export class CellToolbarComponent {
  title = input<string>('');
  asleep = input<boolean>(false);

  reload = output<void>();
  focusToggle = output<void>();
  popOut = output<void>();
  openInTab = output<void>();
  edit = output<void>();
  sleep = output<void>();
  remove = output<void>();
}
```

- [ ] **Step 4: Write the cell** — create `cell.component.ts` (APP branch renders toolbar + a placeholder `app-body`; Task 9 swaps the placeholder for `<dd-safe-frame>`):
```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import { CellToolbarComponent } from './cell-toolbar.component';

type CellState = 'ok' | 'needs-extension' | 'login-in-tab' | 'load-failed';

@Component({
  selector: 'dd-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellToolbarComponent],
  template: `
    @switch (cell().type) {
      @case ('EMPTY') {
        <button type="button" class="add-btn" data-testid="add-btn" (click)="edit.emit(cell().slot)">
          <span class="plus">+</span> Add app
        </button>
      }
      @case ('AD') {
        <div class="ad-slot" data-testid="ad-slot" aria-label="Advertisements">Advertisements</div>
      }
      @case ('APP') {
        @switch (state()) {
          @case ('ok') {
            <dd-cell-toolbar
              [title]="cell().title ?? ''"
              [asleep]="asleep()"
              (reload)="onReload()"
              (popOut)="popOut.emit(cell().slot)"
              (openInTab)="openInTab.emit(cell().slot)"
              (focusToggle)="focusToggle.emit(cell().slot)"
              (edit)="edit.emit(cell().slot)"
              (sleep)="sleepToggle.emit(cell().slot)"
              (remove)="remove.emit(cell().slot)"
            />
            <div class="app-body" data-testid="app-body">{{ cell().title || cell().url }}</div>
          }
          @case ('needs-extension') {
            <div class="state" data-testid="needs-extension">This app needs the DashDash extension to load here.</div>
          }
          @case ('login-in-tab') {
            <div class="state" data-testid="login-in-tab">Sign in to this app in a new tab, then reload.</div>
          }
          @case ('load-failed') {
            <div class="state" data-testid="load-failed">This app refused to load. Open it in a new window.</div>
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .add-btn { width: 100%; height: 100%; border: none; background: #fafafa; cursor: pointer; font-size: 14px; }
    .ad-slot { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; }
    .app-body { flex: 1; display: flex; align-items: center; justify-content: center; }
    .state { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 8px; text-align: center; color: #666; }
  `],
})
export class CellComponent {
  cell = input.required<Cell>();
  dragging = input<boolean>(false);
  asleep = input<boolean>(false);
  // Stub state; Plan 04 drives 'needs-extension' | 'login-in-tab' | 'load-failed'.
  state = input<CellState>('ok');

  edit = output<number>();
  remove = output<number>();
  sleepToggle = output<number>();
  popOut = output<number>();
  openInTab = output<number>();
  focusToggle = output<number>();

  onReload(): void {
    // SafeFrame reload is wired in Task 9 (viewChild on the SafeFrameComponent).
  }
}
```

- [ ] **Step 5: Run cell test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/cell.component.spec.ts
```
Expected: `3 passed`.

- [ ] **Step 6: Write the failing toolbar test** — create `cell-toolbar.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { CellToolbarComponent } from './cell-toolbar.component';

describe('CellToolbarComponent', () => {
  it('emits reload/edit/remove/sleep on click', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(CellToolbarComponent);
    f.detectChanges();

    const reload = vi.fn();
    const edit = vi.fn();
    const remove = vi.fn();
    const sleep = vi.fn();
    f.componentInstance.reload.subscribe(reload);
    f.componentInstance.edit.subscribe(edit);
    f.componentInstance.remove.subscribe(remove);
    f.componentInstance.sleep.subscribe(sleep);

    (f.nativeElement.querySelector('[data-testid="tb-reload"]') as HTMLButtonElement).click();
    (f.nativeElement.querySelector('[data-testid="tb-edit"]') as HTMLButtonElement).click();
    (f.nativeElement.querySelector('[data-testid="tb-remove"]') as HTMLButtonElement).click();
    (f.nativeElement.querySelector('[data-testid="tb-sleep"]') as HTMLButtonElement).click();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Run toolbar test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/cell-toolbar.component.spec.ts
```
Expected: `1 passed`.

- [ ] **Step 8: Modify the grid to render `<dd-cell>` + add focus/asleep/remove wiring** — replace the full contents of `grid.component.ts` with:
```ts
import { ChangeDetectionStrategy, Component, HostListener, inject, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DashboardStore } from '../../stores/dashboard.store';
import { CellComponent } from './cell.component';

@Component({
  selector: 'dd-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CellComponent],
  template: `
    <div class="grid" cdkDropListGroup [class.dragging]="dragging()" [class.has-focus]="focusedSlot() !== null">
      @for (cell of store.cells(); track cell.slot) {
        <div
          class="cell"
          [class.focused]="focusedSlot() === cell.slot"
          cdkDropList
          [cdkDropListData]="cell.slot"
          [cdkDropListSortingDisabled]="true"
          [cdkDropListDisabled]="cell.type === 'AD'"
          (cdkDropListDropped)="onDropped($event)"
        >
          <div
            class="drag"
            cdkDrag
            [cdkDragData]="cell.slot"
            [cdkDragDisabled]="cell.type !== 'APP'"
            (cdkDragStarted)="dragging.set(true)"
            (cdkDragEnded)="dragging.set(false)"
          >
            <dd-cell
              [cell]="cell"
              [dragging]="dragging()"
              [asleep]="asleepSlots().has(cell.slot)"
              (edit)="edit.emit($event)"
              (remove)="onRemove($event)"
              (sleepToggle)="onSleepToggle($event)"
              (focusToggle)="onFocusToggle($event)"
            />
          </div>
        </div>
      }
      @if (dragging()) {
        <div class="iframe-shield" data-testid="iframe-shield"></div>
      }
    </div>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 8px;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .cell { position: relative; min-height: 0; min-width: 0; overflow: hidden; border: 1px solid #e2e2e2; border-radius: 6px; display: flex; flex-direction: column; }
    .drag { width: 100%; height: 100%; display: flex; flex-direction: column; }
    .cell.focused { position: fixed; inset: 0; z-index: 1000; border-radius: 0; background: #fff; }
    .iframe-shield { position: absolute; inset: 0; z-index: 50; pointer-events: auto; background: transparent; }
    .grid.dragging iframe { pointer-events: none; }
  `],
})
export class GridComponent {
  protected store = inject(DashboardStore);
  readonly dragging = signal(false);
  readonly focusedSlot = signal<number | null>(null);
  protected readonly asleepSlots = signal<Set<number>>(new Set());
  readonly edit = output<number>();

  onDropped(event: CdkDragDrop<number>): void {
    const from = event.item.data as number;
    const to = event.container.data;
    if (from === to) {
      return;
    }
    this.store.swap(from, to);
  }

  onRemove(slot: number): void {
    this.store.clearCell(slot);
  }

  onSleepToggle(slot: number): void {
    const next = new Set(this.asleepSlots());
    if (next.has(slot)) {
      next.delete(slot);
    } else {
      next.add(slot);
    }
    this.asleepSlots.set(next);
  }

  onFocusToggle(slot: number): void {
    this.focusedSlot.set(this.focusedSlot() === slot ? null : slot);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.focusedSlot.set(null);
  }
}
```

- [ ] **Step 9: Write the failing grid focus test** — create `grid-focus.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { GridComponent } from './grid.component';
import { DashboardApi } from '../../core/api/dashboard.api';

describe('GridComponent focus mode', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApi, useValue: { get: vi.fn().mockReturnValue(of({ cells: [] })), updateCells: vi.fn() } },
      ],
    });
  });

  it('toggles focusedSlot and clears it on Escape', () => {
    const c = TestBed.createComponent(GridComponent).componentInstance;

    c.onFocusToggle(2);
    expect(c.focusedSlot()).toBe(2);

    c.onFocusToggle(2);
    expect(c.focusedSlot()).toBeNull();

    c.onFocusToggle(3);
    expect(c.focusedSlot()).toBe(3);
    c.onEscape();
    expect(c.focusedSlot()).toBeNull();
  });
});
```

- [ ] **Step 10: Run the whole dashboard-feature suite (grid still green after modify)** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/grid.component.spec.ts src/app/features/dashboard/grid-focus.spec.ts src/app/features/dashboard/cell.component.spec.ts src/app/features/dashboard/cell-toolbar.component.spec.ts
```
Expected: all green — grid.component (3) + grid-focus (1) + cell.component (3) + cell-toolbar (1) = 8 passed.

- [ ] **Step 11: Commit**
```bash
git add frontend/src/app/features/dashboard/cell.component.ts frontend/src/app/features/dashboard/cell-toolbar.component.ts frontend/src/app/features/dashboard/grid.component.ts frontend/src/app/features/dashboard/cell.component.spec.ts frontend/src/app/features/dashboard/cell-toolbar.component.spec.ts frontend/src/app/features/dashboard/grid-focus.spec.ts
git commit -m "feat(dashboard): add cell + toolbar with focus mode and sleep/remove wiring"
```

---

### Task 9: SafeFrame component (sandboxed iframe, sleep/wake, reload, staggered mount)

**Files:**
- Create: `frontend/src/app/core/util/url.util.ts`
- Create: `frontend/src/app/features/dashboard/safe-frame.component.ts`
- Modify: `frontend/src/app/features/dashboard/cell.component.ts` (render `<dd-safe-frame>`, wire `onReload` via `viewChild`)
- Modify: `frontend/src/app/features/dashboard/cell.component.spec.ts` (APP branch now asserts `dd-safe-frame`)
- Test: `frontend/src/app/core/util/url.util.spec.ts`
- Test: `frontend/src/app/features/dashboard/safe-frame.component.spec.ts`

**Interfaces:**
- Consumes: `DomSanitizer.bypassSecurityTrustResourceUrl` (`@angular/platform-browser`), `isSafeHttpsUrl` (this task).
- Produces: `isSafeHttpsUrl(url: string | null | undefined): boolean` (frontend mirror of the backend `UrlValidator`, also consumed by Task 10's add-url dialog); `SafeFrameComponent` — `url = input.required<string>()`, `title = input<string>('')`, `asleep = input<boolean>(false)`, `loadFailed = output<void>()`, `reload(): void`. Builds the `SafeResourceUrl` only when `!asleep` and the url is safe-https; sandbox/allow/referrerpolicy exactly per Global Constraints; ~300 ms staggered mount; sleep removes the iframe from the DOM.

- [ ] **Step 1: Write the failing url-util test** — create `url.util.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isSafeHttpsUrl } from './url.util';

describe('isSafeHttpsUrl', () => {
  it('accepts safe https urls', () => {
    expect(isSafeHttpsUrl('https://mail.google.com')).toBe(true);
    expect(isSafeHttpsUrl('  https://example.com/path?q=1  ')).toBe(true);
  });
  it('rejects unsafe or malformed urls', () => {
    for (const bad of ['http://x.com', 'javascript:alert(1)', 'data:text/html,x', 'blob:https://x/y',
      'file:///etc', 'https://user:pass@x.com', '//x.com', 'not a url', '', '   ', null, undefined]) {
      expect(isSafeHttpsUrl(bad as any)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — from `frontend/`:
```bash
npx vitest run src/app/core/util/url.util.spec.ts
```
Expected: **failure** — cannot resolve `./url.util`.

- [ ] **Step 3: Write the util** — create `url.util.ts`:
```ts
/** Frontend mirror of the backend UrlValidator: https only, real host, no credentials, no dangerous schemes. */
export function isSafeHttpsUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') {
    return false;
  }
  if (parsed.username || parsed.password) {
    return false;
  }
  return !!parsed.hostname;
}
```

- [ ] **Step 4: Run test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/core/util/url.util.spec.ts
```
Expected: `2 passed`.

- [ ] **Step 5: Write the failing safe-frame test** — create `safe-frame.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { SafeFrameComponent } from './safe-frame.component';

function setup(url: string, asleep = false) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const f = TestBed.createComponent(SafeFrameComponent);
  f.componentRef.setInput('url', url);
  f.componentRef.setInput('asleep', asleep);
  return f;
}

describe('SafeFrameComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not render an iframe for an unsafe url', () => {
    const f = setup('javascript:alert(1)');
    vi.advanceTimersByTime(300);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();
  });

  it('renders an iframe for a safe https url only after the staggered mount', () => {
    const f = setup('https://example.com');
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();

    vi.advanceTimersByTime(300);
    f.detectChanges();
    const iframe = f.nativeElement.querySelector('[data-testid="app-iframe"]') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads',
    );
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation');
  });

  it('removes the iframe when asleep and shows a placeholder', () => {
    const f = setup('https://example.com', true);
    vi.advanceTimersByTime(300);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="asleep-placeholder"]')).not.toBeNull();
  });

  it('reload() changes the iframe src', () => {
    const f = setup('https://example.com');
    vi.advanceTimersByTime(300);
    f.detectChanges();
    const before = f.nativeElement.querySelector('[data-testid="app-iframe"]').getAttribute('src');

    f.componentInstance.reload();
    f.detectChanges();
    const after = f.nativeElement.querySelector('[data-testid="app-iframe"]').getAttribute('src');

    expect(after).not.toBe(before);
    expect(after).toContain('_dd=1');
  });
});
```

- [ ] **Step 6: Run test to verify it fails** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/safe-frame.component.spec.ts
```
Expected: **failure** — cannot resolve `./safe-frame.component`.

- [ ] **Step 7: Write the SafeFrame** — create `safe-frame.component.ts`:
```ts
import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { isSafeHttpsUrl } from '../../core/util/url.util';

@Component({
  selector: 'dd-safe-frame',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showFrame()) {
      <iframe
        [src]="safeSrc()"
        [title]="title()"
        class="frame"
        data-testid="app-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
        allow="fullscreen; clipboard-write; autoplay"
        referrerpolicy="strict-origin-when-cross-origin"
        (error)="loadFailed.emit()"
      ></iframe>
    } @else {
      <div class="asleep" data-testid="asleep-placeholder">
        <span>{{ asleep() ? 'Sleeping — wake to reload' : 'Loading…' }}</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .frame { width: 100%; height: 100%; border: 0; display: block; }
    .asleep { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #888; background: #fafafa; }
  `],
})
export class SafeFrameComponent {
  url = input.required<string>();
  title = input<string>('');
  asleep = input<boolean>(false);
  loadFailed = output<void>();

  private sanitizer = inject(DomSanitizer);
  private cacheBuster = signal(0);
  private mounted = signal(false);

  constructor() {
    // Staggered mount: defer the first render so 5-6 iframes do not boot simultaneously.
    const timer = setTimeout(() => this.mounted.set(true), 300);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  private urlSafe = computed(() => isSafeHttpsUrl(this.url()));

  protected showFrame = computed(() => this.mounted() && !this.asleep() && this.urlSafe());

  protected safeSrc = computed<SafeResourceUrl | null>(() => {
    if (!this.showFrame()) {
      return null;
    }
    const bust = this.cacheBuster();
    const u = new URL(this.url().trim());
    if (bust > 0) {
      u.searchParams.set('_dd', String(bust));
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(u.toString());
  });

  reload(): void {
    this.cacheBuster.update((n) => n + 1);
  }
}
```

- [ ] **Step 8: Run safe-frame test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/safe-frame.component.spec.ts
```
Expected: `4 passed`.

- [ ] **Step 9: Wire SafeFrame into the cell** — replace the full contents of `cell.component.ts` with (adds `SafeFrameComponent` import, `viewChild`, real `onReload`, and swaps the APP `app-body` placeholder for `<dd-safe-frame>`):
```ts
import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import { CellToolbarComponent } from './cell-toolbar.component';
import { SafeFrameComponent } from './safe-frame.component';

type CellState = 'ok' | 'needs-extension' | 'login-in-tab' | 'load-failed';

@Component({
  selector: 'dd-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellToolbarComponent, SafeFrameComponent],
  template: `
    @switch (cell().type) {
      @case ('EMPTY') {
        <button type="button" class="add-btn" data-testid="add-btn" (click)="edit.emit(cell().slot)">
          <span class="plus">+</span> Add app
        </button>
      }
      @case ('AD') {
        <div class="ad-slot" data-testid="ad-slot" aria-label="Advertisements">Advertisements</div>
      }
      @case ('APP') {
        @switch (state()) {
          @case ('ok') {
            <dd-cell-toolbar
              [title]="cell().title ?? ''"
              [asleep]="asleep()"
              (reload)="onReload()"
              (popOut)="popOut.emit(cell().slot)"
              (openInTab)="openInTab.emit(cell().slot)"
              (focusToggle)="focusToggle.emit(cell().slot)"
              (edit)="edit.emit(cell().slot)"
              (sleep)="sleepToggle.emit(cell().slot)"
              (remove)="remove.emit(cell().slot)"
            />
            <dd-safe-frame
              [url]="cell().url!"
              [title]="cell().title ?? ''"
              [asleep]="asleep()"
              (loadFailed)="onLoadFailed()"
            />
          }
          @case ('needs-extension') {
            <div class="state" data-testid="needs-extension">This app needs the DashDash extension to load here.</div>
          }
          @case ('login-in-tab') {
            <div class="state" data-testid="login-in-tab">Sign in to this app in a new tab, then reload.</div>
          }
          @case ('load-failed') {
            <div class="state" data-testid="load-failed">This app refused to load. Open it in a new window.</div>
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .add-btn { width: 100%; height: 100%; border: none; background: #fafafa; cursor: pointer; font-size: 14px; }
    .ad-slot { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; }
    .state { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 8px; text-align: center; color: #666; }
  `],
})
export class CellComponent {
  cell = input.required<Cell>();
  dragging = input<boolean>(false);
  asleep = input<boolean>(false);
  // Stub state; Plan 04 drives 'needs-extension' | 'login-in-tab' | 'load-failed'.
  state = input<CellState>('ok');

  edit = output<number>();
  remove = output<number>();
  sleepToggle = output<number>();
  popOut = output<number>();
  openInTab = output<number>();
  focusToggle = output<number>();

  private safeFrame = viewChild(SafeFrameComponent);

  onReload(): void {
    this.safeFrame()?.reload();
  }

  onLoadFailed(): void {
    // Plan 04 sets the 'load-failed' state here via framing-failure detection.
  }
}
```

- [ ] **Step 10: Update the cell spec's APP assertion** — in `cell.component.spec.ts`, replace the third test body so it asserts the SafeFrame instead of the removed `app-body`:
```ts
  it('renders the toolbar and a safe-frame for APP', () => {
    const f = render({ slot: 1, type: 'APP', url: 'https://example.com', title: 'Ex', openMode: 'FRAME' });
    expect(f.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('dd-safe-frame')).not.toBeNull();
  });
```

- [ ] **Step 11: Run cell + safe-frame + url specs to verify all green** — from `frontend/`:
```bash
npx vitest run src/app/core/util/url.util.spec.ts src/app/features/dashboard/safe-frame.component.spec.ts src/app/features/dashboard/cell.component.spec.ts
```
Expected: url.util (2) + safe-frame (4) + cell.component (3) = 9 passed.

- [ ] **Step 12: Commit**
```bash
git add frontend/src/app/core/util/url.util.ts frontend/src/app/core/util/url.util.spec.ts frontend/src/app/features/dashboard/safe-frame.component.ts frontend/src/app/features/dashboard/safe-frame.component.spec.ts frontend/src/app/features/dashboard/cell.component.ts frontend/src/app/features/dashboard/cell.component.spec.ts
git commit -m "feat(dashboard): add SafeFrame iframe with sleep/wake, reload, and staggered mount"
```

---

### Task 10: Assembly (catalog dialog, add-url dialog, dashboard page)

**Files:**
- Create: `frontend/src/app/features/dashboard/catalog-dialog.component.ts`
- Create: `frontend/src/app/features/dashboard/add-url-dialog.component.ts`
- Create: `frontend/src/app/features/dashboard/dashboard-page.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (replace Plan 02's temporary `HomeComponent` at `/app` with `DashboardPageComponent` behind `authGuard`)
- Test: `frontend/src/app/features/dashboard/add-url-dialog.component.spec.ts`
- Test: `frontend/src/app/features/dashboard/dashboard-page.component.spec.ts`

**Interfaces:**
- Consumes: `@angular/cdk/dialog` (`Dialog`, `DialogRef`), `CatalogApi.list()`, `DashboardStore` (`load`, `setCell`), `GridComponent` (`edit` output), `CatalogApp`/`Cell` models, `isSafeHttpsUrl` (Task 9), `authGuard` (Plan 02).
- Produces: `CatalogDialogComponent` (returns `CatalogApp | 'ADD_URL' | null`); `AddUrlDialogComponent` + `interface AddUrlResult { url: string; title: string; }` (returns `AddUrlResult | null`); `DashboardPageComponent` (`ngOnInit` → `store.load()`; `onEdit(slot)` runs the add-app flow; a parked-app prompt shown when `store.parkedApp()` is set, resolved via `resolveParkedApp(slot | null)`); the `/app` route (replaces Plan 02's `HomeComponent` placeholder).

- [ ] **Step 1: Write the failing add-url dialog test** — create `add-url-dialog.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AddUrlDialogComponent } from './add-url-dialog.component';

describe('AddUrlDialogComponent', () => {
  it('validates https urls and gates the Add button', () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(AddUrlDialogComponent);
    f.detectChanges();
    const c = f.componentInstance;

    c.url.set('not-a-url');
    expect(c.valid()).toBe(false);

    c.url.set('http://insecure.com');
    expect(c.valid()).toBe(false);

    c.url.set('https://good.com');
    expect(c.valid()).toBe(true);
  });

  it('closes with the entered url on add', () => {
    const closeSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DialogRef, useValue: { close: closeSpy } },
      ],
    });
    const c = TestBed.createComponent(AddUrlDialogComponent).componentInstance;
    c.url.set('https://good.com');
    c.add();
    expect(closeSpy).toHaveBeenCalledWith({ url: 'https://good.com', title: 'https://good.com' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/add-url-dialog.component.spec.ts
```
Expected: **failure** — cannot resolve `./add-url-dialog.component`.

- [ ] **Step 3: Write the add-url dialog** — create `add-url-dialog.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { isSafeHttpsUrl } from '../../core/util/url.util';

export interface AddUrlResult {
  url: string;
  title: string;
}

@Component({
  selector: 'dd-add-url-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" data-testid="add-url-dialog">
      <h2>Add a URL</h2>
      <label>URL
        <input type="url" data-testid="url-input" placeholder="https://…"
          [value]="url()" (input)="url.set(asValue($event))" />
      </label>
      @if (url() && !valid()) {
        <p class="err" data-testid="url-error">Enter a valid https:// URL</p>
      }
      <label>Title
        <input type="text" data-testid="title-input"
          [value]="title()" (input)="title.set(asValue($event))" />
      </label>
      <div class="actions">
        <button type="button" data-testid="url-cancel" (click)="cancel()">Cancel</button>
        <button type="button" data-testid="url-add" [disabled]="!valid()" (click)="add()">Add</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { background: #fff; padding: 16px; width: 100%; max-width: 420px; }
    label { display: block; margin: 8px 0; }
    input { width: 100%; padding: 6px; box-sizing: border-box; }
    .err { color: #c0392b; font-size: 12px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
  `],
})
export class AddUrlDialogComponent {
  private dialogRef = inject<DialogRef<AddUrlResult | null>>(DialogRef);

  readonly url = signal('');
  readonly title = signal('');
  readonly valid = computed(() => isSafeHttpsUrl(this.url()));

  protected asValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  add(): void {
    if (!this.valid()) {
      return;
    }
    const u = this.url().trim();
    this.dialogRef.close({ url: u, title: this.title().trim() || u });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
```

- [ ] **Step 4: Run test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/add-url-dialog.component.spec.ts
```
Expected: `2 passed`.

- [ ] **Step 5: Write the catalog dialog** — create `catalog-dialog.component.ts` (no direct spec; it is exercised via the dashboard-page flow and compiled by the suite):
```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogApi } from '../../core/api/catalog.api';
import { CatalogApp } from '../../core/models/catalog.model';

type CatalogChoice = CatalogApp | 'ADD_URL';

@Component({
  selector: 'dd-catalog-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" data-testid="catalog-dialog">
      <h2>Add an app</h2>
      <input type="search" placeholder="Search apps…" data-testid="catalog-search"
        [value]="query()" (input)="query.set(asValue($event))" />
      <ul class="apps">
        @for (app of filtered(); track app.id) {
          <li>
            <button type="button" class="app" [attr.data-testid]="'catalog-app-' + app.id" (click)="choose(app)">
              <img [src]="app.iconUrl" alt="" width="18" height="18" />
              <span class="name">{{ app.name }}</span>
              <span class="cat">{{ app.category }}</span>
            </button>
          </li>
        } @empty {
          <li class="empty">No apps found</li>
        }
      </ul>
      <div class="actions">
        <button type="button" data-testid="catalog-url" (click)="chooseUrl()">Add by URL instead</button>
        <button type="button" data-testid="catalog-cancel" (click)="cancel()">Cancel</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { background: #fff; padding: 16px; width: 100%; max-width: 480px; }
    .apps { list-style: none; margin: 8px 0; padding: 0; max-height: 320px; overflow: auto; }
    .app { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px; border: none; background: transparent; cursor: pointer; }
    .app:hover { background: #f2f2f2; }
    .cat { margin-left: auto; color: #999; font-size: 12px; }
    .actions { display: flex; justify-content: space-between; margin-top: 8px; }
  `],
})
export class CatalogDialogComponent {
  private dialogRef = inject<DialogRef<CatalogChoice | null>>(DialogRef);
  private catalogApi = inject(CatalogApi);

  readonly query = signal('');
  private readonly apps = toSignal(this.catalogApi.list(), { initialValue: [] as CatalogApp[] });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.apps();
    if (!q) {
      return list;
    }
    return list.filter((a) => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  });

  protected asValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  choose(app: CatalogApp): void {
    this.dialogRef.close(app);
  }

  chooseUrl(): void {
    this.dialogRef.close('ADD_URL');
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
```

- [ ] **Step 6: Write the failing dashboard-page test** — create `dashboard-page.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { DashboardPageComponent } from './dashboard-page.component';
import { DashboardStore } from '../../stores/dashboard.store';
import { DashboardApi } from '../../core/api/dashboard.api';
import { CatalogApp } from '../../core/models/catalog.model';
import { Cell } from '../../core/models/dashboard.model';

function freeCells(): Cell[] {
  const c: Cell[] = [];
  for (let i = 0; i < 5; i++) c.push({ slot: i, type: 'EMPTY', openMode: 'FRAME' });
  c.push({ slot: 5, type: 'AD', openMode: 'FRAME' });
  return c;
}

describe('DashboardPageComponent', () => {
  let apiMock: { get: ReturnType<typeof vi.fn>; updateCells: ReturnType<typeof vi.fn> };
  let dialogMock: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = {
      get: vi.fn().mockReturnValue(of({ cells: freeCells() })),
      updateCells: vi.fn().mockImplementation((cells: Cell[]) => of({ cells })),
    };
    dialogMock = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardApi, useValue: apiMock },
        { provide: Dialog, useValue: dialogMock },
      ],
    });
  });

  it('add-from-catalog fills the clicked slot and persists', async () => {
    vi.useFakeTimers();
    const chosen: CatalogApp = {
      id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', iconUrl: 'i',
      category: 'Email', order: 0, compatibility: 'LOGIN_IN_TAB',
    };
    dialogMock.open.mockReturnValue({ closed: of(chosen) });

    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges(); // ngOnInit → store.load()
    const store = TestBed.inject(DashboardStore);

    await fixture.componentInstance.onEdit(0);

    expect(store.cells()[0].type).toBe('APP');
    expect(store.cells()[0].url).toBe('https://mail.google.com');
    expect(store.cells()[0].catalogAppId).toBe('gmail');

    vi.advanceTimersByTime(500);
    expect(apiMock.updateCells).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancelling the dialog leaves the slot empty', async () => {
    dialogMock.open.mockReturnValue({ closed: of(null) });
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const store = TestBed.inject(DashboardStore);

    await fixture.componentInstance.onEdit(0);

    expect(store.cells()[0].type).toBe('EMPTY');
  });

  it('resolveParkedApp places the parked app into the chosen slot and clears the prompt', () => {
    apiMock.get.mockReturnValue(
      of({
        cells: freeCells(),
        parkedApp: { slot: 5, type: 'APP', url: 'https://parked.com', title: 'Parked', openMode: 'FRAME' } as Cell,
      }),
    );
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges(); // ngOnInit → store.load()
    const store = TestBed.inject(DashboardStore);
    expect(store.parkedApp()).not.toBeNull();

    fixture.componentInstance.resolveParkedApp(2);

    expect(store.cells()[2].type).toBe('APP');
    expect(store.cells()[2].url).toBe('https://parked.com');
    expect(store.parkedApp()).toBeNull();
  });
});
```

- [ ] **Step 7: Run test to verify it fails** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/dashboard-page.component.spec.ts
```
Expected: **failure** — cannot resolve `./dashboard-page.component`.

- [ ] **Step 8: Write the dashboard page** — create `dashboard-page.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { DashboardStore } from '../../stores/dashboard.store';
import { GridComponent } from './grid.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { AddUrlDialogComponent, AddUrlResult } from './add-url-dialog.component';
import { CatalogApp } from '../../core/models/catalog.model';

type CatalogChoice = CatalogApp | 'ADD_URL' | null | undefined;

@Component({
  selector: 'dd-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent],
  template: `
    <main class="page">
      <dd-grid (edit)="onEdit($event)" />
      @if (store.parkedApp(); as parked) {
        <div class="parked-prompt" data-testid="parked-prompt" role="dialog" aria-label="Placed app removed">
          <p>
            Your plan changed and “{{ parked.title || parked.url }}” no longer fits your dashboard.
            Place it in a slot or discard it.
          </p>
          <div class="parked-actions">
            @for (slot of placeableSlots(); track slot) {
              <button type="button" [attr.data-testid]="'park-slot-' + slot" (click)="resolveParkedApp(slot)">
                Slot {{ slot + 1 }}
              </button>
            }
            <button type="button" class="discard" data-testid="park-discard" (click)="resolveParkedApp(null)">
              Discard
            </button>
          </div>
        </div>
      }
    </main>
  `,
  styles: [`
    .page { width: 100vw; height: 100vh; padding: 12px; box-sizing: border-box; }
    .parked-prompt {
      position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 1100;
      max-width: 90vw; background: #fff; border: 1px solid #ddd; border-radius: 8px;
      padding: 12px 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    .parked-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .parked-actions button { padding: 4px 10px; cursor: pointer; }
    .parked-actions .discard { margin-left: auto; }
  `],
})
export class DashboardPageComponent implements OnInit {
  protected store = inject(DashboardStore);
  private dialog = inject(Dialog);

  // The parked app can be placed into any non-AD slot (slot 5 is the FREE ad slot).
  protected readonly placeableSlots = computed(() =>
    this.store.cells().filter((c) => c.type !== 'AD').map((c) => c.slot),
  );

  ngOnInit(): void {
    this.store.load();
  }

  async onEdit(slot: number): Promise<void> {
    const ref = this.dialog.open<CatalogChoice>(CatalogDialogComponent, { width: '480px' });
    const result = await firstValueFrom(ref.closed);
    if (!result) {
      return;
    }
    if (result === 'ADD_URL') {
      const urlRef = this.dialog.open<AddUrlResult | null | undefined>(AddUrlDialogComponent, { width: '420px' });
      const urlResult = await firstValueFrom(urlRef.closed);
      if (!urlResult) {
        return;
      }
      this.store.setCell({ slot, type: 'APP', url: urlResult.url, title: urlResult.title, openMode: 'FRAME' });
      return;
    }
    this.store.setCell({
      slot,
      type: 'APP',
      url: result.url,
      title: result.name,
      catalogAppId: result.id,
      iconUrl: result.iconUrl,
      openMode: 'FRAME',
    });
  }

  /** Resolve the downgrade "parked app" prompt: place it into `slot`, or discard it when `slot` is null. */
  resolveParkedApp(slot: number | null): void {
    this.store.resolveParked(slot);
  }
}
```

- [ ] **Step 9: Run test to verify it passes** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard/dashboard-page.component.spec.ts
```
Expected: `3 passed`.

- [ ] **Step 10: Mount `DashboardPageComponent` at `/app`** — edit `frontend/src/app/app.routes.ts` and **replace** Plan 02's temporary `HomeComponent` route at `/app` with the route object below (consumes `authGuard` from Plan 02; import it at the top if not already imported). There is **no `/dashboard` route** — the dashboard lives at `/app`:
```ts
// add near the other imports:
import { authGuard } from './core/guards/auth.guard';
```
```ts
  // replace Plan 02's temporary HomeComponent route at 'app' with:
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
```

- [ ] **Step 11: Verify the whole dashboard feature + route compile and pass** — from `frontend/`:
```bash
npx vitest run src/app/features/dashboard src/app/stores/dashboard.store.spec.ts src/app/core/util/url.util.spec.ts
```
Expected: all dashboard specs green — store (4), grid (3), grid-focus (1), cell (3), cell-toolbar (1), safe-frame (4), url.util (2), add-url (2), dashboard-page (3) = **23 passed**.

- [ ] **Step 12: Commit**
```bash
git add frontend/src/app/features/dashboard/catalog-dialog.component.ts frontend/src/app/features/dashboard/add-url-dialog.component.ts frontend/src/app/features/dashboard/add-url-dialog.component.spec.ts frontend/src/app/features/dashboard/dashboard-page.component.ts frontend/src/app/features/dashboard/dashboard-page.component.spec.ts frontend/src/app/app.routes.ts
git commit -m "feat(dashboard): assemble catalog/add-url dialogs and dashboard page with add-app flow"
```

---

## Definition of done (Plan 03)

Run the full backend and frontend suites and confirm green:

```bash
# from backend/
./gradlew test --tests "com.dashdash.dashboard.*" --tests "com.dashdash.catalog.*" --tests "com.dashdash.common.UrlValidatorTest"
# from frontend/
npx vitest run src/app/features/dashboard src/app/stores/dashboard.store.spec.ts src/app/core/util/url.util.spec.ts
```

Delivered and consumed by later plans:
- **Backend:** `UrlValidator`, `DashboardService` (`getDashboard`/`updateCells`/`reconcileForTier`), `DashboardController` (`GET`/`PUT /api/v1/dashboard[/cells]`), DTOs (`CellDto`/`DashboardDto`/`UpdateCellsRequest`), `InvalidCellsException`, catalog (`CatalogApp`/`Compatibility`/`CatalogAppRepository`/`CatalogService`/`CatalogController`/`CatalogSeeder`). Plan 05 calls `reconcileForTier` on Stripe downgrade and persists the returned `Dashboard` verbatim (including `parkedApp`); Plan 06 relies on the FREE→AD invariant.
- **Frontend:** `dashboard.model.ts`/`catalog.model.ts`, `DashboardApi`/`CatalogApi`, `DashboardStore`, `GridComponent`, `CellComponent`, `CellToolbarComponent`, `SafeFrameComponent`, `catalog-dialog`/`add-url-dialog`/`dashboard-page`, `isSafeHttpsUrl`. Plan 04 wires the stubbed `CellComponent` states (`needs-extension`/`login-in-tab`/`load-failed`) and the pop-out/open-in-tab actions; Plan 06 replaces the `AD` placeholder with `AdCellComponent`.



