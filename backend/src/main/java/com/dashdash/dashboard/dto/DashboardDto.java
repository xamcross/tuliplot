package com.dashdash.dashboard.dto;

import java.util.List;

public record DashboardDto(List<CellDto> cells, CellDto parkedApp) {}
