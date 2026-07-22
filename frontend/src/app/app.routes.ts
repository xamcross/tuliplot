import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { authGuard } from './core/guards/auth.guard';

// Route table is authoritative in the shared contract (Canonical Resolutions v2 -> Frontend route table):
// /login + /register are top-level public; /app is guarded (DashboardPageComponent).
export const routes: Routes = [
  { path: '', component: LandingComponent },
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
  // Plan 06 owns the marketing site + final /.
];
