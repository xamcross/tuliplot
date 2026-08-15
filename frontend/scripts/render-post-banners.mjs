// Renders decorative 1440x520 blog banners and 1200x630 share cards to public/banners/. Run: npm run banners
import sharp from 'sharp';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from './content.util.mjs';
import { assignPalettes } from './banner-palette.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const repoRoot = resolve(frontendRoot, '..');
const blogDir = resolve(repoRoot, 'content/blog');
const outDir = resolve(frontendRoot, 'public/banners');
mkdirSync(outDir, { recursive: true });

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
const banners = assignPalettes(slugs);

for (const [slug, [a, b]] of Object.entries(banners)) {
  // 1) the in-page banner, 1440x520
  const bannerSvg = `<svg width="1440" height="520" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="520" fill="#FFFDF9"/>
    <rect x="80" y="90" width="520" height="340" rx="40" fill="${a}"/>
    <rect x="640" y="90" width="340" height="150" rx="32" fill="${b}"/>
    <rect x="640" y="280" width="340" height="150" rx="32" fill="${b}" opacity="0.55"/>
    <rect x="1020" y="90" width="340" height="340" rx="40" fill="${a}" opacity="0.45"/>
  </svg>`;
  await writePng(bannerSvg, 1440, 520, resolve(outDir, `${slug}.png`), `banner: ${slug}.png`);

  // 2) the share card, 1200x630 (1.91:1), same palette recomposed for the ratio
  const ogSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#FFFDF9"/>
    <rect width="1200" height="10" fill="#4D96FF"/>
    <rect x="80" y="110" width="440" height="410" rx="40" fill="${a}"/>
    <rect x="560" y="110" width="270" height="190" rx="32" fill="${b}"/>
    <rect x="560" y="330" width="270" height="190" rx="32" fill="${b}" opacity="0.55"/>
    <rect x="870" y="110" width="250" height="410" rx="40" fill="${a}" opacity="0.45"/>
    <text x="80" y="590" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-weight="700" font-size="28" fill="#4D96FF">tuliplot.com</text>
  </svg>`;
  await writePng(ogSvg, 1200, 630, resolve(outDir, `${slug}-og.png`), `og: ${slug}-og.png`);
}

async function writePng(svg, width, height, file, label) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(buf).metadata();
  if (meta.width !== width || meta.height !== height) {
    throw new Error(`${label} is ${meta.width}x${meta.height}, expected ${width}x${height}`);
  }
  await sharp(buf).toFile(file);
  console.log(`${label} ${width}x${height}`);
}
