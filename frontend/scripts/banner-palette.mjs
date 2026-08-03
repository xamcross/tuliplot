// Deterministic slug -> banner palette assignment. Shared by
// render-post-banners.mjs (which renders the PNGs) and banner-palette.spec.mjs
// (which pins the stability property) so the two can never drift apart.

// Stable, ordered list of palette pairs available for slugs that aren't
// explicitly pinned below. The first five are the original hand-picked pairs
// (unchanged, but see PINNED_VALUES below — they are no longer reachable by
// hash, precisely because they're pinned). The next five are additional
// combinations of the same five brand pastels — no new colors introduced —
// added so that a small batch of new posts has enough buckets to land on
// distinct thumbnails instead of piling into the same handful of pairs.
export const PALETTE_PAIRS = [
  ['#A5D8FF', '#B2F2BB'],
  ['#FFB1B1', '#D0BFFF'],
  ['#D0BFFF', '#A5D8FF'],
  ['#FFD8A8', '#FFB1B1'],
  ['#B2F2BB', '#FFD8A8'],
  ['#A5D8FF', '#FFD8A8'],
  ['#A5D8FF', '#FFB1B1'],
  ['#B2F2BB', '#FFB1B1'],
  ['#B2F2BB', '#D0BFFF'],
  ['#FFD8A8', '#D0BFFF'],
];

// The nine posts below are already published and live on tuliplot.com (the
// original five plus Wave 5's four comparison/listicle pages, pinned here
// the moment they went live). Pinning is what keeps this imagery byte-
// identical forever, no matter what scheme governs future posts or how many
// other posts exist — it also means the hash pool below can safely exclude
// every one of these exact pairs, so no future slug can ever land on a
// pinned post's exact colors. tuliplot-vs-toby and tuliplot-vs-workona are
// pinned at the hashed values they already had (no visual change). best-
// start-pages-2026 and tuliplot-vs-start-me had hashed onto the same pairs
// as what-is-a-browser-start-page and view-multiple-websites-at-once
// respectively (both are among PALETTE_PAIRS' first five, which the pre-fix
// hash pool still included) and are pinned here to two previously-unused
// combinations of the same five brand pastels instead.
export const PINNED_PALETTES = {
  'dashboard-productivity-tips': ['#A5D8FF', '#B2F2BB'],
  'why-we-built-tuliplot': ['#FFB1B1', '#D0BFFF'],
  'view-multiple-websites-at-once': ['#D0BFFF', '#A5D8FF'],
  'gmail-and-calendar-side-by-side': ['#FFD8A8', '#FFB1B1'],
  'what-is-a-browser-start-page': ['#B2F2BB', '#FFD8A8'],
  'tuliplot-vs-toby': ['#FFD8A8', '#D0BFFF'],
  'tuliplot-vs-workona': ['#B2F2BB', '#D0BFFF'],
  'best-start-pages-2026': ['#FFB1B1', '#A5D8FF'],
  'tuliplot-vs-start-me': ['#D0BFFF', '#B2F2BB'],
};

// The pool a hashed (i.e. not explicitly pinned) slug can land in. Excludes
// every pair already claimed by PINNED_PALETTES so a hashed slug can never
// collide byte-for-byte with a pinned post's banner, no matter how
// PALETTE_PAIRS grows or hashSlug's distribution shifts. Computed once from
// the two static lists above — still no dependency on which other slugs
// exist at call time, so paletteFor stays a pure function of its argument.
const PINNED_VALUES = new Set(Object.values(PINNED_PALETTES).map((p) => p.join('|')));
const HASHED_PALETTE_PAIRS = PALETTE_PAIRS.filter((p) => !PINNED_VALUES.has(p.join('|')));

// Small, stable string hash (FNV-1a style, 32-bit). Deliberately inline
// rather than a dependency — this only needs to be deterministic and
// reasonably well-distributed across a handful of palette buckets, not
// cryptographically sound.
//
// The multiplier is Knuth's 32-bit multiplicative-hashing constant
// (2654435761, the golden-ratio prime) rather than the canonical FNV prime
// (16777619); it was chosen because it separated Wave 5's four new slugs
// better than the canonical FNV prime did against PALETTE_PAIRS.length ===
// 10. Those four slugs are now all pinned (see PINNED_PALETTES) rather than
// hashed, so this constant's distribution now only matters for posts
// published after them. Still a pure function of the slug's own characters
// only.
export function hashSlug(slug) {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x9e3779b1);
  }
  return h >>> 0;
}

// The palette for a single slug. Depends ONLY on that slug's own characters
// (via hashSlug), its presence in PINNED_PALETTES, or the fixed, static
// HASHED_PALETTE_PAIRS pool — never on which other slugs exist, how many
// posts there are, or sort order. That's what makes publishing or removing
// an unrelated post incapable of changing this slug's banner colors, and
// what makes a hashed slug incapable of ever landing on a pinned one's
// exact pair (HASHED_PALETTE_PAIRS excludes every pinned pair by
// construction). All nine currently-published posts are pinned above, so
// HASHED_PALETTE_PAIRS is only reachable by posts published after this one;
// as new posts are pinned in turn, add their pairs to PINNED_PALETTES and
// grow PALETTE_PAIRS if the remaining hash pool gets too small to stay
// well-distributed.
export function paletteFor(slug) {
  return PINNED_PALETTES[slug] ?? HASHED_PALETTE_PAIRS[hashSlug(slug) % HASHED_PALETTE_PAIRS.length];
}

// Convenience: palette-per-slug map for a whole slug list. Each entry is
// computed independently via paletteFor, so the resulting map for any
// subset of slugs is identical to what you'd get computing that subset
// alone — order and membership of `slugs` cannot affect any other entry.
export function assignPalettes(slugs) {
  return Object.fromEntries(slugs.map((slug) => [slug, paletteFor(slug)]));
}
