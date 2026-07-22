package com.tuliplot.dashboard;

import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.auth.UserService;
import com.tuliplot.dashboard.dto.DashboardDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock UserRepository userRepository;
    @Mock UserService userService;
    @InjectMocks DashboardService dashboardService;

    @Test
    void getDashboard_returnsFreeDefault_slot5IsAd() {
        User user = new User();
        user.setId("u1");
        user.setDashboard(Dashboard.defaultFor(false)); // FREE default

        when(userRepository.findById("u1")).thenReturn(Optional.of(user));

        DashboardDto dto = dashboardService.getDashboard("u1");

        assertThat(dto.cells()).hasSize(6);
        assertThat(dto.cells().get(5).type()).isEqualTo(CellType.AD);
        assertThat(dto.cells().stream().filter(c -> c.type() == CellType.AD).count()).isEqualTo(1);
        for (int i = 0; i < 5; i++) {
            assertThat(dto.cells().get(i).type()).isEqualTo(CellType.EMPTY);
            assertThat(dto.cells().get(i).slot()).isEqualTo(i);
        }
    }
}
