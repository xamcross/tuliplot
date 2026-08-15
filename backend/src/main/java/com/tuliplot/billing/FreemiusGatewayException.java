package com.tuliplot.billing;

/** Unchecked wrapper for any Freemius API failure other than 404. */
public class FreemiusGatewayException extends RuntimeException {
  public FreemiusGatewayException(String message, Throwable cause) { super(message, cause); }
  public FreemiusGatewayException(String message) { super(message); }
}
