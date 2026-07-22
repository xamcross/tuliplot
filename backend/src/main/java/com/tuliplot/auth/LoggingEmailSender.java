package com.tuliplot.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Dev EmailSender: logs the message (including the reset link) instead of sending it. */
@Component
public class LoggingEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("[email] to={} subject=\"{}\" body=\"{}\"", to, subject, body);
    }
}
