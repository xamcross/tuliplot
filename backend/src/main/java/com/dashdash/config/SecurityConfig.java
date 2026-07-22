package com.dashdash.config;

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
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Final DashDash security filter chain (Plan 02 owns this; it replaces the
 * Plan 01 walking-skeleton baseline). Stateful session auth: the SecurityContext
 * is persisted through an HttpSessionSecurityContextRepository so JSON /auth/login
 * and /auth/register establish a cookie-backed session. Google OIDC login
 * (oauth2Login) is layered in by Plan 02 Task 6.
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
            .securityContext(sc -> sc
                .securityContextRepository(new HttpSessionSecurityContextRepository()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/v1/health",
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/catalog",
                    "/api/v1/billing/webhook",
                    "/oauth2/**",
                    "/login/oauth2/**").permitAll()
                .anyRequest().authenticated())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Built from the AuthenticationConfiguration, which auto-wires a
     * DaoAuthenticationProvider around the DashUserDetailsService (@Service) and
     * the PasswordEncoder bean (config.PasswordConfig).
     */
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
