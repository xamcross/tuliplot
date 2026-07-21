import { Component, OnInit, inject, signal } from '@angular/core';
import { HealthApi } from '../../core/api/health.api';

@Component({
  selector: 'app-landing',
  template: `
    <main style="font-family: system-ui, sans-serif; padding: 2rem;">
      <h1>DashDash</h1>
      <p>API health: <strong data-testid="health">{{ status() }}</strong></p>
    </main>
  `,
})
export class LandingComponent implements OnInit {
  private readonly health = inject(HealthApi);
  readonly status = signal<string>('checking…');

  ngOnInit(): void {
    this.health.check().subscribe({
      next: (r) => this.status.set(r.status),
      error: () => this.status.set('DOWN'),
    });
  }
}
