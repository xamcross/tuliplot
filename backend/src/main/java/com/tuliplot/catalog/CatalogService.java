package com.tuliplot.catalog;

import com.tuliplot.catalog.dto.CatalogAppDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CatalogService {

    private final CatalogAppRepository repository;

    public CatalogService(CatalogAppRepository repository) {
        this.repository = repository;
    }

    public List<CatalogAppDto> list() {
        return repository.findAllByOrderByCategoryAscOrderAsc().stream()
                .map(a -> new CatalogAppDto(a.getId(), a.getName(), a.getUrl(), a.getIconUrl(),
                        a.getCategory(), a.getOrder(), a.getCompatibility()))
                .toList();
    }
}
