import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// One-off: normalize captured product screenshots to Chrome Web Store sizes.
// Usage: node scripts/store-shots.mjs <grid.jpg> <catalog.jpg> <fallback.png>
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'store-assets');
fs.mkdirSync(outDir, { recursive: true });

const APP_BG = '#1A1830'; // --tl-app-bg (dark theme)
const [grid, catalog, fallback] = process.argv.slice(2);

async function to1280x800(src, out) {
  const resized = await sharp(src).resize({ width: 1280 }).toBuffer();
  const h = (await sharp(resized).metadata()).height;
  await sharp(resized)
    .extend({ bottom: 800 - h, background: APP_BG })
    .removeAlpha()
    .png()
    .toFile(path.join(outDir, out));
  console.log(out, '1280x800');
}

await to1280x800(grid, 'screenshot-1-grid.png');
await to1280x800(catalog, 'screenshot-3-catalog.png');
await sharp(fallback)
  .resize(640, 400, { fit: 'fill' })
  .removeAlpha()
  .png()
  .toFile(path.join(outDir, 'screenshot-2-fallback.png'));
console.log('screenshot-2-fallback.png', '640x400');
