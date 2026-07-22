import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpgradeComponent } from './upgrade.component';
import { AuthStore } from '../../stores/auth.store';
import { environment } from '../../../environments/environment';

describe('UpgradeComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthStore, useValue: { tier: signal('FREE') } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('redirects to the checkout url returned by the API', () => {
    const fixture = TestBed.createComponent(UpgradeComponent);
    const component = fixture.componentInstance;
    const redirect = vi.spyOn(component as unknown as { redirectTo: (u: string) => void }, 'redirectTo')
      .mockImplementation(() => {});

    component.upgrade();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/billing/checkout-session`);
    expect(req.request.method).toBe('POST');
    req.flush({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

    expect(redirect).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
    httpMock.verify();
  });

  it('uses the exact premium CTA copy', () => {
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.cta');
    expect(button.textContent?.trim()).toBe('Remove ad — go Premium');
  });
});
