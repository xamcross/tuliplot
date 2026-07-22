package com.tuliplot.ads;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.tuliplot.ads.dto.AdConfigDto;
import com.tuliplot.auth.SubStatus;
import com.tuliplot.auth.Subscription;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserService;
import org.junit.jupiter.api.Test;

class AdConfigServiceTest {

  // showAd is derived from UserService.isPremium (status in {ACTIVE,TRIALING}),
  // NOT the denormalized subscription.tier field — so we mock the predicate.
  private final UserService userService = mock(UserService.class);

  private User userWithStatus(SubStatus status) {
    Subscription sub = new Subscription();
    sub.setStatus(status);
    User user = new User();
    user.setSubscription(sub);
    return user;
  }

  @Test
  void freeUserShowsAdWithConfiguredClientAndSlot() {
    User user = userWithStatus(SubStatus.NONE); // non-premium
    given(userService.isPremium(user)).willReturn(false);
    AdConfigService service = new AdConfigService(userService, "ca-pub-123", "9999");
    AdConfigDto dto = service.forUser(user);
    assertThat(dto.showAd()).isTrue();
    assertThat(dto.adClient()).isEqualTo("ca-pub-123");
    assertThat(dto.adSlot()).isEqualTo("9999");
  }

  @Test
  void premiumUserDoesNotShowAd() {
    User user = userWithStatus(SubStatus.ACTIVE); // premium
    given(userService.isPremium(user)).willReturn(true);
    AdConfigService service = new AdConfigService(userService, "ca-pub-123", "9999");
    AdConfigDto dto = service.forUser(user);
    assertThat(dto.showAd()).isFalse();
  }

  @Test
  void emptyEnvYieldsEmptyClientAndSlotButStillShowsForFree() {
    User user = userWithStatus(SubStatus.NONE); // non-premium
    given(userService.isPremium(user)).willReturn(false);
    AdConfigService service = new AdConfigService(userService, "", "");
    AdConfigDto dto = service.forUser(user);
    assertThat(dto.showAd()).isTrue();
    assertThat(dto.adClient()).isEmpty();
    assertThat(dto.adSlot()).isEmpty();
  }
}
