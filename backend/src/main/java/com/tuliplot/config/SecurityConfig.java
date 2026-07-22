package com.tuliplot.config;

import com.tuliplot.auth.TulipOidcUserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Final DashDash security filter chain (Plan 02 owns this). Stateful session auth
 * (HttpSessionSecurityContextRepository) for JSON /auth/login + /auth/register,
 * plus Google OIDC via oauth2Login. On OIDC success the browser is redirected to
 * the UI /app route (env-driven, since UI and API are different origins).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${dashdash.session.cookie-domain:}")
    private String cookieDomain;

    @Value("${dashdash.session.cookie-secure:false}")
    private boolean cookieSecure;

    @Value("${dashdash.oauth2.success-url:https://dashdash.app/app}")
    private String oauth2SuccessUrl;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            CorsConfigurationSource corsConfigurationSource,
                                            TulipOidcUserService oidcUserService) throws Exception {
        SimpleUrlAuthenticationSuccessHandler successHandler =
                new SimpleUrlAuthenticationSuccessHandler(oauth2SuccessUrl);
        successHandler.setAlwaysUseDefaultTargetUrl(true);

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf
                .csrfTokenRepository(cookieCsrfTokenRepository())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                .ignoringRequestMatchers("/api/v1/billing/webhook"))
            .securityContext(sc -> sc
                .securityContextRepository(new HttpSessionSecurityContextRepository()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/health",
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/auth/password-reset/**",
                    "/api/v1/catalog",
                    "/api/v1/billing/webhook",
                    "/oauth2/**",
                    "/login/oauth2/**").permitAll()
                .anyRequest().authenticated())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .oauth2Login(oauth -> oauth
                .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService))
                .successHandler(successHandler))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    private CookieCsrfTokenRepository cookieCsrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(builder -> {
            builder.sameSite("Lax");
            builder.secure(cookieSecure);
            builder.path("/");
            if (StringUtils.hasText(cookieDomain)) {
                builder.domain(cookieDomain);
            }
        });
        return repository;
    }
}
