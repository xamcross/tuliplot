package com.tuliplot.auth;

import com.tuliplot.dashboard.Dashboard;
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
 * The returned principal is a {@link TulipOidcUser} implementing {@link DashPrincipal}.
 */
@Service
public class TulipOidcUserService extends OidcUserService {

    private final UserRepository users;

    public TulipOidcUserService(UserRepository users) {
        this.users = users;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
        OidcUser oidcUser = loadDelegate(userRequest);
        User user = upsert(oidcUser);
        return new TulipOidcUser(oidcUser, user.getId(), user.getEmail());
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
