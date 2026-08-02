// Renders decorative 1440x520 blog banners to public/banners/. Run: npm run banners
import sharp from 'sharp';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from './content.util.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const repoRoot = resolve(frontendRoot, '..');
const blogDir = resolve(repoRoot, 'content/blog');
const outDir = resolve(frontendRoot, 'public/banners');
mkdirSync(outDir, { recursive: true });

// Stable, ordered list of palette pairs to cycle through for posts that
// aren't explicitly pinned below. Order is the original hand-picked
// sequence from when this map was hardcoded — do not reorder it, since
// doing so would reassign colors to already-generated banners.
const PALETTE_PAIRS = [
  ['#A5D8FF', '#B2F2BB'],
  ['#FFB1B1', '#D0BFFF'],
  ['#D0BFFF', '#A5D8FF'],
  ['#FFD8A8', '#FFB1B1'],
  ['#B2F2BB', '#FFD8A8'],
];

// The five original posts' banners are already published. A generic
// sort-slugs-and-cycle assignment does not reproduce their existing
// palettes (their hand-picked order isn't alphabetical), so they're
// pinned explicitly here to keep the live imagery byte-identical. Every
// other post gets a palette by cycling PALETTE_PAIRS, indexed by that
// post's position in the full sorted slug list.
const PINNED_PALETTES = {
  'dashboard-productivity-tips': ['#A5D8FF', '#B2F2BB'],
  'why-we-built-tuliplot': ['#FFB1B1', '#D0BFFF'],
  'view-multiple-websites-at-once': ['#D0BFFF', '#A5D8FF'],
  'gmail-and-calendar-side-by-side': ['#FFD8A8', '#FFB1B1'],
  'what-is-a-browser-start-page': ['#B2F2BB', '#FFD8A8'],
};

function discoverSlugs() {
  return readdirSync(blogDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(blogDir, f), 'utf8');
      const { data } = splitFrontmatter(raw);
      return data.slug || basename(f, '.md');
    })
    .sort();
}

const slugs = discoverSlugs();
const banners = Object.fromEntries(
  slugs.map((slug, i) => [
    slug,
    PINNED_PALETTES[slug] ?? PALETTE_PAIRS[i % PALETTE_PAIRS.length],
  ]),
);

for (const [slug, [a, b]] of Object.entries(banners)) {
  const svg = `<svg width="1440" height="520" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="520" fill="#FFFDF9"/>
    <rect x="80" y="90" width="520" height="340" rx="40" fill="${a}"/>
    <rect x="640" y="90" width="340" height="150" rx="32" fill="${b}"/>
    <rect x="640" y="280" width="340" height="150" rx="32" fill="${b}" opacity="0.55"/>
    <rect x="1020" y="90" width="340" height="340" rx="40" fill="${a}" opacity="0.45"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(buf).metadata();
  if (meta.width !== 1440 || meta.height !== 520) {
    throw new Error(`banner ${slug} is ${meta.width}x${meta.height}, expected 1440x520`);
  }
  await sharp(buf).toFile(resolve(outDir, `${slug}.png`));
  console.log(`banner: ${slug}.png 1440x520`);
}
