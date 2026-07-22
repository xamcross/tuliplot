package com.dashdash.dashboard;

import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.auth.UserService;
import com.dashdash.dashboard.dto.CellDto;
import com.dashdash.dashboard.dto.DashboardDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceUpdateTest {

    @Mock UserRepository userRepository;
    @Mock UserService userService;
    @InjectMocks DashboardService service;

    private User userWith(Dashboard d) {
        User u = new User();
        u.setId("u1");
        u.setDashboard(d);
        return u;
    }

    private static CellDto empty(int slot) {
        return new CellDto(slot, CellType.EMPTY, null, null, null, null, OpenMode.FRAME);
    }

    @Test
    void updateCells_validFreeLayout_persistsAndReturns() {
        User user = userWith(Dashboard.defaultFor(false));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(false);

        List<CellDto> cells = new ArrayList<>();
        cells.add(new CellDto(0, CellType.APP, "https://mail.google.com", "Gmail", null, null, OpenMode.FRAME));
        for (int i = 1; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.AD, null, null, null, null, OpenMode.FRAME));

        DashboardDto dto = service.updateCells("u1", cells);

        assertThat(dto.cells()).hasSize(6);
        assertThat(dto.cells().get(0).type()).isEqualTo(CellType.APP);
        assertThat(dto.cells().get(0).url()).isEqualTo("https://mail.google.com");
        assertThat(dto.cells().get(5).type()).isEqualTo(CellType.AD);
        verify(userRepository).save(user);
    }

    @Test
    void updateCells_validPremiumLayout_allowsAppInSlot5_noAd() {
        User user = userWith(Dashboard.defaultFor(true));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(true);

        List<CellDto> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.APP, "https://trello.com", "Trello", null, null, OpenMode.FRAME));

        DashboardDto dto = service.updateCells("u1", cells);

        assertThat(dto.cells().get(5).type()).isEqualTo(CellType.APP);
        assertThat(dto.cells().stream().noneMatch(c -> c.type() == CellType.AD)).isTrue();
    }

    @Test
    void updateCells_freeWithAppInSlot5_throws() {
        User user = userWith(Dashboard.defaultFor(false));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(false);

        List<CellDto> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.APP, "https://trello.com", "Trello", null, null, OpenMode.FRAME));

        assertThatThrownBy(() -> service.updateCells("u1", cells))
                .isInstanceOf(InvalidCellsException.class);
    }

    @Test
    void updateCells_badUrl_throws() {
        User user = userWith(Dashboard.defaultFor(false));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userService.isPremium(user)).thenReturn(false);

        List<CellDto> cells = new ArrayList<>();
        cells.add(new CellDto(0, CellType.APP, "javascript:alert(1)", "x", null, null, OpenMode.FRAME));
        for (int i = 1; i < 5; i++) cells.add(empty(i));
        cells.add(new CellDto(5, CellType.AD, null, null, null, null, OpenMode.FRAME));

        assertThatThrownBy(() -> service.updateCells("u1", cells))
                .isInstanceOf(InvalidCellsException.class);
    }
}
