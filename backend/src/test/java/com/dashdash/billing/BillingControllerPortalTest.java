package com.dashdash.billing;

import com.dashdash.auth.DashPrincipal;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BillingControllerPortalTest {

  private StripeService stripeService;
  private UserRepository userRepository;
  private MockMvc mockMvc;

  private static final DashPrincipal PRINCIPAL = new DashPrincipal() {
    @Override public String getUserId() { return "u1"; }
    @Override public String getEmail() { return "a@b.com"; }
  };

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
    stripeService = mock(StripeService.class);
    userRepository = mock(UserRepository.class);
    BillingController controller = new BillingController(stripeService, userRepository);
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setCustomArgumentResolvers(PRINCIPAL_RESOLVER)
        .build();
    User user = new User();
    user.setId("u1");
    when(userRepository.findById("u1")).thenReturn(Optional.of(user));
  }

  @Test
  void returnsPortalUrl() throws Exception {
    when(stripeService.createPortalSession(any()))
        .thenReturn("https://billing.stripe.com/p/session/test_9");

    mockMvc.perform(post("/api/v1/billing/portal-session"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.url").value("https://billing.stripe.com/p/session/test_9"));
  }

  @Test
  void returns400WhenNoCustomer() throws Exception {
    when(stripeService.createPortalSession(any()))
        .thenThrow(new NoStripeCustomerException("u1"));

    mockMvc.perform(post("/api/v1/billing/portal-session"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("no_stripe_customer"));
  }
}
