import { TestBed } from '@angular/core/testing';
import { TlThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '../core/services/theme.service';

describe('TlThemeToggleComponent', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function render() {
    TestBed.configureTestingModule({ imports: [TlThemeToggleComponent] });
    const fixture = TestBed.createComponent(TlThemeToggleComponent);
    fixture.detectChanges();
    return { fixture, svc: TestBed.inject(ThemeService) };
  }

  it('renders a button labelled with the current preference (auto by default)', () => {
    const { fixture } = render();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="theme-toggle"]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Theme: auto. Activate for light.');
  });

  it('click cycles the preference and updates the label', async () => {
    const { fixture, svc } = render();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="theme-toggle"]');
    btn.click();
    await fixture.whenStable();
    expect(svc.preference()).toBe('light');
    expect(btn.getAttribute('aria-label')).toBe('Theme: light. Activate for dark.');
    btn.click();
    await fixture.whenStable();
    expect(svc.preference()).toBe('dark');
    expect(btn.getAttribute('aria-label')).toBe('Theme: dark. Activate for auto.');
  });

  it('shows one icon per mode', async () => {
    const { fixture } = render();
    const icon = () => fixture.nativeElement.querySelector('[data-testid="theme-toggle"] svg')?.getAttribute('data-icon');
    expect(icon()).toBe('auto');
    fixture.nativeElement.querySelector('[data-testid="theme-toggle"]').click();
    await fixture.whenStable();
    expect(icon()).toBe('light');
  });
});
