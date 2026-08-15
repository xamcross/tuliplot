import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { AuthStore } from '../../stores/auth.store';
import { environment } from '../../../environments/environment';

describe('SettingsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            tier: signal('FREE'),
            user: signal({ displayName: 'Jane Doe', email: 'jane@example.com' }),
            logout: vi.fn(),
          },
        },
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
    req.flush({ url: 'https://customer-portal.freemius.com/session/test_1' });

    expect(redirect).toHaveBeenCalledWith('https://customer-portal.freemius.com/session/test_1');
    httpMock.verify();
  });

  it('logout button calls AuthStore.logout and navigates to the landing page', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement.querySelector('[data-testid="logout-btn"]') as HTMLButtonElement).click();

    expect(TestBed.inject(AuthStore).logout).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('displays the Freemius portal hint text', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const hint = fixture.nativeElement.querySelector('.hint');
    expect(hint.textContent).toBe('Manage payment method, invoices, and cancellation through the Freemius customer portal.');
  });

  it('does not render the word "Stripe" anywhere on the page', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const pageText = fixture.nativeElement.textContent;
    expect(pageText).not.toContain('Stripe');
  });
});
