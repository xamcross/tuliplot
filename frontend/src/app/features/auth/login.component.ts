import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, email, form, required } from '@angular/forms/signals';
import { AuthStore } from '../../stores/auth.store';
import { environment } from '../../../environments/environment';

/** Builds the Spring-managed Google OAuth2 authorization URL from the API base URL
 *  (a full-page navigation to the API origin, which 302-redirects to Google). */
export function googleAuthUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace('/api/v1', '') + '/oauth2/authorization/google';
}

@Component({
  selector: 'app-login',
  imports: [FormField],
  template: `
    <main class="auth" style="max-width: 24rem; margin: 3rem auto; font-family: system-ui, sans-serif;">
      <h1>Log in to DashDash</h1>
      <form (submit)="$event.preventDefault(); submit()">
        <label>Email
          <input type="email" autocomplete="email" [formField]="loginForm.email" />
        </label>
        <label>Password
          <input type="password" autocomplete="current-password" [formField]="loginForm.password" />
        </label>
        @if (store.status() === 'error') {
          <p class="error" role="alert">{{ store.error() }}</p>
        }
        <button type="submit" [disabled]="store.status() === 'loading'">Log in</button>
      </form>
      <a class="google-btn" [href]="googleAuthUrl">Continue with Google</a>
      <p><a routerLink="/register" href="/register">Create an account</a></p>
    </main>
  `,
})
export class LoginComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly googleAuthUrl = googleAuthUrl(environment.apiBaseUrl);

  readonly model = signal({ email: '', password: '' });
  readonly loginForm = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
  });

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });
  }

  submit(): void {
    if (this.loginForm().valid()) {
      this.store.login(this.model());
    }
  }
}
