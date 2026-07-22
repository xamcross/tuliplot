package com.tuliplot.common;

import java.net.URI;
import java.net.URISyntaxException;

public final class UrlValidator {

    private UrlValidator() {}

    /**
     * True only for absolute https URLs with a real host, no embedded credentials,
     * and no dangerous schemes (javascript:/data:/blob:/file:/http:...).
     */
    public static boolean isSafeHttpsUrl(String url) {
        if (url == null) {
            return false;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        final URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException e) {
            return false;
        }
        String scheme = uri.getScheme();
        if (scheme == null || !scheme.equalsIgnoreCase("https")) {
            return false;
        }
        if (uri.getRawUserInfo() != null) { // reject user:pass@host
            return false;
        }
        String host = uri.getHost();
        return host != null && !host.isBlank();
    }
}
