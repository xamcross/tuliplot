// Renders public/logo-512.png: the favicon mark on an opaque brand background.
// Google's Organization logo guidelines want a raster image of at least 112x112;
// favicon.svg alone does not qualify. Run: npm run logo
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/logo-512.png');
const favicon = readFileSync(resolve(root, 'public/favicon.svg'));

// Same page background as render-og-card.mjs.
const background = await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#FFFDF9' },
}).png().toBuffer();

// The mark fills 72% of the square, centred.
const mark = await sharp(favicon).resize(368, 368, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

const buf = await sharp(background)
  .composite([{ input: mark, left: 72, top: 72 }])
  .png()
  .toBuffer();
const meta = await sharp(buf).metadata();
if (meta.width !== 512 || meta.height !== 512) {
  throw new Error(`logo is ${meta.width}x${meta.height}, expected 512x512`);
}
await sharp(buf).toFile(out);
console.log(`logo: 512x512 -> ${out}`);
