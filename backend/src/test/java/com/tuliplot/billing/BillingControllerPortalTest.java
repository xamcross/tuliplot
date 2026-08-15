package com.tuliplot.billing;

import com.tuliplot.auth.DashPrincipal;
import com.tuliplot.auth.Subscription;
import com.tuliplot.auth.User;
import com.tuliplot.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BillingControllerPortalTest {

  private FreemiusGateway gateway;
  private UserRepository userRepository;
  private MockMvc mockMvc;

  private static final DashPrincipal PRINCIPAL = new DashPrincipal() {
    @Override public String getUserId() { return "u1"; }
    @Override public String getEmail() { return "a@b.com"; }
  };

  /** Resolves @AuthenticationPrincipal DashPrincipal to a fixed test principal, no SecurityContext needed. */
  private static final HandlerMethodArgumentResolver PRINCIPAL_RESOLVER = new HandlerMethodArgumentResolver() {
    @Override public boolean supportsParameter(MethodParameter p) {
      return DashPrincipal.class.isAssignableFrom(p.getParameterType());
    }
    @Override public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav,
                                            NativeWebRequest req, WebDataBinderFactory bf) {
      return PRINCIPAL;
    }
  };

  @BeforeEach
  void setup() {
    gateway = mock(FreemiusGateway.class);
    userRepository = mock(UserRepository.class);
    BillingController controller = new BillingController(gateway, userRepository);
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setCustomArgumentResolvers(PRINCIPAL_RESOLVER)
        .build();
  }

  @Test
  void returnsPortalUrlAndGatewayReceivesTheUsersEmail() throws Exception {
    User user = new User();
    user.setId("u1");
    user.setEmail("a@b.com");
    Subscription subscription = new Subscription();
    subscription.setFsLicenseId("lic-123");
    user.setSubscription(subscription);
    when(userRepository.findById("u1")).thenReturn(Optional.of(user));
    when(gateway.createPortalLoginUrl("a@b.com"))
        .thenReturn("https://users.freemius.com/login/abc");

    mockMvc.perform(post("/api/v1/billing/portal-session"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.url").value("https://users.freemius.com/login/abc"));

    verify(gateway).createPortalLoginUrl("a@b.com");
  }

  @Test
  void returns400WhenNoSubscription() throws Exception {
    User user = new User();
    user.setId("u1");
    user.setEmail("a@b.com");
    user.setSubscription(new Subscription());
    when(userRepository.findById("u1")).thenReturn(Optional.of(user));

    mockMvc.perform(post("/api/v1/billing/portal-session"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("no_subscription"));
  }

  @Test
  void checkoutSessionEndpointNoLongerExists() throws Exception {
    mockMvc.perform(post("/api/v1/billing/checkout-session"))
        .andExpect(status().isNotFound());
  }
}
