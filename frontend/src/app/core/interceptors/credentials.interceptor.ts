import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const escaped = name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');
  const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Sends the first-party session cookie with every API call (withCredentials) and, for mutating
 * requests to our own API, forwards the double-submit CSRF token as the X-XSRF-TOKEN header.
 *
 * We attach the token manually because Angular's built-in withXsrfConfiguration deliberately
 * SKIPS absolute URLs, so it never sets the header on our cross-origin API (dev http://localhost:8080,
 * prod https://api.dashdash.app). Without the header every POST/PUT/DELETE fails Spring's CSRF check,
 * which for an anonymous user surfaces as 401. We scope the header to environment.apiBaseUrl so the
 * token is never leaked to third-party hosts.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  let request = req.clone({ withCredentials: true });

  if (MUTATING_METHODS.has(req.method.toUpperCase()) && req.url.startsWith(environment.apiBaseUrl)) {
    const token = readCookie('XSRF-TOKEN');
    if (token && !request.headers.has('X-XSRF-TOKEN')) {
      request = request.clone({ headers: request.headers.set('X-XSRF-TOKEN', token) });
    }
  }

  return next(request);
};
