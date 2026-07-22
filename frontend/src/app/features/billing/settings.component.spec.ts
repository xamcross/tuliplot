import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { AuthStore } from '../../stores/auth.store';
import { environment } from '../../../environments/environment';

describe('SettingsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { tier: signal('FREE') } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('redirects to the portal url returned by the API', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    const redirect = vi.spyOn(component as unknown as { redirectTo: (u: string) => void }, 'redirectTo')
      .mockImplementation(() => {});

    component.manageBilling();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/billing/portal-session`);
    expect(req.request.method).toBe('POST');
    req.flush({ url: 'https://billing.stripe.com/p/session/test_1' });

    expect(redirect).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test_1');
    httpMock.verify();
  });
});
