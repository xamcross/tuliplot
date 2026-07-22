package com.dashdash.auth.session;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.session.MapSession;
import org.springframework.session.Session;

/**
 * A Spring Session {@link Session} persisted in MongoDB. All session behaviour is delegated to an
 * internal {@link MapSession}; the only extra state is {@code expireAt}, the absolute instant used
 * by the {@code sessions.expireAt} TTL index (see {@link com.dashdash.config.MongoIndexConfig}).
 * (De)serialization is done explicitly by {@link MongoSessionRepository}, so {@code @Document}/{@code @Id}
 * here are declarative — they name the collection and the id property the repository and index use.
 */
@Document("sessions")
public class MongoSession implements Session {

    @Id
    private String id;

    private Instant expireAt;

    @Transient
    private final MapSession delegate;

    /**
     * The id under which this session is currently persisted (i.e. the id loaded from Mongo, or the
     * id first written). Tracked separately from the delegate's live id so that after
     * {@link #changeSessionId()} the repository can DELETE the stale document at the old id instead
     * of leaving it readable until its TTL expires (a session-fixation risk).
     */
    @Transient
    private String originalId;

    public MongoSession() {
        this(new MapSession());
    }

    public MongoSession(MapSession delegate) {
        this.delegate = delegate;
        this.id = delegate.getId();
        this.originalId = delegate.getId();
        this.expireAt = computeExpireAt();
    }

    private Instant computeExpireAt() {
        Duration interval = delegate.getMaxInactiveInterval();
        if (interval == null || interval.isZero() || interval.isNegative()) {
            // A non-positive interval means "never expires"; store a far-future marker so the TTL
            // index keeps the document. isExpired() (delegated) still governs read-time expiry.
            return delegate.getLastAccessedTime().plus(Duration.ofDays(3650));
        }
        return delegate.getLastAccessedTime().plus(interval);
    }

    /** Package-private accessor used by {@link MongoSessionRepository} for (de)serialization. */
    MapSession getDelegate() { return delegate; }

    /** The id this session is persisted under; may lag {@link #getId()} after a rotation. */
    String getOriginalId() { return originalId; }

    /** Called by the repository after it reconciles storage with the current id. */
    void setOriginalId(String originalId) { this.originalId = originalId; }

    public Instant getExpireAt() { return expireAt; }
    public void setExpireAt(Instant expireAt) { this.expireAt = expireAt; }

    @Override public String getId() { return delegate.getId(); }

    @Override
    public String changeSessionId() {
        String newId = delegate.changeSessionId();
        this.id = newId;
        return newId;
    }

    @Override public <T> T getAttribute(String attributeName) { return delegate.getAttribute(attributeName); }
    @Override public Set<String> getAttributeNames() { return delegate.getAttributeNames(); }
    @Override public void setAttribute(String attributeName, Object attributeValue) { delegate.setAttribute(attributeName, attributeValue); }
    @Override public void removeAttribute(String attributeName) { delegate.removeAttribute(attributeName); }

    @Override public Instant getCreationTime() { return delegate.getCreationTime(); }

    @Override
    public void setLastAccessedTime(Instant lastAccessedTime) {
        delegate.setLastAccessedTime(lastAccessedTime);
        this.expireAt = computeExpireAt();
    }

    @Override public Instant getLastAccessedTime() { return delegate.getLastAccessedTime(); }

    @Override
    public void setMaxInactiveInterval(Duration interval) {
        delegate.setMaxInactiveInterval(interval);
        this.expireAt = computeExpireAt();
    }

    @Override public Duration getMaxInactiveInterval() { return delegate.getMaxInactiveInterval(); }

    @Override public boolean isExpired() { return delegate.isExpired(); }
}
