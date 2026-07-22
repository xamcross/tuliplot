import { Component } from '@angular/core';

/** Placeholder for the authenticated area at /app. Plan 03 replaces this component
 *  at /app with DashboardPageComponent (there is no /dashboard route);
 *  Plan 05 adds /app/upgrade + /app/settings. See the shared-contract route table. */
@Component({
  selector: 'app-home',
  template: `
    <main style="padding: 2rem; font-family: system-ui, sans-serif;">
      <h1>DashDash</h1>
      <p>You are signed in. Your dashboard will load here.</p>
    </main>
  `,
})
export class HomeComponent {}
