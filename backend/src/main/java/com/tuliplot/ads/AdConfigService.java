package com.tuliplot.ads;

import com.tuliplot.ads.dto.AdConfigDto;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AdConfigService {

  private final UserService userService;
  private final String adClient;
  private final String adSlot;

  public AdConfigService(
      UserService userService,
      @Value("${adsense.client:}") String adClient,
      @Value("${adsense.slot:}") String adSlot) {
    this.userService = userService;
    this.adClient = adClient;
    this.adSlot = adSlot;
  }

  public AdConfigDto forUser(User user) {
    // Single premium predicate (status in {ACTIVE, TRIALING}); never branch on
    // the denormalized subscription.tier field.
    boolean showAd = !userService.isPremium(user);
    return new AdConfigDto(showAd, adClient, adSlot);
  }

  /** Signed-out visitors on the public /try page always see the ad cell. */
  public AdConfigDto forAnonymous() {
    return new AdConfigDto(true, adClient, adSlot);
  }
}
