package com.tuliplot.common;

/** Uniform JSON error body returned by {@link GlobalExceptionHandler}. */
public record ApiError(String code, String message) {
}
