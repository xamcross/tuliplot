import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../stores/auth.store';

/**
 * Allows navigation only for authenticated users; otherwise redirects to /login.
 * AppComponent calls AuthStore.loadMe() at bootstrap, so the store is populated
 * before guarded navigations occur after the initial app load.
 */
export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return store.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
