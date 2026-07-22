package com.dashdash.auth.session;

import java.time.Duration;
import java.util.Date;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.Document;
import org.bson.types.Binary;
import org.springframework.core.serializer.support.DeserializingConverter;
import org.springframework.core.serializer.support.SerializingConverter;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.session.MapSession;
import org.springframework.session.SessionRepository;

/**
 * Custom Spring Session store: persists {@link MongoSession} documents in the {@code sessions}
 * collection. Spring Session core keeps running the SessionRepositoryFilter and id generation;
 * only storage lives here. Attribute values are JDK-serialized to a {@code Binary} so any
 * serializable attribute (e.g. Spring Security's SecurityContext) survives the round-trip.
 */
public class MongoSessionRepository implements SessionRepository<MongoSession> {

    static final String COLLECTION = "sessions";

    private final MongoOperations mongoOperations;
    private final Duration defaultMaxInactiveInterval;

    private final SerializingConverter serializer = new SerializingConverter();
    private final DeserializingConverter deserializer = new DeserializingConverter();

    public MongoSessionRepository(MongoOperations mongoOperations, Duration defaultMaxInactiveInterval) {
        this.mongoOperations = mongoOperations;
        this.defaultMaxInactiveInterval = defaultMaxInactiveInterval;
    }

    @Override
    public MongoSession createSession() {
        MapSession delegate = new MapSession();
        delegate.setMaxInactiveInterval(defaultMaxInactiveInterval);
        return new MongoSession(delegate);
    }

    @Override
    public void save(MongoSession session) {
        // If the id was rotated (e.g. request.changeSessionId() on login to defeat session
        // fixation), the document under the OLD id must be removed — otherwise it stays readable
        // until its TTL and the pre-rotation id would still authenticate.
        String originalId = session.getOriginalId();
        if (originalId != null && !originalId.equals(session.getId())) {
            deleteById(originalId);
            session.setOriginalId(session.getId());
        }
        mongoOperations.getCollection(COLLECTION).replaceOne(
                Filters.eq("_id", session.getId()),
                toDocument(session),
                new ReplaceOptions().upsert(true));
    }

    @Override
    public MongoSession findById(String id) {
        Document doc = mongoOperations.getCollection(COLLECTION)
                .find(Filters.eq("_id", id))
                .first();
        if (doc == null) {
            return null;
        }
        MongoSession session = fromDocument(doc);
        if (session.isExpired()) {
            deleteById(id);
            return null;
        }
        return session;
    }

    @Override
    public void deleteById(String id) {
        mongoOperations.getCollection(COLLECTION).deleteOne(Filters.eq("_id", id));
    }

    private Document toDocument(MongoSession session) {
        MapSession delegate = session.getDelegate();
        Document attributes = new Document();
        for (String name : delegate.getAttributeNames()) {
            attributes.put(name, new Binary(serializer.convert(delegate.getAttribute(name))));
        }
        return new Document("_id", delegate.getId())
                .append("creationTime", Date.from(delegate.getCreationTime()))
                .append("lastAccessedTime", Date.from(delegate.getLastAccessedTime()))
                .append("maxInactiveIntervalSeconds", delegate.getMaxInactiveInterval().getSeconds())
                .append("expireAt", Date.from(session.getExpireAt()))
                .append("attributes", attributes);
    }

    private MongoSession fromDocument(Document doc) {
        MapSession delegate = new MapSession(doc.getString("_id"));
        delegate.setCreationTime(doc.getDate("creationTime").toInstant());
        delegate.setLastAccessedTime(doc.getDate("lastAccessedTime").toInstant());
        delegate.setMaxInactiveInterval(
                Duration.ofSeconds(((Number) doc.get("maxInactiveIntervalSeconds")).longValue()));
        Document attributes = doc.get("attributes", Document.class);
        if (attributes != null) {
            for (String name : attributes.keySet()) {
                Binary value = (Binary) attributes.get(name);
                delegate.setAttribute(name, deserializer.convert(value.getData()));
            }
        }
        return new MongoSession(delegate);
    }
}
