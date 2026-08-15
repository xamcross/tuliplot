package com.tuliplot.billing;

/** The Freemius API returned 404 — e.g. a deleted license. */
public class FreemiusNotFoundException extends RuntimeException {
  public FreemiusNotFoundException(String message) { super(message); }
}
