import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { authGuard } from './core/guards/auth.guard';

// Route table is authoritative in the shared contract (Canonical Resolutions v2 -> Frontend route table):
// /login + /register are top-level public; /app is guarded (DashboardPageComponent).
// Plan 06 owns the marketing site + the final '/'.
export const routes: Routes = [
  { path: '', loadComponent: () =>
      import('./features/marketing/landing.component').then((m) => m.LandingComponent) },
  { path: 'about', loadComponent: () =>
      import('./features/marketing/about.component').then((m) => m.AboutComponent) },
  { path: 'privacy', loadComponent: () =>
      import('./features/marketing/privacy.component').then((m) => m.PrivacyComponent) },
  { path: 'terms', loadComponent: () =>
      import('./features/marketing/terms.component').then((m) => m.TermsComponent) },
  { path: 'contact', loadComponent: () =>
      import('./features/marketing/contact.component').then((m) => m.ContactComponent) },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'app/upgrade',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/billing/upgrade.component').then((m) => m.UpgradeComponent),
  },
  {
    path: 'app/settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/billing/settings.component').then((m) => m.SettingsComponent),
  },
];
