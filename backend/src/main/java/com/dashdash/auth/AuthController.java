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
        rotateSessionId(request);
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
        rotateSessionId(request);
        securityContextRepository.saveContext(context, request, response);
    }

    /**
     * Rotate the session id on successful authentication to defeat session fixation: an attacker who
     * planted a known pre-auth DASHSESSION id must not have that id survive into the authenticated
     * session. Ensures a session exists (reusing the one carried by the cookie, if any) and then
     * assigns it a fresh id — the old id's store document is removed by MongoSessionRepository.save.
     */
    private static void rotateSessionId(HttpServletRequest request) {
        request.getSession();
        request.changeSessionId();
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
