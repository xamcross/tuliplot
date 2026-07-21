package com.dashdash.auth;

/** Common shape for the authenticated principal, whether password- or Google-backed. */
public interface DashPrincipal {
    String getUserId();
    String getEmail();
}
