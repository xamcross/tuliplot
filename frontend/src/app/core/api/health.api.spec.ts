import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HealthApi } from './health.api';
import { environment } from '../../../environments/environment';

describe('HealthApi', () => {
  let api: HealthApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HealthApi],
    });
    api = TestBed.inject(HealthApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs /health and returns the status payload', () => {
    let result: { status: string } | undefined;
    api.check().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/health`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'UP' });

    expect(result).toEqual({ status: 'UP' });
  });
});
