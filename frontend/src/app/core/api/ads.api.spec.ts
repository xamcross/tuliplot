import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AdsApi } from './ads.api';
import { environment } from '../../../environments/environment';

describe('AdsApi', () => {
  let api: AdsApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AdsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs the ad config from /config/ads', () => {
    const expected = { showAd: true, adClient: 'ca-pub-1', adSlot: '5' };
    let received: unknown;
    api.getConfig().subscribe((c) => (received = c));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/config/ads`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(received).toEqual(expected);
  });
});
