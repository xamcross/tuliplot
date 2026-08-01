// Renders the 1200x630 social share card to public/og-card.png. Run: npm run og
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/og-card.png');

const tiles = ['#FFB1B1', '#FFD8A8', '#A5D8FF', '#B2F2BB', '#D0BFFF', '#EFEBFF'];
const grid = tiles
  .map((color, i) => {
    const x = 640 + (i % 3) * 175;
    const y = 140 + Math.floor(i / 3) * 175;
    return `<rect x="${x}" y="${y}" width="155" height="155" rx="22" fill="${color}"/>`;
  })
  .join('');

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#FFFDF9"/>
  <rect width="1200" height="10" fill="#4D96FF"/>
  ${grid}
  <text x="80" y="250" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-weight="700" font-size="88" fill="#33304A">TulipLot</text>
  <text x="80" y="330" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-size="36" fill="#5B5875">Your web apps, side by side</text>
  <text x="80" y="380" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-size="36" fill="#5B5875">in one browser tab.</text>
  <text x="80" y="540" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-weight="700" font-size="28" fill="#4D96FF">tuliplot.com</text>
</svg>`;

const buf = await sharp(Buffer.from(svg)).png().toBuffer();
const meta = await sharp(buf).metadata();
if (meta.width !== 1200 || meta.height !== 630) {
  throw new Error(`og-card is ${meta.width}x${meta.height}, expected 1200x630`);
}
await sharp(buf).toFile(out);
console.log(`og-card: 1200x630 -> ${out}`);
