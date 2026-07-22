package com.tuliplot.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class DashboardDefaultForTest {

    @Test
    void freeTierReservesSlot5AsAdAndRestEmpty() {
        Dashboard d = Dashboard.defaultFor(false);
        List<Cell> cells = d.getCells();

        assertThat(cells).hasSize(6);
        for (int i = 0; i < 5; i++) {
            assertThat(cells.get(i).getSlot()).isEqualTo(i);
            assertThat(cells.get(i).getType()).isEqualTo(CellType.EMPTY);
        }
        assertThat(cells.get(5).getSlot()).isEqualTo(5);
        assertThat(cells.get(5).getType()).isEqualTo(CellType.AD);
        assertThat(cells).allSatisfy(c -> assertThat(c.getOpenMode()).isEqualTo(OpenMode.FRAME));
        assertThat(d.getParkedApp()).isNull();
    }

    @Test
    void premiumTierMakesAllSixEmpty() {
        Dashboard d = Dashboard.defaultFor(true);
        List<Cell> cells = d.getCells();

        assertThat(cells).hasSize(6);
        for (int i = 0; i < 6; i++) {
            assertThat(cells.get(i).getSlot()).isEqualTo(i);
            assertThat(cells.get(i).getType()).isEqualTo(CellType.EMPTY);
        }
        assertThat(d.getParkedApp()).isNull();
    }
}
