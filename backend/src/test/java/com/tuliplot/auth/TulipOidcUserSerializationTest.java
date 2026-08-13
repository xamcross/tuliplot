package com.tuliplot.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.serializer.support.DeserializingConverter;
import org.springframework.core.serializer.support.SerializingConverter;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.StandardClaimNames;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/**
 * Regression test for the Google-login 401. MongoSessionRepository persists every session
 * attribute with a {@link SerializingConverter} (JDK serialization). After a Google login the
 * session holds a SecurityContext whose principal is a {@link TulipOidcUser}. That principal
 * must survive the same round-trip, or every Google login dies on the first session save.
 */
class TulipOidcUserSerializationTest {

    private OidcUser googleUser(String sub, String email, String name) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(StandardClaimNames.SUB, sub);
        claims.put(StandardClaimNames.EMAIL, email);
        claims.put(StandardClaimNames.EMAIL_VERIFIED, true);
        claims.put(StandardClaimNames.NAME, name);
        OidcIdToken idToken = new OidcIdToken(
                "token-value", Instant.now(), Instant.now().plusSeconds(3600), claims);
        return new DefaultOidcUser(List.of(), idToken);
    }

    @Test
    void googleLoginSecurityContextSurvivesTheSessionStoreSerializationRoundTrip() {
        TulipOidcUser principal = new TulipOidcUser(
                googleUser("google-sub-9", "helen@example.com", "Helen"), "user-id-9", "helen@example.com");
        SecurityContext context = new SecurityContextImpl(
                new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google"));

        byte[] bytes = new SerializingConverter().convert(context);
        SecurityContext restored = (SecurityContext) new DeserializingConverter().convert(bytes);

        DashPrincipal restoredPrincipal = (DashPrincipal) restored.getAuthentication().getPrincipal();
        assertThat(restoredPrincipal.getUserId()).isEqualTo("user-id-9");
        assertThat(restoredPrincipal.getEmail()).isEqualTo("helen@example.com");
        assertThat(restored.getAuthentication().getName()).isEqualTo("user-id-9");
    }
}
