import { describe, it, expect } from 'vitest';
import { assignPalettes, paletteFor, PINNED_PALETTES } from './banner-palette.mjs';

describe('banner palette assignment', () => {
  it('pins the five originally-published posts to their exact live palettes', () => {
    for (const [slug, palette] of Object.entries(PINNED_PALETTES)) {
      expect(paletteFor(slug)).toEqual(palette);
    }
  });

  it('never changes an existing slug\'s palette when another post is added', () => {
    // Synthetic, never-pinned slugs so this test's ability to catch a
    // regression doesn't depend on which real posts happen to be pinned
    // right now (that set only grows over time as Wave-5 posts publish).
    const existing = ['synthetic-post-alpha', 'synthetic-post-beta', 'synthetic-post-gamma'];
    const before = assignPalettes(existing);

    // A brand-new post can land anywhere in sorted order relative to the
    // existing ones (before all of them, after all of them, or in between)
    // — none of those insertions may perturb an existing slug's palette.
    for (const addedSlug of ['a-new-post', 'synthetic-post-beta-2', 'zzz-new-post']) {
      const after = assignPalettes([...existing, addedSlug]);
      for (const slug of existing) {
        expect(after[slug]).toEqual(before[slug]);
      }
    }
  });
});
