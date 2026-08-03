// Deterministic slug -> banner palette assignment. Shared by
// render-post-banners.mjs (which renders the PNGs) and banner-palette.spec.mjs
// (which pins the stability property) so the two can never drift apart.

// Stable, ordered list of palette pairs available for slugs that aren't
// explicitly pinned below.
export const PALETTE_PAIRS = [
  ['#A5D8FF', '#B2F2BB'],
  ['#FFB1B1', '#D0BFFF'],
  ['#D0BFFF', '#A5D8FF'],
  ['#FFD8A8', '#FFB1B1'],
  ['#B2F2BB', '#FFD8A8'],
];

// The five original posts' banners are already published and live on
// tuliplot.com. Their palettes were hand-picked before this script
// auto-discovered posts at all (there was no formula), so they're pinned
// here verbatim from the original hardcoded map. This keeps that live
// imagery byte-identical forever, no matter what scheme governs new posts
// or how many other posts exist.
export const PINNED_PALETTES = {
  'dashboard-productivity-tips': ['#A5D8FF', '#B2F2BB'],
  'why-we-built-tuliplot': ['#FFB1B1', '#D0BFFF'],
  'view-multiple-websites-at-once': ['#D0BFFF', '#A5D8FF'],
  'gmail-and-calendar-side-by-side': ['#FFD8A8', '#FFB1B1'],
  'what-is-a-browser-start-page': ['#B2F2BB', '#FFD8A8'],
};

// Small, stable string hash (32-bit FNV-1a). Deliberately inline rather than
// a dependency — this only needs to be deterministic and reasonably
// well-distributed across a handful of palette buckets, not cryptographically
// sound.
export function hashSlug(slug) {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// The palette for a single slug. Depends ONLY on that slug's own characters
// (via hashSlug) or its presence in PINNED_PALETTES — never on which other
// slugs exist, how many posts there are, or sort order. That's what makes
// publishing or removing an unrelated post incapable of changing this
// slug's banner colors.
export function paletteFor(slug) {
  return PINNED_PALETTES[slug] ?? PALETTE_PAIRS[hashSlug(slug) % PALETTE_PAIRS.length];
}

// Convenience: palette-per-slug map for a whole slug list. Each entry is
// computed independently via paletteFor, so the resulting map for any
// subset of slugs is identical to what you'd get computing that subset
// alone — order and membership of `slugs` cannot affect any other entry.
export function assignPalettes(slugs) {
  return Object.fromEntries(slugs.map((slug) => [slug, paletteFor(slug)]));
}
