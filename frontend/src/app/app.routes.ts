import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { authGuard } from './core/guards/auth.guard';
import { provideServerDashboardSource } from './features/dashboard/dashboard-source';

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
  { path: 'guides', loadComponent: () =>
      import('./features/marketing/guides-list.component').then((m) => m.GuidesListComponent) },
  { path: 'guides/:slug', loadComponent: () =>
      import('./features/marketing/guide-detail.component').then((m) => m.GuideDetailComponent) },
  { path: 'blog', loadComponent: () =>
      import('./features/marketing/blog-list.component').then((m) => m.BlogListComponent) },
  { path: 'blog/:slug', loadComponent: () =>
      import('./features/marketing/blog-detail.component').then((m) => m.BlogDetailComponent) },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'app',
    canActivate: [authGuard],
    providers: [provideServerDashboardSource()],
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
  { path: '404', loadComponent: () =>
      import('./features/marketing/not-found.component').then((m) => m.NotFoundComponent) },
  { path: '**', loadComponent: () =>
      import('./features/marketing/not-found.component').then((m) => m.NotFoundComponent) },
];
