package com.tuliplot.auth;

import com.tuliplot.auth.dto.RegisterRequest;
import com.tuliplot.auth.dto.UserDto;
import com.tuliplot.dashboard.Dashboard;
import java.time.Instant;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        users.findByEmail(email).ifPresent(existing -> { throw new EmailInUseException(email); });

        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setDisplayName(req.displayName().trim());
        u.setEmailVerified(false);
        u.setCreatedAt(Instant.now());
        u.setSubscription(new Subscription());          // tier=FREE, status=NONE
        u.setDashboard(Dashboard.defaultFor(false));    // FREE default → slot 5 = AD
        return users.save(u);
    }

    public UserDto toDto(User user) {
        Tier tier = isPremium(user) ? Tier.PREMIUM : Tier.FREE;
        boolean adFree = tier == Tier.PREMIUM;
        return new UserDto(user.getId(), user.getEmail(), user.getDisplayName(), tier, adFree);
    }

    public boolean isPremium(User user) {
        Subscription sub = user.getSubscription();
        if (sub == null || sub.getStatus() == null) {
            return false;
        }
        return sub.getStatus() == SubStatus.ACTIVE || sub.getStatus() == SubStatus.TRIALING;
    }

    /** Re-hash a new password with the delegating bcrypt encoder and persist. */
    public void updatePassword(User user, String rawPassword) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        users.save(user);
    }
}
