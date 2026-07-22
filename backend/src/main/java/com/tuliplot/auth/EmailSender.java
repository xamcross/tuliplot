package com.tuliplot.auth;

/** Transactional email seam. Dev uses LoggingEmailSender; prod swaps in an SMTP/SES bean. */
public interface EmailSender {
    void send(String to, String subject, String body);
}
