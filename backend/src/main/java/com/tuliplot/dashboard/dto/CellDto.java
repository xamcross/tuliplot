package com.tuliplot.dashboard.dto;

import com.tuliplot.dashboard.CellType;
import com.tuliplot.dashboard.OpenMode;

public record CellDto(int slot, CellType type, String url, String title,
                      String catalogAppId, String iconUrl, OpenMode openMode) {}
