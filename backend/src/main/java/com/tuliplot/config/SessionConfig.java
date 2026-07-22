package com.tuliplot.config;

import java.time.Duration;
import com.tuliplot.auth.session.MongoSessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.session.config.annotation.web.http.EnableSpringHttpSession;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * Spring Session on a custom MongoDB store. Provides the {@link MongoSessionRepository} bean and the
 * session cookie: name TULIPSESSION, httpOnly + SameSite=Lax, env-driven Secure/domain, path "/".
 */
@Configuration
@EnableSpringHttpSession
public class SessionConfig {

    @Bean
    public MongoSessionRepository sessionRepository(
            MongoOperations mongoOperations,
            @Value("${tuliplot.session.max-inactive-interval:PT30M}") Duration maxInactiveInterval) {
        return new MongoSessionRepository(mongoOperations, maxInactiveInterval);
    }

    @Bean
    public CookieSerializer cookieSerializer(
            @Value("${tuliplot.session.cookie-name:TULIPSESSION}") String cookieName,
            @Value("${tuliplot.session.cookie-domain:}") String cookieDomain,
            @Value("${tuliplot.session.secure:false}") boolean cookieSecure) {

        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName(cookieName);
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(cookieSecure);
        serializer.setSameSite("Lax");
        serializer.setCookiePath("/");
        if (cookieDomain != null && !cookieDomain.isBlank()) {
            serializer.setDomainName(cookieDomain);
        }
        return serializer;
    }
}
