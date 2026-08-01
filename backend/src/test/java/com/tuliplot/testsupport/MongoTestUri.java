package com.tuliplot.testsupport;

import org.testcontainers.containers.MongoDBContainer;

/**
 * Test helper for obtaining a per-class Mongo connection URI.
 *
 * <p>Two branches: with {@code MONGODB_TEST_URI} set (a CI service container), tests connect
 * there directly; otherwise a single {@link MongoDBContainer} is started as a shared singleton
 * for the whole JVM and reused by every test class. Either way, each test class is given its own
 * database (named after the class) so classes sharing a Mongo server stay isolated from each
 * other.
 *
 * <p>{@code directConnection=true} is always appended: {@code getReplicaSetUrl()} yields a
 * {@code ?replicaSet=...} URI, which makes the driver do replica-set topology discovery. The
 * advertised member host is not reachable from the test JVM on Linux CI runners, so server
 * selection times out (all Mongo tests hang ~30s then fail) even though the container is up.
 * {@code directConnection=true} talks straight to the reachable host:port; our tests need no
 * multi-document transactions, so a direct connection is sufficient and works identically on
 * local Docker Desktop and CI.
 */
public final class MongoTestUri {

    static final String ENV_VAR = "MONGODB_TEST_URI";

    private static MongoDBContainer shared;

    private MongoTestUri() {
    }

    /**
     * Per-class Mongo URI. With MONGODB_TEST_URI set (CI service container), connects there;
     * otherwise starts one shared local Testcontainer for the whole JVM. Each test class gets
     * its own database (class simple name) so classes sharing a server stay isolated.
     */
    public static String uriFor(Class<?> testClass) {
        String env = System.getenv(ENV_VAR);
        String base = (env != null && !env.isBlank()) ? env : sharedContainerBase();
        return compose(base, testClass.getSimpleName());
    }

    /** Pure: joins a mongodb://host:port base with a per-class database and directConnection flag. */
    static String compose(String base, String dbName) {
        return base.replaceAll("/+$", "") + "/" + dbName + "?directConnection=true";
    }

    /** Pure: strips any path/query from a driver URL down to mongodb://host:port. */
    static String hostPortOnly(String url) {
        return url.replaceAll("^(mongodb://[^/?]+).*$", "$1");
    }

    private static synchronized String sharedContainerBase() {
        if (shared == null) {
            shared = new MongoDBContainer("mongo:8.0");
            shared.start(); // no explicit stop: Ryuk reaps it at JVM exit
        }
        return hostPortOnly(shared.getReplicaSetUrl());
    }
}
