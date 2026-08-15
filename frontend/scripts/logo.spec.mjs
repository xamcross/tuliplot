import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const logoPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/logo-512.png');

describe('logo-512.png', () => {
  it('exists and is a 512x512 PNG (Google wants a raster logo of at least 112x112)', async () => {
    expect(existsSync(logoPath)).toBe(true);
    const meta = await sharp(logoPath).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });
});
