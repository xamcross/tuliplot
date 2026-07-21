package com.dashdash.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Walking-skeleton security baseline. Plan 02 owns the final filter chain and
 * layers in form login, OAuth2 login, and DashPrincipal-based authorization.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${dashdash.session.cookie-domain:}")
    private String cookieDomain;

    @Value("${dashdash.session.cookie-secure:false}")
    private boolean cookieSecure;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf
                .csrfTokenRepository(cookieCsrfTokenRepository())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                .ignoringRequestMatchers("/api/v1/billing/webhook"))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/health",
                    "/api/v1/auth/**",
                    "/api/v1/catalog",
                    "/api/v1/billing/webhook",
                    "/oauth2/**").permitAll()
                .anyRequest().authenticated())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class);

        return http.build();
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
