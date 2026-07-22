package com.tuliplot.dashboard.dto;

import java.util.List;

public record DashboardDto(List<CellDto> cells, CellDto parkedApp) {}
