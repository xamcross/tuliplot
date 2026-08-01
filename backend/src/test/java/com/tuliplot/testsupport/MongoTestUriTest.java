package com.tuliplot.testsupport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MongoTestUriTest {

    @Test
    void composeAppendsPerClassDbAndDirectConnection() {
        assertThat(MongoTestUri.compose("mongodb://localhost:27017", "UserRepositoryTest"))
                .isEqualTo("mongodb://localhost:27017/UserRepositoryTest?directConnection=true");
    }

    @Test
    void composeToleratesTrailingSlash() {
        assertThat(MongoTestUri.compose("mongodb://localhost:27017/", "X"))
                .isEqualTo("mongodb://localhost:27017/X?directConnection=true");
    }

    @Test
    void hostPortOnlyStripsDatabaseAndQuery() {
        assertThat(MongoTestUri.hostPortOnly("mongodb://127.0.0.1:54321/test?replicaSet=rs0"))
                .isEqualTo("mongodb://127.0.0.1:54321");
    }
}
