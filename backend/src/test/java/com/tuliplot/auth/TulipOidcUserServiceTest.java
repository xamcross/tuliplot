package com.tuliplot.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tuliplot.dashboard.CellType;
import com.tuliplot.dashboard.Dashboard;
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
class TulipOidcUserServiceTest {

    @Mock UserRepository users;

    /** A TulipOidcUserService whose network delegate is replaced with a fixed OidcUser. */
    private TulipOidcUserService serviceReturning(OidcUser delegate) {
        return new TulipOidcUserService(users) {
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
