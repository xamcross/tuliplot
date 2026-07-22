package com.tuliplot.billing;

/** Unchecked wrapper for StripeException raised inside the gateway. */
public class StripeGatewayException extends RuntimeException {
  public StripeGatewayException(String message, Throwable cause) {
    super(message, cause);
  }
}
