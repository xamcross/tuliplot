package com.dashdash.ads;

import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dashdash.ads.dto.AdConfigDto;
import com.dashdash.auth.DashOidcUserService;
import com.dashdash.auth.DashPrincipal;
import com.dashdash.auth.User;
import com.dashdash.auth.UserRepository;
import com.dashdash.config.CorsConfig;
import com.dashdash.config.SecurityConfig;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AdConfigController.class)
@Import({SecurityConfig.class, CorsConfig.class})
class AdConfigControllerTest {

  @Autowired MockMvc mvc;
  @MockitoBean AdConfigService adConfigService;
  @MockitoBean UserRepository userRepository;

  // SecurityConfig's filter chain depends on DashOidcUserService (a @Service not
  // loaded by the @WebMvcTest slice); mock it so the chain can be instantiated.
  @MockitoBean DashOidcUserService oidcUserService;

  record TestPrincipal(String userId, String email) implements DashPrincipal {
    @Override public String getUserId() { return userId; }
    @Override public String getEmail() { return email; }
  }

  @Test
  void returnsAdConfigForAuthenticatedUser() throws Exception {
    User user = new User();
    user.setId("u1");
    given(userRepository.findById("u1")).willReturn(Optional.of(user));
    given(adConfigService.forUser(user))
        .willReturn(new AdConfigDto(true, "ca-pub-1", "5"));

    DashPrincipal principal = new TestPrincipal("u1", "a@b.com");
    mvc.perform(
            get("/api/v1/config/ads")
                .with(authentication(
                    new UsernamePasswordAuthenticationToken(
                        principal, null, List.of()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.showAd").value(true))
        .andExpect(jsonPath("$.adClient").value("ca-pub-1"))
        .andExpect(jsonPath("$.adSlot").value("5"));
  }
}
