import { describe, it, expect } from 'vitest';
import { routes } from './app.routes';

describe('app routes', () => {
  it('declares browser-tab titles for the three authenticated pages', () => {
    const titleOf = (path: string) => routes.find((r) => r.path === path)?.title;
    expect(titleOf('app')).toBe('Dashboard');
    expect(titleOf('app/settings')).toBe('Settings');
    expect(titleOf('app/upgrade')).toBe('Upgrade');
  });
});
