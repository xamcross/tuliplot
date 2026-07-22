package com.dashdash.catalog;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("catalog_apps")
public class CatalogApp {

    @Id
    private String id;
    private String name;
    private String url;
    private String iconUrl;
    private String category;
    private int order;
    private Compatibility compatibility;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getIconUrl() { return iconUrl; }
    public void setIconUrl(String iconUrl) { this.iconUrl = iconUrl; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }
    public Compatibility getCompatibility() { return compatibility; }
    public void setCompatibility(Compatibility compatibility) { this.compatibility = compatibility; }
}
