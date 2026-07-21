import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Ensures the first-party session cookie (and the XSRF cookie) travel with
 * every API call by setting withCredentials on each outgoing request.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
