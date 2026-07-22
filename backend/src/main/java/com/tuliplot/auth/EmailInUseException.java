package com.tuliplot.auth;

public class EmailInUseException extends RuntimeException {
    public EmailInUseException(String email) {
        super("Email already in use: " + email);
    }
}
