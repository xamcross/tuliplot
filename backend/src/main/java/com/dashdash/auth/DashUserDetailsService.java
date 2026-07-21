package com.dashdash.auth;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class DashUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public DashUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return users.findByEmail(username)
                .map(DashUserDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException("No user with email " + username));
    }
}
