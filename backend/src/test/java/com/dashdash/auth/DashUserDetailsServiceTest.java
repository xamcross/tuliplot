package com.dashdash.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@ExtendWith(MockitoExtension.class)
class DashUserDetailsServiceTest {

    @Mock UserRepository users;
    @InjectMocks DashUserDetailsService service;

    private User sample() {
        User u = new User();
        u.setId("u1");
        u.setEmail("bob@example.com");
        u.setPasswordHash("{bcrypt}$2a$10$hash");
        u.setDisplayName("Bob");
        return u;
    }

    @Test
    void loadsUserByEmailAsUsername() {
        when(users.findByEmail("bob@example.com")).thenReturn(Optional.of(sample()));

        UserDetails details = service.loadUserByUsername("bob@example.com");

        assertThat(details.getUsername()).isEqualTo("bob@example.com");
        assertThat(details.getPassword()).isEqualTo("{bcrypt}$2a$10$hash");
        assertThat(details.getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_USER");
        assertThat(details).isInstanceOf(DashPrincipal.class);
        assertThat(((DashPrincipal) details).getUserId()).isEqualTo("u1");
        assertThat(((DashPrincipal) details).getEmail()).isEqualTo("bob@example.com");
    }

    @Test
    void throwsWhenEmailUnknown() {
        when(users.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadUserByUsername("ghost@example.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
