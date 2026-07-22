package com.tuliplot.catalog;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CatalogAppRepository extends MongoRepository<CatalogApp, String> {
    List<CatalogApp> findAllByOrderByCategoryAscOrderAsc();
}
