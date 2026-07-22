import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '..', 'frontend', 'public', 'favicon.svg');
const outDir = path.join(here, '..', 'icons');

fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const out = path.join(outDir, `icon${size}.png`);
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(out);
  console.log(`rendered ${out}`);
}
