package com.dashdash.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordConfigTest {

    private final PasswordEncoder encoder = new PasswordConfig().passwordEncoder();

    @Test
    void encodesWithBcryptPrefixAndMatches() {
        String hash = encoder.encode("s3cret-pass");

        assertThat(hash).startsWith("{bcrypt}");
        assertThat(encoder.matches("s3cret-pass", hash)).isTrue();
        assertThat(encoder.matches("wrong", hash)).isFalse();
    }
}
