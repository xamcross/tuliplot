package com.tuliplot.auth;

import java.util.Collection;
import java.util.Map;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/** Wraps the Google-issued OidcUser and adds DashDash identity (userId/email). */
public class TulipOidcUser implements OidcUser, DashPrincipal {

    private final OidcUser delegate;
    private final String userId;
    private final String email;

    public TulipOidcUser(OidcUser delegate, String userId, String email) {
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
