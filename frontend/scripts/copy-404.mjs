// Cloudflare Pages serves a root-level 404.html with status 404 for unmatched
// paths. Angular prerenders the /404 route to 404/index.html; copy it up.
// Runs as npm postbuild. Fails loudly if the prerender is missing.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const browserDir = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/frontend/browser');
const src = resolve(browserDir, '404/index.html');
const dest = resolve(browserDir, '404.html');

if (!existsSync(src)) {
  throw new Error(`copy-404: prerendered ${src} not found — is the /404 route in app.routes.server.ts?`);
}
copyFileSync(src, dest);
console.log(`copy-404: ${src} -> ${dest}`);
