package com.dashdash.dashboard;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardReconcileTest {

    private final DashboardService service = new DashboardService(null, null);

    private static Cell cell(int slot, CellType type, String url) {
        Cell c = new Cell();
        c.setSlot(slot);
        c.setType(type);
        c.setUrl(url);
        c.setOpenMode(OpenMode.FRAME);
        return c;
    }

    private static Dashboard board(List<Cell> cells) {
        Dashboard d = new Dashboard();
        d.setCells(cells);
        return d;
    }

    @Test
    void downgrade_movesSlot5AppToFirstEmpty_andSetsAd() {
        List<Cell> cells = new ArrayList<>();
        cells.add(cell(0, CellType.EMPTY, null));       // first empty
        cells.add(cell(1, CellType.APP, "https://a.com"));
        cells.add(cell(2, CellType.EMPTY, null));
        cells.add(cell(3, CellType.EMPTY, null));
        cells.add(cell(4, CellType.EMPTY, null));
        cells.add(cell(5, CellType.APP, "https://slot5.com"));

        Dashboard result = service.reconcileForTier(board(cells), false);

        assertThat(result.getParkedApp()).isNull();
        assertThat(result.getCells().get(0).getType()).isEqualTo(CellType.APP);
        assertThat(result.getCells().get(0).getUrl()).isEqualTo("https://slot5.com");
        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.AD);
        assertThat(result.getCells().get(5).getUrl()).isNull();
    }

    @Test
    void downgrade_noEmpty_parksDisplacedApp_andSetsAd() {
        List<Cell> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, CellType.APP, "https://app" + i + ".com"));
        cells.add(cell(5, CellType.APP, "https://slot5.com"));

        Dashboard result = service.reconcileForTier(board(cells), false);

        // No empty slot: the displaced slot-5 app is parked on the Dashboard, never discarded.
        assertThat(result.getParkedApp()).isNotNull();
        assertThat(result.getParkedApp().getUrl()).isEqualTo("https://slot5.com");
        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.AD);
        for (int i = 0; i < 5; i++) {
            assertThat(result.getCells().get(i).getType()).isEqualTo(CellType.APP);
            assertThat(result.getCells().get(i).getUrl()).isEqualTo("https://app" + i + ".com");
        }
    }

    @Test
    void downgrade_slot5AlreadyAd_isUnchanged_noPark() {
        List<Cell> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, CellType.EMPTY, null));
        cells.add(cell(5, CellType.AD, null));

        Dashboard result = service.reconcileForTier(board(cells), false);

        assertThat(result.getParkedApp()).isNull();
        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.AD);
    }

    @Test
    void upgrade_turnsSlot5AdIntoEmpty_leavesParkedAppUntouched() {
        List<Cell> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, CellType.EMPTY, null));
        cells.add(cell(5, CellType.AD, null));

        Dashboard result = service.reconcileForTier(board(cells), true);

        assertThat(result.getCells().get(5).getType()).isEqualTo(CellType.EMPTY);
        assertThat(result.getCells().get(5).getUrl()).isNull();
        assertThat(result.getParkedApp()).isNull();
    }
}
