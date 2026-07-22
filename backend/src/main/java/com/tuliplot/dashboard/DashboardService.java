package com.tuliplot.dashboard;

import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.auth.UserService;
import com.tuliplot.common.UrlValidator;
import com.tuliplot.dashboard.dto.CellDto;
import com.tuliplot.dashboard.dto.DashboardDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

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

    public DashboardDto updateCells(String userId, List<CellDto> cells) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + userId));
        boolean premium = userService.isPremium(user);

        validateStructure(cells);
        validateInvariants(cells, premium);

        List<Cell> newCells = new ArrayList<>(6);
        cells.stream()
                .sorted(Comparator.comparingInt(CellDto::slot))
                .forEach(d -> newCells.add(normalize(d)));

        Dashboard dashboard = user.getDashboard();
        dashboard.setCells(newCells);
        dashboard.setParkedApp(null); // a cells PUT is the resolution of the parked-app prompt: clear it so the prompt does not re-appear on reload
        userRepository.save(user);
        return toDto(dashboard);
    }

    private static void validateStructure(List<CellDto> cells) {
        if (cells == null || cells.size() != 6) {
            throw new InvalidCellsException("Dashboard must have exactly 6 cells");
        }
        Set<Integer> seen = new HashSet<>();
        for (CellDto c : cells) {
            int s = c.slot();
            if (s < 0 || s > 5) {
                throw new InvalidCellsException("Slot out of range: " + s);
            }
            if (!seen.add(s)) {
                throw new InvalidCellsException("Duplicate slot: " + s);
            }
            if (c.type() == null) {
                throw new InvalidCellsException("Cell type is required at slot " + s);
            }
        }
    }

    private static void validateInvariants(List<CellDto> cells, boolean premium) {
        long adCount = cells.stream().filter(c -> c.type() == CellType.AD).count();
        CellDto slot5 = cells.stream().filter(c -> c.slot() == 5).findFirst().orElseThrow();

        if (premium) {
            if (adCount > 0) {
                throw new InvalidCellsException("Premium dashboards cannot contain an AD cell");
            }
        } else {
            if (slot5.type() != CellType.AD) {
                throw new InvalidCellsException("Free tier requires slot 5 to be the AD cell");
            }
            if (adCount != 1) {
                throw new InvalidCellsException("Free tier must have exactly one AD cell (slot 5)");
            }
        }

        for (CellDto c : cells) {
            if (c.type() == CellType.APP && !UrlValidator.isSafeHttpsUrl(c.url())) {
                throw new InvalidCellsException("APP cell at slot " + c.slot() + " has an invalid URL");
            }
        }
    }

    private static Cell normalize(CellDto d) {
        Cell c = new Cell();
        c.setSlot(d.slot());
        c.setType(d.type());
        c.setOpenMode(d.openMode() == null ? OpenMode.FRAME : d.openMode());
        if (d.type() == CellType.APP) {
            c.setUrl(d.url());
            c.setTitle(d.title());
            c.setCatalogAppId(d.catalogAppId());
            c.setIconUrl(d.iconUrl());
        }
        // AD / EMPTY: url/title/catalogAppId/iconUrl left null (cleared)
        return c;
    }

    public Dashboard reconcileForTier(Dashboard current, boolean premium) {
        List<Cell> cells = new ArrayList<>(6);
        for (Cell c : current.getCells()) {
            cells.add(copyOf(c));
        }
        cells.sort(Comparator.comparingInt(Cell::getSlot));

        // Carry any existing parked app across unchanged; only a no-free-slot downgrade overwrites it.
        Cell parked = current.getParkedApp() == null ? null : copyOf(current.getParkedApp());
        Cell slot5 = cells.get(5);

        if (premium) {
            if (slot5.getType() == CellType.AD) {
                clearContent(slot5);
                slot5.setType(CellType.EMPTY);
            }
            // parkedApp is left untouched on upgrade.
        } else {
            if (slot5.getType() == CellType.APP) {
                int target = firstEmptySlot(cells);
                if (target >= 0) {
                    copyContentInto(cells.get(target), slot5);
                } else {
                    parked = copyOf(slot5); // no free slot: park the displaced app, never discard it
                }
            }
            clearContent(slot5);
            slot5.setType(CellType.AD);
        }

        Dashboard result = new Dashboard();
        result.setCells(cells);
        result.setParkedApp(parked); // whole Dashboard, including parkedApp, is what gets returned and persisted
        return result;
    }

    private static int firstEmptySlot(List<Cell> cells) {
        for (int i = 0; i < 5; i++) {
            if (cells.get(i).getType() == CellType.EMPTY) {
                return i;
            }
        }
        return -1;
    }

    private static Cell copyOf(Cell c) {
        Cell n = new Cell();
        n.setSlot(c.getSlot());
        n.setType(c.getType());
        n.setUrl(c.getUrl());
        n.setTitle(c.getTitle());
        n.setCatalogAppId(c.getCatalogAppId());
        n.setIconUrl(c.getIconUrl());
        n.setOpenMode(c.getOpenMode());
        return n;
    }

    private static void copyContentInto(Cell dest, Cell src) {
        dest.setType(src.getType());
        dest.setUrl(src.getUrl());
        dest.setTitle(src.getTitle());
        dest.setCatalogAppId(src.getCatalogAppId());
        dest.setIconUrl(src.getIconUrl());
        dest.setOpenMode(src.getOpenMode());
        // dest.slot deliberately unchanged
    }

    private static void clearContent(Cell c) {
        c.setUrl(null);
        c.setTitle(null);
        c.setCatalogAppId(null);
        c.setIconUrl(null);
        c.setOpenMode(OpenMode.FRAME);
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
