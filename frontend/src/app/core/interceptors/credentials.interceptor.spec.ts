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

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sets withCredentials on every outgoing request', () => {
    let resolved = false;
    http
      .get('http://localhost:8080/api/v1/health')
      .subscribe(() => (resolved = true));

    const req = httpMock.expectOne('http://localhost:8080/api/v1/health');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ status: 'UP' });

    expect(resolved).toBe(true);
  });
});
