package com.dashdash.dashboard.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateCellsRequest(@Size(min = 6, max = 6) @Valid List<CellDto> cells) {}
