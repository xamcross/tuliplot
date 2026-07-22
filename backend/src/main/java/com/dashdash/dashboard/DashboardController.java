package com.dashdash.dashboard;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.common.ApiError;
import com.dashdash.dashboard.dto.DashboardDto;
import com.dashdash.dashboard.dto.UpdateCellsRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardDto getDashboard(@AuthenticationPrincipal DashPrincipal principal) {
        return dashboardService.getDashboard(principal.getUserId());
    }

    @PutMapping("/cells")
    public DashboardDto updateCells(@AuthenticationPrincipal DashPrincipal principal,
                                    @Valid @RequestBody UpdateCellsRequest request) {
        return dashboardService.updateCells(principal.getUserId(), request.cells());
    }

    @ExceptionHandler(InvalidCellsException.class)
    public ResponseEntity<ApiError> handleInvalidCells(InvalidCellsException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ApiError("invalid_cells", ex.getMessage()));
    }
}
