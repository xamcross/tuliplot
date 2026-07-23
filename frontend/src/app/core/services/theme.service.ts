import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'auto' | 'light' | 'dark';
export const THEME_STORAGE_KEY = 'tl-theme';

const CYCLE: Record<ThemePreference, ThemePreference> = { auto: 'light', light: 'dark', dark: 'auto' };

/** Owns the three-way theme preference and stamps the resolved theme on <html>.
 *  The inline script in index.html applies the same rule pre-bootstrap. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly pref = signal<ThemePreference>('auto');
  readonly preference = this.pref.asReadonly();
  private media: MediaQueryList | null = null;

  init(): void {
    if (typeof window === 'undefined') return;
    const stored = this.read();
    this.pref.set(stored);
    this.media = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    this.media?.addEventListener('change', (ev) => {
      if (this.pref() === 'auto') this.apply(ev.matches ? 'dark' : 'light');
    });
    this.applyResolved();
  }

  setPreference(p: ThemePreference): void {
    this.pref.set(p);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      /* storage unavailable (private mode) — theme still applies for this page load */
    }
    this.applyResolved();
  }

  cycle(): void {
    this.setPreference(CYCLE[this.pref()]);
  }

  private read(): ThemePreference {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch {
      return 'auto';
    }
  }

  private applyResolved(): void {
    const p = this.pref();
    this.apply(p === 'auto' ? (this.media?.matches ? 'dark' : 'light') : p);
  }

  private apply(theme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }
}
