package com.dashdash.dashboard;

import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.auth.UserService;
import com.dashdash.dashboard.dto.CellDto;
import com.dashdash.dashboard.dto.DashboardDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;

@Service
public class DashboardService {

    private final UserRepository userRepository;
    private final UserService userService;

    public DashboardService(UserRepository userRepository, UserService userService) {
        this.userRepository = userRepository;
        this.userService = userService;
    }

    public DashboardDto getDashboard(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + userId));
        return toDto(user.getDashboard());
    }

    static DashboardDto toDto(Dashboard dashboard) {
        List<CellDto> cells = dashboard.getCells().stream()
                .map(DashboardService::toCellDto)
                .toList();
        CellDto parked = dashboard.getParkedApp() == null ? null : toCellDto(dashboard.getParkedApp());
        return new DashboardDto(cells, parked);
    }

    static CellDto toCellDto(Cell c) {
        return new CellDto(c.getSlot(), c.getType(), c.getUrl(), c.getTitle(),
                c.getCatalogAppId(), c.getIconUrl(), c.getOpenMode());
    }

    static Cell toCell(CellDto d) {
        Cell c = new Cell();
        c.setSlot(d.slot());
        c.setType(d.type());
        c.setUrl(d.url());
        c.setTitle(d.title());
        c.setCatalogAppId(d.catalogAppId());
        c.setIconUrl(d.iconUrl());
        c.setOpenMode(d.openMode() == null ? OpenMode.FRAME : d.openMode());
        return c;
    }
}
