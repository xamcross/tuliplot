import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from './content.util.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const repoRoot = resolve(frontendRoot, '..');
const blogDir = resolve(repoRoot, 'content/blog');
const bannersDir = resolve(frontendRoot, 'public/banners');

function blogSlugs() {
  return readdirSync(blogDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(blogDir, f), 'utf8');
      const { data } = splitFrontmatter(raw);
      return data.slug || basename(f, '.md');
    });
}

describe('blog post banners', () => {
  it('has a rendered banner for every post in content/blog', () => {
    // Guards against blog-detail.component.ts silently rendering a broken
    // <img> for any post that render-post-banners.mjs hasn't produced a
    // banner for yet (e.g. a new post added without running `npm run banners`).
    const missing = blogSlugs().filter(
      (slug) => !existsSync(join(bannersDir, `${slug}.png`)),
    );
    expect(missing).toEqual([]);
  });
});
