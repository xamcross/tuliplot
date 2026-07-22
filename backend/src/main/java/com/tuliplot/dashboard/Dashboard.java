package com.tuliplot.dashboard;

import java.util.ArrayList;
import java.util.List;

public class Dashboard {

    private List<Cell> cells = new ArrayList<>();
    private Cell parkedApp;   // null normally; set to the displaced APP cell on downgrade when no slot was free

    public Dashboard() {}

    public Dashboard(List<Cell> cells) {
        this.cells = cells;
    }

    public List<Cell> getCells() { return cells; }
    public void setCells(List<Cell> cells) { this.cells = cells; }

    public Cell getParkedApp() { return parkedApp; }
    public void setParkedApp(Cell parkedApp) { this.parkedApp = parkedApp; }

    /**
     * Builds the canonical 6-cell dashboard (slots 0..5).
     * FREE (premium=false): slot 5 = AD, slots 0..4 = EMPTY.
     * PREMIUM (premium=true): all 6 cells EMPTY.
     */
    public static Dashboard defaultFor(boolean premium) {
        List<Cell> cells = new ArrayList<>(6);
        for (int slot = 0; slot < 6; slot++) {
            CellType type = (!premium && slot == 5) ? CellType.AD : CellType.EMPTY;
            cells.add(new Cell(slot, type, OpenMode.FRAME));
        }
        return new Dashboard(cells);
    }
}
