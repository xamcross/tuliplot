package com.tuliplot.dashboard;

public class Cell {

    private int slot;
    private CellType type;
    private String url;
    private String title;
    private String catalogAppId;
    private String iconUrl;
    private OpenMode openMode = OpenMode.FRAME;

    public Cell() {}

    public Cell(int slot, CellType type, OpenMode openMode) {
        this.slot = slot;
        this.type = type;
        this.openMode = openMode;
    }

    public int getSlot() { return slot; }
    public void setSlot(int slot) { this.slot = slot; }

    public CellType getType() { return type; }
    public void setType(CellType type) { this.type = type; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCatalogAppId() { return catalogAppId; }
    public void setCatalogAppId(String catalogAppId) { this.catalogAppId = catalogAppId; }

    public String getIconUrl() { return iconUrl; }
    public void setIconUrl(String iconUrl) { this.iconUrl = iconUrl; }

    public OpenMode getOpenMode() { return openMode; }
    public void setOpenMode(OpenMode openMode) { this.openMode = openMode; }
}
