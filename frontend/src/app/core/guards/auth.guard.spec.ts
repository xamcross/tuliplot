import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '../../stores/auth.store';

function runGuard(isAuthenticated: boolean) {
  const urlTree = {} as UrlTree;
  const router = { createUrlTree: vi.fn(() => urlTree) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: { isAuthenticated: signal(isAuthenticated) } },
      { provide: Router, useValue: router },
    ],
  });
  const result = TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return { result, router, urlTree };
}

describe('authGuard', () => {
  it('allows navigation when authenticated', () => {
    const { result } = runGuard(true);
    expect(result).toBe(true);
  });

  it('redirects to /login when anonymous', () => {
    const { result, router, urlTree } = runGuard(false);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(urlTree);
  });
});
