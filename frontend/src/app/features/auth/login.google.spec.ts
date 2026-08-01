import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { googleAuthUrl, LoginComponent } from './login.component';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../stores/auth.store';

describe('googleAuthUrl', () => {
  it('strips /api/v1 and targets the Spring OAuth2 authorization endpoint', () => {
    expect(googleAuthUrl('http://localhost:8080/api/v1')).toBe(
      'http://localhost:8080/oauth2/authorization/google',
    );
    expect(googleAuthUrl('https://api.tuliplot.com/api/v1')).toBe(
      'https://api.tuliplot.com/oauth2/authorization/google',
    );
  });

  it('derives a valid URL from the configured environment base', () => {
    const url = googleAuthUrl(environment.apiBaseUrl);
    expect(url).toContain('/oauth2/authorization/google');
    expect(url).not.toContain('/api/v1');
  });

  it('sets its own page title (head reset)', () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthStore, useValue: { isAuthenticated: signal(false), status: signal('idle') } },
      ],
    });
    TestBed.createComponent(LoginComponent).detectChanges();

    expect(document.title).toBe('Log in · TulipLot');
  });
});
