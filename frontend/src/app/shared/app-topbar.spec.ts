import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { AppTopbarComponent } from './app-topbar.component';
import { AuthStore } from '../stores/auth.store';

function createTopbar(tier: 'FREE' | 'PREMIUM') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AppTopbarComponent],
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { tier: signal(tier) } },
    ],
  });
  const fixture = TestBed.createComponent(AppTopbarComponent);
  fixture.detectChanges();
  return fixture;
}

describe('AppTopbarComponent', () => {
  it('shows Free plan, an upgrade link, and a settings link for FREE users', () => {
    const fixture = createTopbar('FREE');
    const el: HTMLElement = fixture.nativeElement;
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(el.textContent).toContain('Free plan');
    expect(hrefs).toContain('/app/upgrade');
    expect(hrefs).toContain('/app/settings');
  });

  it('shows Premium and no upgrade link for PREMIUM users', () => {
    const fixture = createTopbar('PREMIUM');
    const el: HTMLElement = fixture.nativeElement;
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(el.textContent).toContain('Premium');
    expect(hrefs).not.toContain('/app/upgrade');
    expect(hrefs).toContain('/app/settings');
  });
});
