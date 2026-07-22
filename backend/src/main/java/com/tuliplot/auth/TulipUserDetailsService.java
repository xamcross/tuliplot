package com.tuliplot.auth;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class TulipUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public TulipUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return users.findByEmail(username)
                .map(TulipUserDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException("No user with email " + username));
    }
}
