package com.tuliplot.testsupport;

import org.testcontainers.containers.MongoDBContainer;

/**
 * Test helper for connecting to a single-node {@link MongoDBContainer}.
 *
 * <p>{@code getReplicaSetUrl()} yields a {@code ?replicaSet=...} URI, which makes the driver do
 * replica-set topology discovery. The advertised member host is not reachable from the test JVM on
 * Linux CI runners, so server selection times out (all Mongo tests hang ~30s then fail) even though
 * the container is up. {@code directConnection=true} talks straight to the reachable mapped
 * host:port; our tests need no multi-document transactions, so a direct connection is sufficient and
 * works identically on local Docker Desktop and CI.
 */
public final class MongoTestUri {

    private MongoTestUri() {
    }

    public static String directConnection(MongoDBContainer mongo) {
        return mongo.getReplicaSetUrl().replaceAll("\\?replicaSet=[^&]*", "?directConnection=true");
    }
}
