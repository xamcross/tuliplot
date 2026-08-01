// Renders decorative 1440x520 blog banners to public/banners/. Run: npm run banners
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/banners');
mkdirSync(outDir, { recursive: true });

const banners = {
  'dashboard-productivity-tips': ['#A5D8FF', '#B2F2BB'],
  'why-we-built-tuliplot': ['#FFB1B1', '#D0BFFF'],
};

for (const [slug, [a, b]] of Object.entries(banners)) {
  const svg = `<svg width="1440" height="520" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="520" fill="#FFFDF9"/>
    <rect x="-80" y="60" width="900" height="400" rx="48" fill="${a}"/>
    <rect x="760" y="120" width="300" height="300" rx="40" fill="${b}"/>
    <rect x="1100" y="60" width="220" height="220" rx="32" fill="${b}" opacity="0.55"/>
    <rect x="1010" y="330" width="150" height="150" rx="28" fill="#FFFFFF" opacity="0.75"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(buf).metadata();
  if (meta.width !== 1440 || meta.height !== 520) {
    throw new Error(`banner ${slug} is ${meta.width}x${meta.height}, expected 1440x520`);
  }
  await sharp(buf).toFile(resolve(outDir, `${slug}.png`));
  console.log(`banner: ${slug}.png 1440x520`);
}
