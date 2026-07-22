package com.dashdash.ads;

import com.dashdash.ads.dto.AdConfigDto;
import com.dashdash.auth.DashPrincipal;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/config")
public class AdConfigController {

  private final AdConfigService adConfigService;
  private final UserRepository userRepository;

  public AdConfigController(
      AdConfigService adConfigService, UserRepository userRepository) {
    this.adConfigService = adConfigService;
    this.userRepository = userRepository;
  }

  @GetMapping("/ads")
  public AdConfigDto getAdsConfig(@AuthenticationPrincipal DashPrincipal principal) {
    User user =
        userRepository
            .findById(principal.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    return adConfigService.forUser(user);
  }
}
