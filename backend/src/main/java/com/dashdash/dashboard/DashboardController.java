package com.dashdash.dashboard;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.dashboard.dto.DashboardDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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
}
