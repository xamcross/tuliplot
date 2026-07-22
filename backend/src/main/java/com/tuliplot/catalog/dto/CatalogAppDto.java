package com.tuliplot.catalog.dto;

import com.tuliplot.catalog.Compatibility;

public record CatalogAppDto(String id, String name, String url, String iconUrl,
                            String category, int order, Compatibility compatibility) {}
