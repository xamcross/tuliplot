import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { credentialsInterceptor } from './credentials.interceptor';
import { environment } from '../../../environments/environment';

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const clearXsrfCookie = () =>
    (document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');

  beforeEach(() => {
    clearXsrfCookie();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    clearXsrfCookie();
  });

  it('sets withCredentials on every outgoing request', () => {
    let resolved = false;
    http.get(`${environment.apiBaseUrl}/health`).subscribe(() => (resolved = true));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/health`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ status: 'UP' });

    expect(resolved).toBe(true);
  });

  it('attaches X-XSRF-TOKEN to mutating API requests when the cookie is present', () => {
    document.cookie = 'XSRF-TOKEN=tok-123; path=/';

    http.post(`${environment.apiBaseUrl}/auth/register`, { email: 'a@b.co' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/register`);
    expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('tok-123');
    req.flush({});
  });

  it('does not attach X-XSRF-TOKEN to GET requests', () => {
    document.cookie = 'XSRF-TOKEN=tok-123; path=/';

    http.get(`${environment.apiBaseUrl}/auth/me`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush({});
  });

  it('does not attach X-XSRF-TOKEN to non-API hosts', () => {
    document.cookie = 'XSRF-TOKEN=tok-123; path=/';

    http.post('https://third-party.example.com/collect', {}).subscribe();

    const req = httpMock.expectOne('https://third-party.example.com/collect');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush({});
  });
});
