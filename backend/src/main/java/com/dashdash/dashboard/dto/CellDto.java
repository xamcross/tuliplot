package com.dashdash.dashboard.dto;

import com.dashdash.dashboard.CellType;
import com.dashdash.dashboard.OpenMode;

public record CellDto(int slot, CellType type, String url, String title,
                      String catalogAppId, String iconUrl, OpenMode openMode) {}
