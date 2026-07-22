import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { HomeComponent } from './features/home/home.component';
import { authGuard } from './core/guards/auth.guard';

// Route table is authoritative in the shared contract (Canonical Resolutions v2 -> Frontend route table):
// /login + /register are top-level public; /app is guarded (HomeComponent now, DashboardPageComponent in Plan 03).
export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'app', component: HomeComponent, canActivate: [authGuard] },
  // Plan 03 replaces HomeComponent at /app with DashboardPageComponent (no /dashboard route);
  // Plan 05 adds app/upgrade + app/settings; Plan 06 owns the marketing site + final /.
];
