package com.dashdash.auth;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("password_reset_tokens")
public class PasswordResetToken {

    @Id
    private String id;
    private String userId;
    private String tokenHash;   // SHA-256 hex of the raw token; the raw token is never stored
    private Instant expiresAt;  // TTL-indexed in MongoIndexConfig

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}
