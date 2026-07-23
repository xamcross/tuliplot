import { TestBed } from '@angular/core/testing';
import { ThemeService, THEME_STORAGE_KEY } from './theme.service';

type MediaListener = (ev: { matches: boolean }) => void;

function stubMatchMedia(initialMatches: boolean): { listeners: MediaListener[]; mql: MediaQueryList } {
  const listeners: MediaListener[] = [];
  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: MediaListener) => listeners.push(fn),
    removeEventListener: (_: string, fn: MediaListener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', () => mql);
  return { listeners, mql };
}

describe('ThemeService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function create(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  it('defaults to auto and applies the OS scheme (light) on init', () => {
    stubMatchMedia(false);
    const svc = create();
    svc.init();
    expect(svc.preference()).toBe('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applies dark on init when the OS prefers dark and no preference is stored', () => {
    stubMatchMedia(true);
    const svc = create();
    svc.init();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores a stored explicit preference over the OS scheme', () => {
    stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const svc = create();
    svc.init();
    expect(svc.preference()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setPreference persists and applies immediately', () => {
    stubMatchMedia(false);
    const svc = create();
    svc.init();
    svc.setPreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('follows a live OS scheme change while in auto', () => {
    const { listeners } = stubMatchMedia(false);
    const svc = create();
    svc.init();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    listeners.forEach((fn) => fn({ matches: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores OS scheme changes while an explicit preference is set', () => {
    const { listeners } = stubMatchMedia(false);
    const svc = create();
    svc.init();
    svc.setPreference('light');
    listeners.forEach((fn) => fn({ matches: true }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('cycles auto -> light -> dark -> auto', () => {
    stubMatchMedia(false);
    const svc = create();
    svc.init();
    svc.cycle();
    expect(svc.preference()).toBe('light');
    svc.cycle();
    expect(svc.preference()).toBe('dark');
    svc.cycle();
    expect(svc.preference()).toBe('auto');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('auto');
  });

  it('treats a corrupt stored value as auto', () => {
    stubMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    const svc = create();
    svc.init();
    expect(svc.preference()).toBe('auto');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
