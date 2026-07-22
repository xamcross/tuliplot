package com.tuliplot.dashboard;

/** Thrown when a cell payload violates the FREE/PREMIUM slot invariants or URL rules. Mapped to HTTP 422. */
public class InvalidCellsException extends RuntimeException {
    public InvalidCellsException(String message) {
        super(message);
    }
}
