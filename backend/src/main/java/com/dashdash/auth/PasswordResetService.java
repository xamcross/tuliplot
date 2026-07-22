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
