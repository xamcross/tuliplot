package com.dashdash.catalog.dto;

import com.dashdash.catalog.Compatibility;

public record CatalogAppDto(String id, String name, String url, String iconUrl,
                            String category, int order, Compatibility compatibility) {}
