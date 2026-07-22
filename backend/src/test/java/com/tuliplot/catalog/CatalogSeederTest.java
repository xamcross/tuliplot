package com.tuliplot.catalog;

import com.tuliplot.testsupport.MongoTestUri;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.mongodb.test.autoconfigure.DataMongoTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataMongoTest
class CatalogSeederTest {

    @Container
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

    @DynamicPropertySource
    static void mongoProps(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", () -> MongoTestUri.directConnection(mongo));
    }

    @Autowired
    CatalogAppRepository repository;

    @Test
    void seeder_isIdempotent() {
        CatalogSeeder seeder = new CatalogSeeder(repository);
        seeder.run(null);
        seeder.run(null); // run twice — must not duplicate

        long expected = CatalogSeeder.seedData().size();
        assertThat(repository.count()).isEqualTo(expected);
        assertThat(expected).isGreaterThanOrEqualTo(8);
    }

    @Test
    void seeder_updatesStaleCompatibilityToSeedValue() {
        // Pre-existing row with a stale compatibility label.
        CatalogApp stale = new CatalogApp();
        stale.setId("hackernews");
        stale.setName("Hacker News");
        stale.setUrl("https://news.ycombinator.com");
        stale.setIconUrl("https://news.ycombinator.com/favicon.ico");
        stale.setCategory("News");
        stale.setOrder(0);
        stale.setCompatibility(Compatibility.FRAMES_CLEAN);
        repository.save(stale);

        new CatalogSeeder(repository).run(null);

        CatalogApp updated = repository.findById("hackernews").orElseThrow();
        assertThat(updated.getCompatibility()).isEqualTo(Compatibility.NEEDS_EXTENSION);
        // Upsert must not duplicate — still one row per seed id.
        assertThat(repository.count()).isEqualTo(CatalogSeeder.seedData().size());
    }

    @Test
    void repository_returnsOrderedByCategoryThenOrder() {
        new CatalogSeeder(repository).run(null);

        List<CatalogApp> apps = repository.findAllByOrderByCategoryAscOrderAsc();
        assertThat(apps).isNotEmpty();
        for (int i = 1; i < apps.size(); i++) {
            CatalogApp prev = apps.get(i - 1);
            CatalogApp cur = apps.get(i);
            int catCmp = prev.getCategory().compareTo(cur.getCategory());
            assertThat(catCmp).isLessThanOrEqualTo(0);
            if (catCmp == 0) {
                assertThat(prev.getOrder()).isLessThanOrEqualTo(cur.getOrder());
            }
        }
    }
}
