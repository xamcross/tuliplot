package com.tuliplot.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tuliplot.auth.dto.RegisterRequest;
import com.tuliplot.auth.dto.UserDto;
import com.tuliplot.dashboard.CellType;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository users;
    private final PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    private UserService service() {
        return new UserService(users, encoder);
    }

    @Test
    void registerHashesPasswordAndBuildsFreeDefaults() {
        when(users.findByEmail("jane@example.com")).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("generated-id");
            return u;
        });

        User u = service().register(new RegisterRequest("Jane@Example.com", "topsecret1", "Jane"));

        assertThat(u.getEmail()).isEqualTo("jane@example.com");
        assertThat(u.getDisplayName()).isEqualTo("Jane");
        assertThat(u.getPasswordHash()).startsWith("{bcrypt}");
        assertThat(encoder.matches("topsecret1", u.getPasswordHash())).isTrue();
        assertThat(u.getSubscription().getTier()).isEqualTo(Tier.FREE);
        assertThat(u.getSubscription().getStatus()).isEqualTo(SubStatus.NONE);
        assertThat(u.getDashboard().getCells()).hasSize(6);
        assertThat(u.getDashboard().getCells().get(5).getType()).isEqualTo(CellType.AD);
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(users.findByEmail("dupe@example.com")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() ->
                service().register(new RegisterRequest("dupe@example.com", "whatever1", "Dupe")))
                .isInstanceOf(EmailInUseException.class);
        verify(users, never()).save(any());
    }

    @Test
    void toDtoMapsActiveSubscriptionToPremiumAdFree() {
        User u = new User();
        u.setId("id1");
        u.setEmail("p@example.com");
        u.setDisplayName("Prem");
        Subscription sub = new Subscription();
        sub.setStatus(SubStatus.ACTIVE);
        u.setSubscription(sub);

        UserDto dto = service().toDto(u);

        assertThat(dto.tier()).isEqualTo(Tier.PREMIUM);
        assertThat(dto.adFree()).isTrue();
    }

    @Test
    void isPremiumTrueForActiveAndTrialingOnly() {
        assertThat(service().isPremium(userWith(SubStatus.ACTIVE))).isTrue();
        assertThat(service().isPremium(userWith(SubStatus.TRIALING))).isTrue();
        assertThat(service().isPremium(userWith(SubStatus.NONE))).isFalse();
        assertThat(service().isPremium(userWith(SubStatus.PAST_DUE))).isFalse();
        assertThat(service().isPremium(userWith(SubStatus.CANCELED))).isFalse();
    }

    private User userWith(SubStatus status) {
        User u = new User();
        Subscription s = new Subscription();
        s.setStatus(status);
        u.setSubscription(s);
        return u;
    }
}
