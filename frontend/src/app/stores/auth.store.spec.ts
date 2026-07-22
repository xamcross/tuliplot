import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthStore } from './auth.store';
import { environment } from '../../environments/environment';

describe('AuthStore', () => {
  let store: ReturnType<typeof TestBed.inject<typeof AuthStore>>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts idle and anonymous', () => {
    expect(store.status()).toBe('idle');
    expect(store.isAuthenticated()).toBe(false);
    expect(store.tier()).toBe('FREE');
    expect(store.adFree()).toBe(false);
  });

  it('login success populates the user and marks authenticated', () => {
    store.login({ email: 'a@b.com', password: 'secret123' });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: '1', email: 'a@b.com', displayName: 'A', tier: 'PREMIUM', adFree: true });

    expect(store.isAuthenticated()).toBe(true);
    expect(store.status()).toBe('authenticated');
    expect(store.tier()).toBe('PREMIUM');
    expect(store.adFree()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('login failure sets error status and stays anonymous', () => {
    store.login({ email: 'a@b.com', password: 'wrong' });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    req.flush(
      { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(store.isAuthenticated()).toBe(false);
    expect(store.status()).toBe('error');
    expect(store.error()).toBe('Invalid email or password');
  });
});
