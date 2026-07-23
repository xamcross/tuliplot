import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, email, form, required } from '@angular/forms/signals';
import { AuthStore } from '../../stores/auth.store';
import { environment } from '../../../environments/environment';
import { LogoComponent } from '../../shared/logo.component';

/** Builds the Spring-managed Google OAuth2 authorization URL from the API base URL
 *  (a full-page navigation to the API origin, which 302-redirects to Google). */
export function googleAuthUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace('/api/v1', '') + '/oauth2/authorization/google';
}

@Component({
  selector: 'tl-login',
  imports: [FormField, RouterLink, LogoComponent],
  template: `
    <main class="auth">
      <div class="wrap">
        <tl-logo class="center" />
        <div class="card tl-card tl-card--float">
          <h1>Welcome back</h1>
          <p class="sub">Log in to your dashboard.</p>
          <form (submit)="$event.preventDefault(); submit()">
            <label class="tl-field-label" for="login-email">Email</label>
            <input id="login-email" class="tl-input mb18" type="email" placeholder="you@example.com"
              autocomplete="email" [formField]="loginForm.email" />
            <label class="tl-field-label" for="login-password">Password</label>
            <input id="login-password" class="tl-input mb24" type="password" placeholder="••••••••"
              autocomplete="current-password" [formField]="loginForm.password" />
            @if (store.status() === 'error') {
              <p class="tl-form-error" role="alert">{{ store.error() }}</p>
            }
            <button type="submit" class="tl-btn tl-btn--primary submit"
              [disabled]="store.status() === 'loading'">Log in</button>
          </form>
          <div class="divider"><span></span>or<span></span></div>
          <a class="google" [href]="googleAuthUrl">
            <span class="g" aria-hidden="true"></span>
            Continue with Google
          </a>
        </div>
        <p class="alt">New here? <a routerLink="/register">Create an account</a></p>
      </div>
    </main>
  `,
  styles: [`
    .auth { min-height: 100vh; background: var(--tl-grad); display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 40px; }
    .wrap { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 22px; }
    .center { align-self: center; }
    .card { padding: 36px; }
    h1 { margin: 0 0 6px; font-family: var(--tl-font-display); font-weight: 700; font-size: 28px; color: var(--tl-ink); }
    .sub { margin: 0 0 26px; font-size: 15px; color: var(--tl-ink-soft); }
    .mb18 { margin-bottom: 18px; }
    .mb24 { margin-bottom: 24px; }
    .submit { width: 100%; padding: 14px; }
    .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--tl-ink-faint); font-size: 13px; }
    .divider span { flex: 1; height: 1px; background: var(--tl-border); }
    .google { display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none;
      font-weight: 600; font-size: 15px; color: var(--tl-ink); background: var(--tl-card-bg);
      border: 1.5px solid var(--tl-border-strong); border-radius: 999px; padding: 13px; }
    .g { width: 18px; height: 18px; border-radius: 50%;
      background: conic-gradient(#EA4335, #FBBC05, #34A853, #4285F4); }
    .alt { margin: 0; text-align: center; font-size: 15px; color: var(--tl-ink-soft); }
    .alt a { font-weight: 600; }
  `],
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
