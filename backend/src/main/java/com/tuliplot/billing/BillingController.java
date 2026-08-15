package com.tuliplot.billing;

import com.tuliplot.auth.DashPrincipal;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import com.tuliplot.billing.dto.PortalSessionResponse;
import com.tuliplot.common.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

  private final FreemiusGateway gateway;
  private final UserRepository userRepository;

  public BillingController(FreemiusGateway gateway, UserRepository userRepository) {
    this.gateway = gateway;
    this.userRepository = userRepository;
  }

  /** The hosted Freemius customer portal handles payment method, invoices, cancellation. */
  @PostMapping("/portal-session")
  public PortalSessionResponse createPortalSession(@AuthenticationPrincipal DashPrincipal principal) {
    User user = userRepository.findById(principal.getUserId()).orElseThrow();
    String licenseId = user.getSubscription().getFsLicenseId();
    if (licenseId == null || licenseId.isBlank()) {
      throw new NoSubscriptionException();
    }
    return new PortalSessionResponse(gateway.createPortalLoginUrl(user.getEmail()));
  }

  @ExceptionHandler(NoSubscriptionException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ApiError handleNoSubscription(NoSubscriptionException e) {
    return new ApiError("no_subscription", "no billing subscription on file");
  }

  static class NoSubscriptionException extends RuntimeException {}
}
