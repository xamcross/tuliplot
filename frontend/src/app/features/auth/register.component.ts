import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, email, form, minLength, required } from '@angular/forms/signals';
import { AuthStore } from '../../stores/auth.store';
import { LogoComponent } from '../../shared/logo.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'tl-register',
  imports: [FormField, RouterLink, LogoComponent],
  template: `
    <main class="auth">
      <div class="wrap">
        <tl-logo class="center" />
        <div class="card tl-card tl-card--float">
          <h1>Create your account</h1>
          <p class="sub">Free forever. No credit card.</p>
          <form (submit)="$event.preventDefault(); submit()">
            <label class="tl-field-label" for="register-name">Display name</label>
            <input id="register-name" class="tl-input mb18" type="text" placeholder="Alex Rivera"
              autocomplete="name" [formField]="registerForm.displayName" />
            <label class="tl-field-label" for="register-email">Email</label>
            <input id="register-email" class="tl-input mb18" type="email" placeholder="you@example.com"
              autocomplete="email" [formField]="registerForm.email" />
            <label class="tl-field-label" for="register-password">Password</label>
            <input id="register-password" class="tl-input mb24" type="password" placeholder="At least 8 characters"
              autocomplete="new-password" [formField]="registerForm.password" />
            @if (store.status() === 'error') {
              <p class="tl-form-error" role="alert">{{ store.error() }}</p>
            }
            <button type="submit" class="tl-btn tl-btn--primary submit"
              [disabled]="store.status() === 'loading'">Sign up free</button>
          </form>
        </div>
        <p class="alt">Already have an account? <a routerLink="/login">Log in</a></p>
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
    .alt { margin: 0; text-align: center; font-size: 15px; color: var(--tl-ink-soft); }
    .alt a { font-weight: 600; }
  `],
})
export class RegisterComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly model = signal({ email: '', password: '', displayName: '' });
  readonly registerForm = form(this.model, (p) => {
    required(p.displayName);
    required(p.email);
    email(p.email);
    required(p.password);
    minLength(p.password, 8);
  });

  constructor() {
    inject(SeoService).set({
      title: 'Create your account',
      description: 'Create a free TulipLot account — five usable cells, no credit card required.',
      path: '/register',
    });

    effect(() => {
      if (this.store.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });
  }

  submit(): void {
    if (this.registerForm().valid()) {
      this.store.register(this.model());
    }
  }
}
