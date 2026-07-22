import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, email, form, minLength, required } from '@angular/forms/signals';
import { AuthStore } from '../../stores/auth.store';

@Component({
  selector: 'tl-register',
  imports: [FormField],
  template: `
    <main class="auth" style="max-width: 24rem; margin: 3rem auto; font-family: system-ui, sans-serif;">
      <h1>Create your DashDash account</h1>
      <form (submit)="$event.preventDefault(); submit()">
        <label>Display name
          <input type="text" autocomplete="name" [formField]="registerForm.displayName" />
        </label>
        <label>Email
          <input type="email" autocomplete="email" [formField]="registerForm.email" />
        </label>
        <label>Password
          <input type="password" autocomplete="new-password" [formField]="registerForm.password" />
        </label>
        @if (store.status() === 'error') {
          <p class="error" role="alert">{{ store.error() }}</p>
        }
        <button type="submit" [disabled]="store.status() === 'loading'">Sign up</button>
      </form>
      <p><a routerLink="/login" href="/login">Already have an account? Log in</a></p>
    </main>
  `,
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
