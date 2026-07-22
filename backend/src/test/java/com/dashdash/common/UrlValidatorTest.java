package com.dashdash.common;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class UrlValidatorTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "https://mail.google.com",
            "https://trello.com/b/abc",
            "https://example.com:8443/path?q=1#frag",
            "HTTPS://Example.COM",
            "  https://news.ycombinator.com  "
    })
    void accepts_safe_https(String url) {
        assertThat(UrlValidator.isSafeHttpsUrl(url)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://example.com",
            "javascript:alert(1)",
            "data:text/plain,hello",
            "blob:https://example.com/uuid",
            "file:///etc/passwd",
            "https://user:pass@example.com",
            "ftp://example.com",
            "//example.com",
            "https://",
            "not a url",
            "https:// example.com"
    })
    void rejects_unsafe(String url) {
        assertThat(UrlValidator.isSafeHttpsUrl(url)).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t"})
    void rejects_blank(String url) {
        assertThat(UrlValidator.isSafeHttpsUrl(url)).isFalse();
    }
}
