import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  // Plan 06 replaces the placeholder landing with the real prerendered marketing site.
];
