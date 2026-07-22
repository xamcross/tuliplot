package com.tuliplot.auth;

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
