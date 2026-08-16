import { describe, it, expect } from 'vitest';
import { SITE } from './site-identity';
import raw from './site-identity.json';

describe('site identity', () => {
  it('re-exports the JSON unchanged (no drift between the TS and the JSON)', () => {
    expect(SITE).toEqual(raw);
  });

  it('carries the canonical sentence', () => {
    expect(SITE.sentence).toBe(
      'TulipLot is a browser dashboard that shows up to six live websites side by side in a fixed 3×2 grid, in one browser tab.',
    );
  });

  it('uses absolute https URLs for url, logo, ogImage, contactUrl, and every sameAs entry', () => {
    for (const u of [SITE.url, SITE.logo, SITE.ogImage, SITE.contactUrl, ...SITE.sameAs]) {
      expect(u).toMatch(/^https:\/\/[^ ]+$/);
    }
    expect(SITE.sameAs.length).toBeGreaterThan(0);
  });

  it('states the Premium price as a plain number string', () => {
    expect(SITE.premiumMonthlyUsd).toMatch(/^\d+$/);
  });
});
