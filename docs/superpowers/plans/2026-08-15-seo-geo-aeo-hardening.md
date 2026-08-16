# SEO + GEO + AEO Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give search engines and generative engines one consistent identity for TulipLot, complete article metadata, machine-readable summaries (`llms.txt`), a `/changelog/` page, and the small on-page fixes the 2026-08-15 audit listed.

**Architecture:** One JSON file (`site-identity.json`) is the source of truth for name, URL, sentence, logo, `sameAs`, and price; Angular reads it through `site-identity.ts`, the build script reads it directly. `SeoService.set()` gains optional article fields. The content build (`build-content.mjs` + pure helpers in `content.util.mjs`) gains frontmatter validation, `llms.txt`/`llms-full.txt` output, a changelog export, and per-route sitemap `lastmod`. Everything else is a small edit to an existing component, script, or markdown file.

**Tech Stack:** Angular 22 (standalone, zoneless, prerender via `@angular/ssr` static output), Vitest 4, Node 22 (pinned for `ng build`), `marked` 12, `sharp` 0.35, Cloudflare Pages static hosting.

**Spec:** `docs/superpowers/specs/2026-08-15-seo-geo-aeo-hardening-design.md`

## Global Constraints

- Work in the worktree `C:\Users\xamcr\DashDash\.claude\worktrees\seo-geo-aeo-hardening` on branch `worktree-seo-geo-aeo-hardening`. Run every command from that path or from its `frontend/` subfolder, as each step states.
- Tests: `cd frontend && npx vitest run <file>` for one file; `npx vitest run` for the suite (48 files / 196 tests green at the start). Vitest runs on the system Node 24.
- Build: `npm run build` in `frontend/` needs the pinned Node 22. Prepend it to `PATH` first (Git Bash): `export PATH="$HOME/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"`. `npm run build` runs `prebuild` (`build-content.mjs`), `ng build`, and `postbuild` (`copy-404.mjs`). Bare `ng build` skips the 404 copy; never use it.
- The canonical sentence, verbatim, everywhere it is needed: `TulipLot is a browser dashboard that shows up to six live websites side by side in a fixed 3×2 grid, in one browser tab.`
- Competitor numbers come only from `docs/seo/2026-08-02-competitor-facts-verified.md`. No new competitor claim.
- Article H1s do not change. A shorter `<title>` uses the new `seoTitle` frontmatter key (max 49 characters).
- `og:image` dimensions are always 1200×630. The logo is 512×512 PNG.
- Head reset rule (Wave 2): a later `SeoService.set()` call must remove tags the previous call added when the new call does not set them.
- Language in prose, comments, and commit bodies: ASD-STE100 (short sentences, active voice). Commit subjects keep the conventional-commit format.
- Every commit ends with the two trailer lines:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u`.
- Never use bare `git stash`. Never `cd` to the main checkout at `C:\Users\xamcr\DashDash`.

---

## File map

| Path | Responsibility | Task |
|---|---|---|
| `frontend/src/app/core/site-identity.json` (create) | the one source of identity values | 1 |
| `frontend/src/app/core/site-identity.ts` (create) | typed re-export `SITE` | 1 |
| `frontend/src/app/core/site-identity.spec.ts` (create) | drift + shape guard | 1 |
| `frontend/scripts/render-logo.mjs` (create), `frontend/public/logo-512.png` (create), `frontend/scripts/logo.spec.mjs` (create) | 512×512 logo | 1 |
| `frontend/tsconfig.json`, `frontend/package.json` | `resolveJsonModule`, `logo` script | 1 |
| `frontend/src/app/core/services/seo.service.ts` + spec | optional `type`, `image`, `published`, `modified` | 2 |
| `frontend/src/app/features/marketing/landing.component.ts` + spec | home JSON-LD from `SITE` | 3 |
| `frontend/src/app/features/marketing/content.model.ts` | `updated?`, `seoTitle?`, `ogImage?`, `ChangelogDoc` | 4, 10 |
| `frontend/src/app/features/marketing/article-jsonld.ts` + `article-jsonld.spec.ts` (create) | article node from `SITE`; breadcrumbs | 4 |
| `frontend/scripts/content.util.mjs` + spec | pure helpers: date/seoTitle validation, `isExternalHref`, `llmsTxt`, `llmsFullTxt`, `parseChangelog` | 5, 8, 9, 10 |
| `frontend/scripts/build-content.mjs` | wires the helpers; writes `content.generated.ts`, sitemap, `llms*.txt` | 5, 8, 9, 10 |
| `frontend/src/app/features/marketing/guide-detail.component.ts`, `blog-detail.component.ts` + specs | `<time>`, `seoTitle`, article fields, breadcrumbs | 6 |
| `frontend/scripts/render-post-banners.mjs`, `banners.spec.mjs`, `frontend/public/banners/*-og.png` (create) | 1200×630 og variant per post | 7 |
| `content/changelog.md` (create), `frontend/src/app/features/marketing/changelog.component.ts` + spec (create), `app.routes.ts`, `app.routes.server.ts` | `/changelog/` | 10 |
| `frontend/public/robots.txt` | AI-crawler block + Content-Signal | 11 |
| `frontend/src/app/features/marketing/site-footer.component.ts` + `site-footer.spec.ts` (create) | eight footer links | 12 |
| `content/blog/*.md`, `content/guides/*.md`, `privacy/terms/contact.component.ts` | titles, descriptions, key facts, citations | 13, 14, 15 |
| `frontend/src/app/features/marketing/about.component.ts` | canonical sentence, GitHub link | 16 |

---

### Task 1: Site identity module and logo asset

**Files:**
- Create: `frontend/src/app/core/site-identity.json`
- Create: `frontend/src/app/core/site-identity.ts`
- Create: `frontend/src/app/core/site-identity.spec.ts`
- Create: `frontend/scripts/render-logo.mjs`
- Create: `frontend/scripts/logo.spec.mjs`
- Create: `frontend/public/logo-512.png` (generated)
- Modify: `frontend/tsconfig.json` (compilerOptions)
- Modify: `frontend/package.json` (scripts)

**Interfaces:**
- Produces: `SITE: SiteIdentity` from `frontend/src/app/core/site-identity.ts` with fields `name`, `url`, `sentence`, `logo`, `ogImage`, `sameAs: string[]`, `contactUrl`, `premiumMonthlyUsd` (all strings except `sameAs`). Later tasks import `{ SITE }` from `'../../core/site-identity'` (from `features/marketing/*`) or `'../site-identity'` (from `core/services/*`). The build script reads `frontend/src/app/core/site-identity.json` with `JSON.parse(readFileSync(...))`.

- [ ] **Step 1: Write the identity JSON**

Create `frontend/src/app/core/site-identity.json`:

```json
{
  "name": "TulipLot",
  "url": "https://tuliplot.com/",
  "sentence": "TulipLot is a browser dashboard that shows up to six live websites side by side in a fixed 3×2 grid, in one browser tab.",
  "logo": "https://tuliplot.com/logo-512.png",
  "ogImage": "https://tuliplot.com/og-card.png",
  "sameAs": ["https://github.com/xamcross/tuliplot"],
  "contactUrl": "https://tuliplot.com/contact/",
  "premiumMonthlyUsd": "4"
}
```

- [ ] **Step 2: Enable JSON imports**

In `frontend/tsconfig.json`, inside `"compilerOptions"`, add one line after `"module": "preserve"`:

```json
    "module": "preserve",
    "resolveJsonModule": true
```

- [ ] **Step 3: Write the failing spec**

Create `frontend/src/app/core/site-identity.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SITE } from './site-identity';
import raw from './site-identity.json';

describe('site identity', () => {
  it('re-exports the JSON unchanged (no drift between the TS and the JSON)', () => {
    expect(SITE).toEqual(raw);
  });

  it('carries the canonical sentence', () => {
    expect(SITE.sentence).toBe(
      'TulipLot is a browser dashboard that shows up to six live websites side by side in a fixed 3×2 grid, in one browser tab.',
    );
  });

  it('uses absolute https URLs for url, logo, ogImage, contactUrl, and every sameAs entry', () => {
    for (const u of [SITE.url, SITE.logo, SITE.ogImage, SITE.contactUrl, ...SITE.sameAs]) {
      expect(u).toMatch(/^https:\/\/[^ ]+$/);
    }
    expect(SITE.sameAs.length).toBeGreaterThan(0);
  });

  it('states the Premium price as a plain number string', () => {
    expect(SITE.premiumMonthlyUsd).toMatch(/^\d+$/);
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run (from `frontend/`): `npx vitest run src/app/core/site-identity.spec.ts`
Expected: FAIL — cannot resolve `./site-identity`.

- [ ] **Step 5: Write the TS module**

Create `frontend/src/app/core/site-identity.ts`:

```ts
import site from './site-identity.json';

/** The one source of truth for the product identity. Edit the JSON, not this file. */
export interface SiteIdentity {
  name: string;
  url: string;          // trailing slash
  sentence: string;     // the canonical one-sentence definition; used verbatim everywhere
  logo: string;         // 512×512 PNG, absolute URL
  ogImage: string;      // 1200×630 PNG, absolute URL
  sameAs: string[];     // public profiles that name the same entity
  contactUrl: string;
  premiumMonthlyUsd: string;
}

export const SITE: SiteIdentity = site;
```

- [ ] **Step 6: Run the spec to see it pass**

Run: `npx vitest run src/app/core/site-identity.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Write the failing logo spec**

Create `frontend/scripts/logo.spec.mjs`:

```js
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
```

- [ ] **Step 8: Run it to see it fail**

Run: `npx vitest run scripts/logo.spec.mjs`
Expected: FAIL — `existsSync` is false.

- [ ] **Step 9: Write the render script**

Create `frontend/scripts/render-logo.mjs`:

```js
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
```

Add the npm script in `frontend/package.json`, next to `"og"` and `"banners"`:

```json
    "logo": "node scripts/render-logo.mjs",
```

- [ ] **Step 10: Render the logo and run the spec**

Run: `npm run logo` then `npx vitest run scripts/logo.spec.mjs`
Expected: the script prints `logo: 512x512 -> …/public/logo-512.png`; the spec PASSES.
Open `frontend/public/logo-512.png` once (Read tool) and confirm the mark is visible and centred.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/core/site-identity.json frontend/src/app/core/site-identity.ts frontend/src/app/core/site-identity.spec.ts frontend/scripts/render-logo.mjs frontend/scripts/logo.spec.mjs frontend/public/logo-512.png frontend/tsconfig.json frontend/package.json
git commit -m "feat(seo): site identity module and 512x512 logo asset" -m "One JSON file holds the name, URL, canonical sentence, logo, sameAs, and price. Angular reads it through SITE; the build script reads the JSON directly. render-logo.mjs rasterizes favicon.svg to a 512x512 PNG for Organization JSON-LD." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 2: `SeoService` optional article fields

**Files:**
- Modify: `frontend/src/app/core/services/seo.service.ts`
- Modify: `frontend/src/app/core/services/seo.service.spec.ts`

**Interfaces:**
- Consumes: `SITE` from Task 1.
- Produces: `SeoService.set(opts: SeoOptions)` where
  ```ts
  export interface SeoOptions {
    title: string; description: string; path: string; jsonLd?: object[];
    type?: 'website' | 'article'; image?: string; published?: string; modified?: string;
  }
  ```
  Existing callers pass the first four fields only and keep working.

- [ ] **Step 1: Add the failing tests**

Append to `frontend/src/app/core/services/seo.service.spec.ts`, inside the `describe('SeoService', …)` block:

```ts
  it('emits og:type=article with published and modified times, and removes them on the next website call', () => {
    const seo = TestBed.inject(SeoService);
    const meta = TestBed.inject(Meta);
    seo.set({ title: 'Post', description: 'd', path: '/blog/post', type: 'article', published: '2026-08-02', modified: '2026-08-15' });
    expect(meta.getTag('property="og:type"')?.content).toBe('article');
    expect(meta.getTag('property="article:published_time"')?.content).toBe('2026-08-02');
    expect(meta.getTag('property="article:modified_time"')?.content).toBe('2026-08-15');

    seo.set({ title: 'Blog', description: 'd', path: '/blog' });
    expect(meta.getTag('property="og:type"')?.content).toBe('website');
    expect(meta.getTag('property="article:published_time"')).toBeNull();
    expect(meta.getTag('property="article:modified_time"')).toBeNull();
  });

  it('falls back modified_time to published_time when modified is absent', () => {
    const seo = TestBed.inject(SeoService);
    const meta = TestBed.inject(Meta);
    seo.set({ title: 'Post', description: 'd', path: '/blog/post', type: 'article', published: '2026-08-02' });
    expect(meta.getTag('property="article:modified_time"')?.content).toBe('2026-08-02');
  });

  it('uses the given image for og:image and twitter:image, and the site card by default', () => {
    const seo = TestBed.inject(SeoService);
    const meta = TestBed.inject(Meta);
    seo.set({ title: 'Post', description: 'd', path: '/blog/post', image: 'https://tuliplot.com/banners/post-og.png' });
    expect(meta.getTag('property="og:image"')?.content).toBe('https://tuliplot.com/banners/post-og.png');
    expect(meta.getTag('name="twitter:image"')?.content).toBe('https://tuliplot.com/banners/post-og.png');

    seo.set({ title: 'Blog', description: 'd', path: '/blog' });
    expect(meta.getTag('property="og:image"')?.content).toBe('https://tuliplot.com/og-card.png');
    expect(meta.getTag('name="twitter:image"')?.content).toBe('https://tuliplot.com/og-card.png');
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/app/core/services/seo.service.spec.ts`
Expected: FAIL — `og:type` stays `website`; `article:*` and `twitter:image` tags are missing.

- [ ] **Step 3: Implement**

Replace the top of `frontend/src/app/core/services/seo.service.ts` down to the end of `set()` with:

```ts
import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE } from '../site-identity';

export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  jsonLd?: object[];
  /** og:type. 'article' also emits article:published_time / article:modified_time. Default 'website'. */
  type?: 'website' | 'article';
  /** Absolute URL of a 1200×630 image. Default: the site card. */
  image?: string;
  /** ISO date (YYYY-MM-DD). Used only when type === 'article'. */
  published?: string;
  /** ISO date (YYYY-MM-DD). Falls back to `published`. */
  modified?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  set(opts: SeoOptions): void {
    const fullTitle = `${opts.title} · ${SITE.name}`;
    const url = opts.path === '/' ? SITE.url : `https://tuliplot.com${opts.path}/`;
    const type = opts.type ?? 'website';
    const image = opts.image ?? SITE.ogImage;
    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: opts.description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: opts.description });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: opts.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    if (type === 'article' && opts.published) {
      this.meta.updateTag({ property: 'article:published_time', content: opts.published });
      this.meta.updateTag({ property: 'article:modified_time', content: opts.modified ?? opts.published });
    } else {
      // Head reset rule: a website page after an article must not keep article tags.
      this.meta.removeTag('property="article:published_time"');
      this.meta.removeTag('property="article:modified_time"');
    }
    this.setCanonical(url);
    this.setJsonLd(opts.jsonLd);
  }
```

Keep `setCanonical` and `setJsonLd` as they are.

- [ ] **Step 4: Run the file, then the suite**

Run: `npx vitest run src/app/core/services/seo.service.spec.ts` → PASS (7 tests).
Run: `npx vitest run` → all green (the existing callers still compile).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/services/seo.service.ts frontend/src/app/core/services/seo.service.spec.ts
git commit -m "feat(seo): optional article type, image, and dates on SeoService.set()" -m "og:type becomes 'article' with article:published_time and article:modified_time when a page asks for it. A later website call removes those tags. og:image and a new twitter:image accept a per-page image and default to the site card." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 3: Home JSON-LD from `SITE`

**Files:**
- Modify: `frontend/src/app/features/marketing/landing.component.ts` (the `jsonLd` array in the constructor)
- Modify: `frontend/src/app/features/marketing/landing.component.spec.ts`

**Interfaces:**
- Consumes: `SITE` (Task 1).
- Produces: nothing new for later tasks. The Organization node id is `https://tuliplot.com/#org` (also used by Task 4).

- [ ] **Step 1: Add the failing test**

Append to `frontend/src/app/features/marketing/landing.component.spec.ts` inside the `describe`:

```ts
  it('emits an Organization with @id, sameAs, PNG logo, and description; WebSite and SoftwareApplication reference it', async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const data = JSON.parse(document.getElementById('tl-jsonld')!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const org = data.find((d) => d['@type'] === 'Organization')!;
    expect(org['@id']).toBe('https://tuliplot.com/#org');
    expect(org['logo']).toBe('https://tuliplot.com/logo-512.png');
    expect(org['sameAs']).toEqual(['https://github.com/xamcross/tuliplot']);
    expect(org['description']).toContain('browser dashboard');
    expect((org['contactPoint'] as Array<Record<string, string>>)[0]['url']).toBe('https://tuliplot.com/contact/');

    const site = data.find((d) => d['@type'] === 'WebSite')!;
    expect((site['publisher'] as Record<string, string>)['@id']).toBe('https://tuliplot.com/#org');

    const app = data.find((d) => d['@type'] === 'SoftwareApplication')!;
    expect(app['url']).toBe('https://tuliplot.com/');
    expect(app['image']).toBe('https://tuliplot.com/og-card.png');
    const offers = app['offers'] as Array<Record<string, string>>;
    expect(offers.map((o) => o['name'])).toEqual(['Free', 'Premium']);
    expect(offers[1]['price']).toBe('4');
    expect(offers[1]['priceCurrency']).toBe('USD');
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/app/features/marketing/landing.component.spec.ts`
Expected: FAIL — `@id` undefined.

- [ ] **Step 3: Implement**

In `landing.component.ts`, add the import after the `SeoService` import:

```ts
import { SITE } from '../../core/site-identity';
```

Add a module-level constant right after the `FAQ` constant:

```ts
const ORG_ID = `${SITE.url}#org`;
```

Replace the four JSON-LD objects in the constructor's `jsonLd: [ … ]` array (keep the `FAQPage` object as it is, only the three before it change):

```ts
      jsonLd: [
        {
          '@context': 'https://schema.org', '@type': 'Organization', '@id': ORG_ID,
          name: SITE.name, url: SITE.url, logo: SITE.logo, description: SITE.sentence,
          sameAs: SITE.sameAs,
          contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', url: SITE.contactUrl }],
        },
        {
          '@context': 'https://schema.org', '@type': 'WebSite',
          name: SITE.name, url: SITE.url, description: SITE.sentence,
          publisher: { '@id': ORG_ID },
        },
        {
          '@context': 'https://schema.org', '@type': 'SoftwareApplication',
          name: SITE.name, url: SITE.url, image: SITE.ogImage,
          applicationCategory: 'BrowserApplication', operatingSystem: 'Web',
          description: SITE.sentence, sameAs: SITE.sameAs,
          publisher: { '@id': ORG_ID },
          offers: [
            { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
            { '@type': 'Offer', name: 'Premium', price: SITE.premiumMonthlyUsd, priceCurrency: 'USD', description: 'per month' },
          ],
        },
        {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: FAQ.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
      ],
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run src/app/features/marketing/landing.component.spec.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/marketing/landing.component.ts frontend/src/app/features/marketing/landing.component.spec.ts
git commit -m "feat(seo): home JSON-LD from the site identity — @id, sameAs, PNG logo, two offers" -m "Organization, WebSite, and SoftwareApplication read name, URL, sentence, logo, sameAs, and price from SITE. WebSite and SoftwareApplication reference the Organization by @id. Offers list Free and Premium." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 4: Article JSON-LD, breadcrumbs, and the `ContentDoc` fields

**Files:**
- Modify: `frontend/src/app/features/marketing/content.model.ts`
- Modify: `frontend/src/app/features/marketing/article-jsonld.ts`
- Create: `frontend/src/app/features/marketing/article-jsonld.spec.ts`

**Interfaces:**
- Consumes: `SITE`.
- Produces:
  - `ContentDoc` gains `updated?: string; seoTitle?: string; ogImage?: string;` (all optional; the generated file stays valid until Task 5 fills them).
  - `buildArticleJsonLd(doc: ContentDoc, basePath: '/guides' | '/blog'): object` (same signature; new output fields).
  - `buildBreadcrumbJsonLd(items: { name: string; url: string }[]): object`.

- [ ] **Step 1: Extend the model**

In `content.model.ts`, replace the interface with:

```ts
export interface ContentDoc {
  slug: string;
  title: string;
  description: string;
  date: string;          // ISO date (YYYY-MM-DD) — datePublished
  updated?: string;      // ISO date — dateModified when set; falls back to date
  seoTitle?: string;     // ≤ 49 chars; <title>/og:title only, the H1 keeps `title`
  ogImage?: string;      // absolute URL of a 1200×630 image (blog posts only)
  category: string;
  readingMinutes: number;
  faq: { q: string; a: string }[];   // question-style h3s, for FAQPage schema
  html: string;          // pre-rendered HTML from markdown
}
```

- [ ] **Step 2: Write the failing spec**

Create `frontend/src/app/features/marketing/article-jsonld.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from './article-jsonld';
import { ContentDoc } from './content.model';

const base: ContentDoc = {
  slug: 'demo', title: 'Demo title', description: 'Demo description', date: '2026-08-02',
  category: 'Tips', readingMinutes: 3, faq: [], html: '<p>x</p>',
};

describe('buildArticleJsonLd', () => {
  it('uses date for both dates when updated is absent, and the site card when there is no ogImage', () => {
    const a = buildArticleJsonLd(base, '/blog') as Record<string, unknown>;
    expect(a['datePublished']).toBe('2026-08-02');
    expect(a['dateModified']).toBe('2026-08-02');
    expect(a['image']).toBe('https://tuliplot.com/og-card.png');
    expect(a['mainEntityOfPage']).toBe('https://tuliplot.com/blog/demo/');
  });

  it('uses updated for dateModified and ogImage for image when present', () => {
    const a = buildArticleJsonLd({ ...base, updated: '2026-08-15', ogImage: 'https://tuliplot.com/banners/demo-og.png' }, '/blog') as Record<string, unknown>;
    expect(a['datePublished']).toBe('2026-08-02');
    expect(a['dateModified']).toBe('2026-08-15');
    expect(a['image']).toBe('https://tuliplot.com/banners/demo-og.png');
  });

  it('names the publisher with the org @id and the PNG logo; author stays the Organization', () => {
    const a = buildArticleJsonLd(base, '/guides') as { publisher: Record<string, unknown>; author: Record<string, string> };
    expect(a.publisher['@id']).toBe('https://tuliplot.com/#org');
    expect((a.publisher['logo'] as Record<string, string>)['url']).toBe('https://tuliplot.com/logo-512.png');
    expect(a.author['@type']).toBe('Organization');
    expect(a.author['name']).toBe('TulipLot');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('builds a BreadcrumbList with 1-based positions', () => {
    const b = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://tuliplot.com/' },
      { name: 'Blog', url: 'https://tuliplot.com/blog/' },
      { name: 'Demo title', url: 'https://tuliplot.com/blog/demo/' },
    ]) as { '@type': string; itemListElement: Array<Record<string, unknown>> };
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement.map((i) => i['position'])).toEqual([1, 2, 3]);
    expect(b.itemListElement[2]['name']).toBe('Demo title');
    expect(b.itemListElement[2]['item']).toBe('https://tuliplot.com/blog/demo/');
  });
});
```

- [ ] **Step 3: Run to see it fail**

Run: `npx vitest run src/app/features/marketing/article-jsonld.spec.ts`
Expected: FAIL — `buildBreadcrumbJsonLd` is not exported; `publisher['@id']` undefined.

- [ ] **Step 4: Implement**

Replace `frontend/src/app/features/marketing/article-jsonld.ts` with:

```ts
import { ContentDoc } from './content.model';
import { SITE } from '../../core/site-identity';

const ORG_ID = `${SITE.url}#org`;

/** The Article JSON-LD both detail pages emit; single-sourced so the shapes can't drift. */
export function buildArticleJsonLd(doc: ContentDoc, basePath: '/guides' | '/blog'): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.description,
    datePublished: doc.date,
    dateModified: doc.updated ?? doc.date,
    mainEntityOfPage: `https://tuliplot.com${basePath}/${doc.slug}/`,
    image: doc.ogImage ?? SITE.ogImage,
    author: { '@type': 'Organization', name: SITE.name },
    publisher: {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: SITE.logo },
    },
  };
}

/** schema.org FAQPage built from a doc's question-style h3 sections. */
export function buildFaqJsonLd(faq: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** schema.org BreadcrumbList: Home › section › page. Positions are 1-based. */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
```

- [ ] **Step 5: Run the file and the suite**

Run: `npx vitest run src/app/features/marketing/article-jsonld.spec.ts` → PASS (4 tests).
Run: `npx vitest run` → green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/marketing/content.model.ts frontend/src/app/features/marketing/article-jsonld.ts frontend/src/app/features/marketing/article-jsonld.spec.ts
git commit -m "feat(seo): article JSON-LD reads the site identity; dateModified, per-post image, breadcrumbs" -m "ContentDoc gains optional updated, seoTitle, and ogImage. buildArticleJsonLd uses updated for dateModified, ogImage for image, and the PNG logo for the publisher. buildBreadcrumbJsonLd is new." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 5: Content pipeline — `updated`, `seoTitle`, real-date validation, `ogImage`

**Files:**
- Modify: `frontend/scripts/content.util.mjs`
- Modify: `frontend/scripts/content.util.spec.mjs`
- Modify: `frontend/scripts/build-content.mjs`

**Interfaces:**
- Produces (in `content.util.mjs`):
  - `isRealIsoDate(s: string): boolean`
  - `validateDates(data: {date?: string, updated?: string}, file: string): { date: string, updated?: string }` — throws on a missing/invalid `date`, an invalid `updated`, or `updated < date`.
  - `SEO_TITLE_MAX = 49`, `validateSeoTitle(seoTitle: string|undefined, file: string): string|undefined` — throws when longer than 49.
- Produces (in `build-content.mjs`): every doc object in memory carries `updated` (only when set), `seoTitle` (only when set), `ogImage` (posts only, `https://tuliplot.com/banners/<slug>-og.png`), and `markdown` (the body with the H1 stripped; build-only, not serialized). Later tasks (9) use `markdown`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/scripts/content.util.spec.mjs`. Extend the first import line to also import `isRealIsoDate, validateDates, validateSeoTitle, SEO_TITLE_MAX`, then add:

```js
describe('isRealIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(isRealIsoDate('2026-08-02')).toBe(true);
  });
  it('rejects wrong shapes and impossible dates', () => {
    expect(isRealIsoDate('2026-8-2')).toBe(false);
    expect(isRealIsoDate('2026-13-45')).toBe(false);
    expect(isRealIsoDate('2026-02-30')).toBe(false);
    expect(isRealIsoDate('')).toBe(false);
    expect(isRealIsoDate(undefined)).toBe(false);
  });
});

describe('validateDates', () => {
  it('returns date and updated when both are valid and ordered', () => {
    expect(validateDates({ date: '2026-08-02', updated: '2026-08-15' }, 'x.md')).toEqual({ date: '2026-08-02', updated: '2026-08-15' });
  });
  it('returns only date when updated is absent', () => {
    expect(validateDates({ date: '2026-08-02' }, 'x.md')).toEqual({ date: '2026-08-02', updated: undefined });
  });
  it('throws on a missing or impossible date', () => {
    expect(() => validateDates({}, 'x.md')).toThrow(/x\.md.*date/);
    expect(() => validateDates({ date: '2026-13-45' }, 'x.md')).toThrow(/x\.md.*date/);
  });
  it('throws on an invalid updated or one before date', () => {
    expect(() => validateDates({ date: '2026-08-02', updated: 'soon' }, 'x.md')).toThrow(/updated/);
    expect(() => validateDates({ date: '2026-08-02', updated: '2026-08-01' }, 'x.md')).toThrow(/before/);
  });
});

describe('validateSeoTitle', () => {
  it('passes undefined and empty through as undefined', () => {
    expect(validateSeoTitle(undefined, 'x.md')).toBeUndefined();
    expect(validateSeoTitle('', 'x.md')).toBeUndefined();
  });
  it('returns a title at or under the limit and throws above it', () => {
    const ok = 'a'.repeat(SEO_TITLE_MAX);
    expect(validateSeoTitle(ok, 'x.md')).toBe(ok);
    expect(() => validateSeoTitle('a'.repeat(SEO_TITLE_MAX + 1), 'x.md')).toThrow(/x\.md.*seoTitle.*49/);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run scripts/content.util.spec.mjs`
Expected: FAIL — the three functions are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `frontend/scripts/content.util.mjs`:

```js
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a YYYY-MM-DD string that names a real calendar day. */
export function isRealIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Frontmatter dates: `date` is required; `updated` is optional and must not be earlier than `date`. */
export function validateDates(data, file) {
  const { date, updated } = data;
  if (!isRealIsoDate(date)) {
    throw new Error(`content: ${file} is missing a valid frontmatter date (YYYY-MM-DD)`);
  }
  if (updated !== undefined && updated !== '') {
    if (!isRealIsoDate(updated)) {
      throw new Error(`content: ${file} has an invalid frontmatter updated (YYYY-MM-DD)`);
    }
    if (updated < date) {
      throw new Error(`content: ${file} has updated (${updated}) before date (${date})`);
    }
    return { date, updated };
  }
  return { date, updated: undefined };
}

/** The ` · TulipLot` suffix adds 11 characters; 49 keeps the full <title> at or under 60. */
export const SEO_TITLE_MAX = 49;

export function validateSeoTitle(seoTitle, file) {
  if (seoTitle === undefined || seoTitle === '') return undefined;
  if (seoTitle.length > SEO_TITLE_MAX) {
    throw new Error(`content: ${file} seoTitle is ${seoTitle.length} chars; max ${SEO_TITLE_MAX}`);
  }
  return seoTitle;
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run scripts/content.util.spec.mjs` → PASS.

- [ ] **Step 5: Wire the helpers into the build**

In `frontend/scripts/build-content.mjs`:

Replace the import line for `content.util.mjs` with:

```js
import {
  splitFrontmatter, readingMinutes, stripLeadingH1, sitemapXml, extractFaq,
  validateDates, validateSeoTitle,
} from './content.util.mjs';
```

Delete the local `requireDate` function. Replace `loadDir(kind)` with:

```js
function loadDir(kind) {
  const dir = join(contentDir, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const { data, body } = splitFrontmatter(raw);
      const slug = data.slug || basename(f, '.md');
      const { date, updated } = validateDates(data, f);
      const seoTitle = validateSeoTitle(data.seoTitle, f);
      const markdown = stripLeadingH1(body);
      const doc = {
        slug,
        title: data.title || slug,
        description: data.description || '',
        date,
        category: data.category || '',
        order: Number.parseInt(data.order ?? '0', 10) || 0,
        readingMinutes: readingMinutes(body),
        faq: extractFaq(body),
        html: marked.parse(markdown),
        markdown, // build-only: llms-full.txt; stripped by serialize()
      };
      if (updated) doc.updated = updated;
      if (seoTitle) doc.seoTitle = seoTitle;
      if (kind === 'blog') doc.ogImage = `https://tuliplot.com/banners/${slug}-og.png`;
      return doc;
    });
}
```

Replace `serialize(list)` with:

```js
function serialize(list) {
  // strip build-only fields; ContentDoc does not carry them
  return JSON.stringify(
    list.map(({ order, markdown, ...rest }) => rest),
    null,
    2,
  );
}
```

Replace the sitemap `entries` lastmod for articles so `updated` wins:

```js
  ...guides.map((g) => ({ loc: withSlash(`/guides/${g.slug}`), lastmod: g.updated ?? g.date })),
  ...posts.map((p) => ({ loc: withSlash(`/blog/${p.slug}`), lastmod: p.updated ?? p.date })),
```

- [ ] **Step 6: Regenerate and check**

Run: `node scripts/build-content.mjs`
Expected: `content: 4 guides, 9 posts -> …content.generated.ts` and `sitemap: 21 urls`. Open `src/app/features/marketing/content.generated.ts` and confirm every post has `"ogImage": "https://tuliplot.com/banners/<slug>-og.png"`, no doc has a `markdown` field, and no guide has `ogImage`.
Run: `npx vitest run` → green.

- [ ] **Step 7: Commit**

```bash
git add frontend/scripts/content.util.mjs frontend/scripts/content.util.spec.mjs frontend/scripts/build-content.mjs frontend/src/app/features/marketing/content.generated.ts frontend/public/sitemap.xml
git commit -m "feat(content): validate real dates, optional updated and seoTitle frontmatter, per-post ogImage" -m "The build rejects impossible dates such as 2026-13-45, an updated earlier than date, and a seoTitle over 49 characters. Posts carry the URL of their 1200x630 og image. The sitemap lastmod uses updated when it is set." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 6: Detail pages — `seoTitle`, article fields, breadcrumbs, `<time>`

**Files:**
- Modify: `frontend/src/app/features/marketing/guide-detail.component.ts`
- Modify: `frontend/src/app/features/marketing/blog-detail.component.ts`
- Modify: `frontend/src/app/features/marketing/guide-detail.component.spec.ts`
- Modify: `frontend/src/app/features/marketing/blog-detail.component.spec.ts`

**Interfaces:**
- Consumes: `SeoOptions` fields from Task 2; `buildBreadcrumbJsonLd` from Task 4; `ContentDoc.updated/seoTitle/ogImage` from Task 4/5.

- [ ] **Step 1: Add the failing tests (blog)**

Append inside the `describe('BlogDetailComponent', …)` block of `blog-detail.component.spec.ts`. Reuse the file's `render(slug)` helper and its imports; add `import { Meta } from '@angular/platform-browser';` at the top.

```ts
  it('sets article og tags, the per-post image, and a BreadcrumbList', () => {
    render(POSTS[0].slug);
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:type"')?.content).toBe('article');
    expect(meta.getTag('property="article:published_time"')?.content).toBe(POSTS[0].date);
    expect(meta.getTag('property="article:modified_time"')?.content).toBe(POSTS[0].updated ?? POSTS[0].date);
    expect(meta.getTag('property="og:image"')?.content).toBe(`https://tuliplot.com/banners/${POSTS[0].slug}-og.png`);
    const data = JSON.parse(document.getElementById('tl-jsonld')!.textContent ?? '[]') as Array<Record<string, unknown>>;
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList') as { itemListElement: Array<Record<string, unknown>> };
    expect(crumbs.itemListElement.map((i) => i['name'])).toEqual(['Home', 'Blog', POSTS[0].title]);
  });

  it('uses title for the document title when a post has no seoTitle', () => {
    const without = POSTS.find((p) => !p.seoTitle)!;
    render(without.slug);
    expect(document.title).toBe(`${without.title} · TulipLot`);
  });

  it('uses seoTitle for the document title and keeps title as the H1', () => {
    const withSeo = POSTS.find((p) => p.seoTitle);
    if (!withSeo) return; // inert until Task 13 adds seoTitle values
    const f = render(withSeo.slug);
    expect(document.title).toBe(`${withSeo.seoTitle} · TulipLot`);
    expect((f.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe(withSeo.title);
  });

  it('renders the published date as a <time> element', () => {
    const f = render(POSTS[0].slug);
    const time = (f.nativeElement as HTMLElement).querySelector('time') as HTMLTimeElement;
    expect(time).toBeTruthy();
    expect(time.getAttribute('datetime')).toBe(POSTS[0].date);
  });
```

Add the same four tests to `guide-detail.component.spec.ts` with `GUIDES` instead of `POSTS`, `GuideDetailComponent` instead of `BlogDetailComponent`, `'Guides'` instead of `'Blog'` in the breadcrumb names, and the `og:image` expectation replaced by `expect(meta.getTag('property="og:image"')?.content).toBe('https://tuliplot.com/og-card.png');` (guides have no per-post image). No guide sets `seoTitle`, so the guide version of the fourth test returns early; keep it anyway so a future `seoTitle` on a guide is covered. If `guide-detail.component.spec.ts` has no `render(slug)` helper, copy the one from `blog-detail.component.spec.ts` and swap the component and collection.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/app/features/marketing/blog-detail.component.spec.ts src/app/features/marketing/guide-detail.component.spec.ts`
Expected: FAIL — `og:type` is `website`; no `<time>`; no BreadcrumbList.

- [ ] **Step 3: Implement (blog-detail)**

In `blog-detail.component.ts`:

Change the import line `import { buildArticleJsonLd, buildFaqJsonLd } from './article-jsonld';` to:

```ts
import { buildArticleJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd } from './article-jsonld';
```

Replace the pill line in the template:

```html
          <div><span [class]="'tl-pill ' + pillClass(d.category)">{{ d.category }} · <time [attr.datetime]="d.date">{{ d.date }}</time>@if (d.updated) { · Updated <time [attr.datetime]="d.updated">{{ d.updated }}</time>} · {{ d.readingMinutes }} min read</span></div>
```

Replace the `seo.set({...})` call inside `if (d) { … }` with:

```ts
        const url = `https://tuliplot.com/blog/${d.slug}/`;
        const jsonLd: object[] = [
          buildArticleJsonLd(d, '/blog'),
          buildBreadcrumbJsonLd([
            { name: 'Home', url: 'https://tuliplot.com/' },
            { name: 'Blog', url: 'https://tuliplot.com/blog/' },
            { name: d.title, url },
          ]),
        ];
        if (d.faq.length) jsonLd.push(buildFaqJsonLd(d.faq));
        seo.set({
          title: d.seoTitle ?? d.title,
          description: d.description,
          path: `/blog/${d.slug}`,
          type: 'article',
          published: d.date,
          modified: d.updated ?? d.date,
          image: d.ogImage,
          jsonLd,
        });
```

- [ ] **Step 4: Implement (guide-detail)**

Same edits in `guide-detail.component.ts`, with these differences: the pill line has no date today, so replace it with:

```html
          <div><span [class]="'tl-pill ' + pillClass(d.category)">{{ d.category }} · <time [attr.datetime]="d.date">{{ d.date }}</time>@if (d.updated) { · Updated <time [attr.datetime]="d.updated">{{ d.updated }}</time>} · {{ d.readingMinutes }} min read</span></div>
```

and the `seo.set` block uses `/guides/`, `'Guides'`, and no `image` line:

```ts
        const url = `https://tuliplot.com/guides/${d.slug}/`;
        const jsonLd: object[] = [
          buildArticleJsonLd(d, '/guides'),
          buildBreadcrumbJsonLd([
            { name: 'Home', url: 'https://tuliplot.com/' },
            { name: 'Guides', url: 'https://tuliplot.com/guides/' },
            { name: d.title, url },
          ]),
        ];
        if (d.faq.length) jsonLd.push(buildFaqJsonLd(d.faq));
        seo.set({
          title: d.seoTitle ?? d.title,
          description: d.description,
          path: `/guides/${d.slug}`,
          type: 'article',
          published: d.date,
          modified: d.updated ?? d.date,
          jsonLd,
        });
```

- [ ] **Step 5: Run the two files and the suite**

Run: `npx vitest run src/app/features/marketing/blog-detail.component.spec.ts src/app/features/marketing/guide-detail.component.spec.ts` → PASS.
Run: `npx vitest run` → green. (The `seoTitle` test's `if (withSeo)` branch is inert until Task 13 adds `seoTitle` values; that is intended.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/marketing/blog-detail.component.ts frontend/src/app/features/marketing/guide-detail.component.ts frontend/src/app/features/marketing/blog-detail.component.spec.ts frontend/src/app/features/marketing/guide-detail.component.spec.ts
git commit -m "feat(seo): article og tags, breadcrumbs, seoTitle, and visible <time> on detail pages" -m "Guide and blog detail pages send type article with published and modified dates, the per-post image for posts, a BreadcrumbList, and use seoTitle for the document title when the doc has one. Both pages show the date as a <time> element; guides showed none before." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 7: Per-post 1200×630 og image

**Files:**
- Modify: `frontend/scripts/render-post-banners.mjs`
- Modify: `frontend/scripts/banners.spec.mjs`
- Create: `frontend/public/banners/<slug>-og.png` for all 9 posts (generated)

**Interfaces:**
- Produces: `public/banners/<slug>-og.png` at 1200×630 for every post slug (the URL Task 5 already writes into `ogImage`).

- [ ] **Step 1: Extend the failing spec**

In `frontend/scripts/banners.spec.mjs`, add `sharp` to the imports (`import sharp from 'sharp';`) and add a second test inside the `describe`:

```js
  it('has a 1200x630 og variant for every post (used as og:image and Article image)', async () => {
    for (const slug of blogSlugs()) {
      const file = join(bannersDir, `${slug}-og.png`);
      expect(existsSync(file), `${slug}-og.png missing — run npm run banners`).toBe(true);
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height], `${slug}-og.png size`).toEqual([1200, 630]);
    }
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run scripts/banners.spec.mjs` → FAIL (files missing).

- [ ] **Step 3: Implement**

In `render-post-banners.mjs`, replace the `for` loop body with two renders. Keep the discovery code above it.

```js
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
```

Also update the header comment of the file: `// Renders decorative 1440x520 blog banners and 1200x630 share cards to public/banners/. Run: npm run banners`.

- [ ] **Step 4: Render and test**

Run: `npm run banners` → 18 lines (9 banners + 9 og). Existing `<slug>.png` files re-render byte-identical (same SVG). Check with `git status --short frontend/public/banners` — only the nine `-og.png` files are new.
Run: `npx vitest run scripts/banners.spec.mjs scripts/banner-palette.spec.mjs` → PASS.
Open one `-og.png` with the Read tool and confirm the composition fills the card.

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/render-post-banners.mjs frontend/scripts/banners.spec.mjs frontend/public/banners/
git commit -m "feat(seo): 1200x630 share card per blog post" -m "render-post-banners.mjs writes <slug>-og.png next to each banner, same palette, recomposed for 1.91:1. The banners spec asserts both files and both sizes for every post." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 8: External links open in a new tab with `rel="noopener"`

**Files:**
- Modify: `frontend/scripts/content.util.mjs`
- Modify: `frontend/scripts/content.util.spec.mjs`
- Modify: `frontend/scripts/build-content.mjs`

**Interfaces:**
- Produces: `isExternalHref(href: string): boolean` in `content.util.mjs`; a `marked` renderer hook in `build-content.mjs` that adds ` target="_blank" rel="noopener"` to external `<a>` tags. Task 15 relies on this for the citations.

- [ ] **Step 1: Failing tests**

Add `isExternalHref` to the import in `content.util.spec.mjs` and append:

```js
describe('isExternalHref', () => {
  it('is true for http(s) hosts other than tuliplot.com', () => {
    expect(isExternalHref('https://developer.mozilla.org/en-US/docs/Web/HTTP')).toBe(true);
    expect(isExternalHref('http://example.com')).toBe(true);
    expect(isExternalHref('https://tuliplot.com.evil.example/')).toBe(true);
  });
  it('is false for tuliplot.com, www.tuliplot.com, relative paths, anchors, and mailto', () => {
    expect(isExternalHref('https://tuliplot.com/guides/')).toBe(false);
    expect(isExternalHref('https://www.tuliplot.com/')).toBe(false);
    expect(isExternalHref('/guides/add-any-site')).toBe(false);
    expect(isExternalHref('#faq')).toBe(false);
    expect(isExternalHref('mailto:hello@tuliplot.com')).toBe(false);
  });
});
```

Also add a rendering test that exercises the hook through `marked`, in a new file `frontend/scripts/build-content.spec.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import { externalLinkExtension } from './build-content.util.mjs';

describe('externalLinkExtension', () => {
  it('adds target and rel to external links only', () => {
    marked.use(externalLinkExtension());
    const html = marked.parse('[MDN](https://developer.mozilla.org/x) and [guide](/guides/x)');
    expect(html).toContain('<a href="https://developer.mozilla.org/x" target="_blank" rel="noopener">MDN</a>');
    expect(html).toContain('<a href="/guides/x">guide</a>');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run scripts/content.util.spec.mjs scripts/build-content.spec.mjs` → FAIL (missing exports / file).

- [ ] **Step 3: Implement**

Append to `content.util.mjs`:

```js
/** True when a link leaves tuliplot.com over http(s). Relative paths, anchors, and mailto are internal. */
export function isExternalHref(href) {
  const s = String(href ?? '');
  if (!/^https?:\/\//i.test(s)) return false;
  return !/^https?:\/\/(www\.)?tuliplot\.com(\/|$)/i.test(s);
}
```

Create `frontend/scripts/build-content.util.mjs` (kept apart from `content.util.mjs`, which stays dependency-free):

```js
// marked extension: external links open in a new tab with rel="noopener".
// marked 12 renderer methods take positional arguments (href, title, text);
// the object form ({ href, title, tokens }) arrives only in marked 13+.
import { isExternalHref } from './content.util.mjs';

export function externalLinkExtension() {
  return {
    renderer: {
      link(href, title, text) {
        const titleAttr = title ? ` title="${String(title).replaceAll('"', '&quot;')}"` : '';
        const ext = isExternalHref(href) ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${href}"${titleAttr}${ext}>${text}</a>`;
      },
    },
  };
}
```

If `npx vitest run scripts/build-content.spec.mjs` shows `href` as `undefined` or an object, the installed `marked` is 13+; then use the object signature `link({ href, title, text })` instead. Check with `node -e "console.log(require('marked/package.json').version)"` (12.0.2 at plan time).

In `build-content.mjs`, after `marked.setOptions({ gfm: true, breaks: false });` add:

```js
import { externalLinkExtension } from './build-content.util.mjs';
marked.use(externalLinkExtension());
```

(Place the `import` with the other imports at the top of the file; only the `marked.use(...)` line goes after `setOptions`.)

- [ ] **Step 4: Run to see them pass; regenerate**

Run: `npx vitest run scripts/content.util.spec.mjs scripts/build-content.spec.mjs` → PASS.
Run: `node scripts/build-content.mjs`, then `grep -c 'rel="noopener"' src/app/features/marketing/content.generated.ts` → at least 3 (the three vendor links in the vs-posts).
Run: `npx vitest run` → green.

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/content.util.mjs frontend/scripts/content.util.spec.mjs frontend/scripts/build-content.util.mjs frontend/scripts/build-content.spec.mjs frontend/scripts/build-content.mjs frontend/src/app/features/marketing/content.generated.ts
git commit -m "feat(content): external article links get target=_blank and rel=noopener" -m "A marked renderer hook adds the attributes when the href leaves tuliplot.com. Internal links, anchors, and mailto stay unchanged." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 9: `llms.txt` and `llms-full.txt`

**Files:**
- Modify: `frontend/scripts/content.util.mjs`
- Modify: `frontend/scripts/content.util.spec.mjs`
- Modify: `frontend/scripts/build-content.mjs`
- Create (generated): `frontend/public/llms.txt`, `frontend/public/llms-full.txt`

**Interfaces:**
- Produces:
  - `llmsTxt({ site, guides, posts, pages }): string` — `guides`, `posts`, `pages` are arrays of `{ title, url, description }`.
  - `llmsFullTxt({ site, guides, posts }): string` — arrays of `{ title, url, date, updated?, markdown }`.
  - `build-content.mjs` defines `STATIC_PAGES` (also used by Task 10 for the sitemap) and writes both files.

- [ ] **Step 1: Failing tests**

Add `llmsTxt, llmsFullTxt` to the import in `content.util.spec.mjs` and append:

```js
const site = {
  name: 'TulipLot', url: 'https://tuliplot.com/', contactUrl: 'https://tuliplot.com/contact/', premiumMonthlyUsd: '4',
  sentence: 'TulipLot is a browser dashboard that shows up to six live websites side by side in a fixed 3×2 grid, in one browser tab.',
};

describe('llmsTxt', () => {
  it('renders the header, facts, and one line per doc under Guides, Blog, Pages, then Contact', () => {
    const txt = llmsTxt({
      site,
      guides: [{ title: 'Getting started', url: 'https://tuliplot.com/guides/getting-started/', description: 'First grid.' }],
      posts: [{ title: 'Vs Toby', url: 'https://tuliplot.com/blog/tuliplot-vs-toby/', description: 'Compare.' }],
      pages: [{ title: 'Home', url: 'https://tuliplot.com/', description: site.sentence }],
    });
    const lines = txt.split('\n');
    expect(lines[0]).toBe('# TulipLot');
    expect(lines[2]).toBe(`> ${site.sentence}`);
    expect(txt).toContain('## Facts\n- Try: 2 usable cells, no account. Free: 5 usable cells + 1 ad cell, $0. Premium: 6 cells, no ad, $4/month.');
    expect(txt).toContain('## Guides\n- [Getting started](https://tuliplot.com/guides/getting-started/): First grid.');
    expect(txt).toContain('## Blog\n- [Vs Toby](https://tuliplot.com/blog/tuliplot-vs-toby/): Compare.');
    expect(txt).toContain('## Pages\n- [Home](https://tuliplot.com/): ');
    expect(txt.trimEnd().endsWith('## Contact\n- https://tuliplot.com/contact/')).toBe(true);
    const order = ['## Facts', '## Guides', '## Blog', '## Pages', '## Contact'].map((h) => txt.indexOf(h));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('llmsFullTxt', () => {
  it('renders the header, then each article with source, dates, and the body', () => {
    const txt = llmsFullTxt({
      site,
      guides: [{ title: 'G', url: 'https://tuliplot.com/guides/g/', date: '2026-08-01', markdown: 'Guide body.' }],
      posts: [{ title: 'P', url: 'https://tuliplot.com/blog/p/', date: '2026-08-02', updated: '2026-08-15', markdown: 'Post body.\n\n## Section' }],
    });
    expect(txt.startsWith('# TulipLot\n\n> ')).toBe(true);
    expect(txt).toContain('# G\nSource: https://tuliplot.com/guides/g/\nPublished: 2026-08-01\n\nGuide body.\n');
    expect(txt).toContain('# P\nSource: https://tuliplot.com/blog/p/\nPublished: 2026-08-02\nUpdated: 2026-08-15\n\nPost body.\n\n## Section\n');
    expect(txt.indexOf('# G')).toBeLessThan(txt.indexOf('# P'));
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run scripts/content.util.spec.mjs` → FAIL (not exported).

- [ ] **Step 3: Implement**

Append to `content.util.mjs`:

```js
const LLMS_FACTS = (site) => [
  `- Try: 2 usable cells, no account. Free: 5 usable cells + 1 ad cell, $0. Premium: 6 cells, no ad, $${site.premiumMonthlyUsd}/month.`,
  '- Most sites embed live. Some need the optional TulipLot Companion (a Chrome extension). A few never embed and open in their own tab from the grid.',
  `- Chrome-first. Public site: ${site.url}`,
];

const llmsLine = (d) => `- [${d.title}](${d.url}): ${d.description}`;

/** llms.txt: a short, curated map of the site for language models. */
export function llmsTxt({ site, guides, posts, pages }) {
  return [
    `# ${site.name}`,
    '',
    `> ${site.sentence}`,
    '',
    '## Facts',
    ...LLMS_FACTS(site),
    '',
    '## Guides',
    ...guides.map(llmsLine),
    '',
    '## Blog',
    ...posts.map(llmsLine),
    '',
    '## Pages',
    ...pages.map(llmsLine),
    '',
    '## Contact',
    `- ${site.contactUrl}`,
    '',
  ].join('\n');
}

/** llms-full.txt: the same header, then the full markdown of every guide and post. */
export function llmsFullTxt({ site, guides, posts }) {
  const article = (d) => [
    `# ${d.title}`,
    `Source: ${d.url}`,
    `Published: ${d.date}`,
    ...(d.updated ? [`Updated: ${d.updated}`] : []),
    '',
    String(d.markdown).trim(),
    '',
    '---',
    '',
  ];
  return [
    `# ${site.name}`,
    '',
    `> ${site.sentence}`,
    '',
    'Full text of every guide and blog post. llms.txt lists the same pages with one line each.',
    '',
    ...guides.flatMap(article),
    ...posts.flatMap(article),
  ].join('\n');
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run scripts/content.util.spec.mjs` → PASS.

- [ ] **Step 5: Wire into the build**

In `build-content.mjs`: extend the util import with `llmsTxt, llmsFullTxt`; add near the top (after `contentDir`):

```js
const SITE = JSON.parse(readFileSync(resolve(frontendRoot, 'src/app/core/site-identity.json'), 'utf8'));
```

Replace the block from `const staticRoutes = [...]` to the end of the file with:

```js
// Static pages: sitemap lastmod + the llms.txt "Pages" section.
// RULE: when the copy of a static page changes, bump its lastmod here in the same PR.
const STATIC_PAGES = [
  { path: '/', title: 'Home', description: SITE.sentence, lastmod: '2026-08-02' },
  { path: '/try', title: 'Try TulipLot without an account', description: 'Two live cells with no signup; they move into a free account when you create one.', lastmod: '2026-08-15' },
  { path: '/about', title: 'About TulipLot', description: 'Why TulipLot exists, how it works, and what Try, Free, and Premium include.', lastmod: '2026-08-02' },
  { path: '/guides', title: 'Guides', description: 'Step-by-step help: your first grid, sites that refuse to embed, and Premium vs Free.', lastmod: '2026-08-01' },
  { path: '/blog', title: 'Blog', description: 'Tab overload, browser dashboards, comparisons, and product news.', lastmod: '2026-08-01' },
  { path: '/contact', title: 'Contact', description: 'How to reach the team for support, billing, feedback, and privacy requests.', lastmod: '2026-08-01' },
  { path: '/privacy', title: 'Privacy Policy', description: 'What TulipLot collects, how ads and cookies work, and your choices.', lastmod: '2026-08-01' },
  { path: '/terms', title: 'Terms of Service', description: 'The terms that govern your use of TulipLot.', lastmod: '2026-08-01' },
];
const withSlash = (r) => `https://tuliplot.com${r === '/' ? '/' : r + '/'}`;
const entries = [
  ...STATIC_PAGES.map((p) => ({ loc: withSlash(p.path), lastmod: p.lastmod })),
  ...guides.map((g) => ({ loc: withSlash(`/guides/${g.slug}`), lastmod: g.updated ?? g.date })),
  ...posts.map((p) => ({ loc: withSlash(`/blog/${p.slug}`), lastmod: p.updated ?? p.date })),
];
writeFileSync(resolve(frontendRoot, 'public/sitemap.xml'), sitemapXml(entries), 'utf8');
console.log(`sitemap: ${entries.length} urls -> public/sitemap.xml`);

const llmsDoc = (basePath) => (d) => ({
  title: d.title, url: withSlash(`${basePath}/${d.slug}`), description: d.description,
  date: d.date, updated: d.updated, markdown: d.markdown,
});
const llmsGuides = guides.map(llmsDoc('/guides'));
const llmsPosts = posts.map(llmsDoc('/blog'));
const llmsPages = STATIC_PAGES.map((p) => ({ title: p.title, url: withSlash(p.path), description: p.description }));
writeFileSync(resolve(frontendRoot, 'public/llms.txt'), llmsTxt({ site: SITE, guides: llmsGuides, posts: llmsPosts, pages: llmsPages }), 'utf8');
writeFileSync(resolve(frontendRoot, 'public/llms-full.txt'), llmsFullTxt({ site: SITE, guides: llmsGuides, posts: llmsPosts }), 'utf8');
console.log('llms: public/llms.txt, public/llms-full.txt');
```

- [ ] **Step 6: Generate and inspect**

Run: `node scripts/build-content.mjs` → prints the sitemap line (21 urls) and the llms line.
Read `public/llms.txt`: header, `> sentence`, Facts, 4 guide lines, 9 post lines, 8 page lines, Contact. Read the first 40 lines of `public/llms-full.txt`.
Run: `npx vitest run` → green.

- [ ] **Step 7: Commit**

```bash
git add frontend/scripts/content.util.mjs frontend/scripts/content.util.spec.mjs frontend/scripts/build-content.mjs frontend/public/llms.txt frontend/public/llms-full.txt frontend/public/sitemap.xml
git commit -m "feat(seo): generate llms.txt and llms-full.txt from the content build" -m "llms.txt is a curated map: the canonical sentence, three facts, one line per guide, post, and static page, and the contact URL. llms-full.txt carries the full markdown of every article. Static pages now live in one STATIC_PAGES list with a per-page sitemap lastmod." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 10: `/changelog/` page

**Files:**
- Create: `content/changelog.md`
- Modify: `frontend/scripts/content.util.mjs` (+ spec)
- Modify: `frontend/scripts/build-content.mjs`
- Modify: `frontend/src/app/features/marketing/content.model.ts`
- Create: `frontend/src/app/features/marketing/changelog.component.ts`
- Create: `frontend/src/app/features/marketing/changelog.component.spec.ts`
- Modify: `frontend/src/app/app.routes.ts`, `frontend/src/app/app.routes.server.ts`

**Interfaces:**
- Produces: `parseChangelog(body: string): { entries: {date, title, markdown}[], newest: string }` in `content.util.mjs`; `CHANGELOG: ChangelogDoc` exported from `content.generated.ts` with `{ title, description, html, updated }`; `ChangelogDoc` in `content.model.ts`; route `/changelog` prerendered; sitemap entry `/changelog/` with `lastmod = CHANGELOG.updated`; a `/changelog` line in `llms.txt` Pages.

- [ ] **Step 1: Write the changelog content**

Create `content/changelog.md`. Every entry heading is `## YYYY-MM-DD — title`, newest first. Facts only, from the repo history:

```markdown
---
title: Changelog
description: What changed on TulipLot, newest first: features, fixes, and content updates.
---
## 2026-08-15 — Companion 1.2.0 and a full-size try grid

- TulipLot Companion 1.2.0: the header rule is now scoped to open dashboard tabs. Sites you enable, such as YouTube, render live in the grid.
- The `/try` page renders its six cells at the same size as the signed-in dashboard.

## 2026-08-14 — Google sign-in fix, per-site enable, ads.txt

- Google sign-in works again. A session save failed after a successful Google login since 2026-08-02.
- The Companion asks for the per-site host grant from the cell after installation. Before, install alone unlocked nothing.
- `ads.txt` carries the real AdSense publisher id.

## 2026-08-04 — Comparison pages and a start-page listicle

- New posts: TulipLot vs Toby, TulipLot vs Workona, TulipLot vs start.me, and The best start pages in 2026. Every competitor number comes from each vendor's own pages.

## 2026-08-02 — Try without an account; new guides and posts

- New `/try` page: two live cells, no signup. Your cells move into a free account when you create one.
- New guide: Why some sites won't load in a dashboard. New posts: How to view multiple websites at once, Gmail and Google Calendar side by side, What is a browser start page.
- The four original guides and posts grew to 800–1,500 words each. Every post has a banner image. Articles link to each other under "Keep reading".

## 2026-08-01 — Search and share polish

- Share cards for every page, structured data (FAQ, Article, SoftwareApplication), a real 404 page, and clean canonical URLs.

## 2026-07-31 — TulipLot launches

- tuliplot.com is live: a fixed 3×2 grid of live websites in one tab. Free: five usable cells plus one ad cell. Premium: six cells, no ad, $4 a month.
```

- [ ] **Step 2: Failing parser tests**

Add `parseChangelog` to the import in `content.util.spec.mjs` and append:

```js
describe('parseChangelog', () => {
  const body = ['## 2026-08-15 — Newest', '', '- a', '', '## 2026-08-02 — Older', '', 'text', ''].join('\n');
  it('splits entries newest-first with date, title, and markdown, and reports newest', () => {
    const r = parseChangelog(body);
    expect(r.newest).toBe('2026-08-15');
    expect(r.entries.map((e) => e.date)).toEqual(['2026-08-15', '2026-08-02']);
    expect(r.entries[0]).toEqual({ date: '2026-08-15', title: 'Newest', markdown: '- a' });
    expect(r.entries[1].markdown).toBe('text');
  });
  it('throws on a heading without the date — title shape', () => {
    expect(() => parseChangelog('## Just a title\n\nx')).toThrow(/YYYY-MM-DD — title/);
  });
  it('throws on an impossible date and on ascending order', () => {
    expect(() => parseChangelog('## 2026-13-45 — x\n\ny')).toThrow(/date/);
    expect(() => parseChangelog('## 2026-08-01 — a\n\nx\n\n## 2026-08-02 — b\n\ny')).toThrow(/newest first/);
  });
  it('throws on text before the first heading and on an empty file', () => {
    expect(() => parseChangelog('stray\n## 2026-08-01 — a\n\nx')).toThrow(/before the first/);
    expect(() => parseChangelog('')).toThrow(/no entries/);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run scripts/content.util.spec.mjs` → FAIL.

- [ ] **Step 4: Implement the parser**

Append to `content.util.mjs`:

```js
/**
 * content/changelog.md: `## YYYY-MM-DD — title` headings, newest first, each followed by markdown.
 * Returns the entries in file order and the newest date (for sitemap lastmod).
 */
export function parseChangelog(body) {
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const entries = [];
  let cur = null;
  for (const line of lines) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      const m = /^(\d{4}-\d{2}-\d{2})\s+—\s+(.+)$/.exec(h[1].trim());
      if (!m) throw new Error(`changelog: heading "${h[1]}" must be "YYYY-MM-DD — title"`);
      if (!isRealIsoDate(m[1])) throw new Error(`changelog: "${m[1]}" is not a real date`);
      if (cur && m[1] > cur.date) throw new Error(`changelog: entries must be newest first (${m[1]} after ${cur.date})`);
      cur = { date: m[1], title: m[2].trim(), lines: [] };
      entries.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else if (line.trim() !== '') {
      throw new Error('changelog: text before the first entry heading');
    }
  }
  if (entries.length === 0) throw new Error('changelog: no entries');
  return {
    entries: entries.map((e) => ({ date: e.date, title: e.title, markdown: e.lines.join('\n').trim() })),
    newest: entries[0].date,
  };
}
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run scripts/content.util.spec.mjs` → PASS.

- [ ] **Step 6: Export `CHANGELOG` from the build**

`content.model.ts` — append:

```ts
export interface ChangelogDoc {
  title: string;
  description: string;
  html: string;      // h2 per entry with a <time>, then the entry markdown rendered
  updated: string;   // newest entry date — sitemap lastmod
}
```

`build-content.mjs` — extend the util import with `parseChangelog, xmlEscape`. After `const posts = …` add:

```js
function loadChangelog() {
  const raw = readFileSync(resolve(contentDir, 'changelog.md'), 'utf8');
  const { data, body } = splitFrontmatter(raw);
  const { entries, newest } = parseChangelog(body);
  const html = entries
    .map((e) =>
      `<h2 id="${e.date}"><time datetime="${e.date}">${e.date}</time> — ${xmlEscape(e.title)}</h2>\n` +
      marked.parse(e.markdown),
    )
    .join('\n');
  return { title: data.title || 'Changelog', description: data.description || '', html, updated: newest };
}
const changelog = loadChangelog();
```

Change the generated-file output to include it. Replace the `out` template so it reads:

```js
const out =
  banner +
  `import { ContentDoc, ChangelogDoc } from './content.model';\n\n` +
  `export const GUIDES: ContentDoc[] = ${serialize(guides)};\n\n` +
  `export const POSTS: ContentDoc[] = ${serialize(posts)};\n\n` +
  `export const CHANGELOG: ChangelogDoc = ${JSON.stringify(changelog, null, 2)};\n`;
```

Add the changelog row to `STATIC_PAGES` (after `/about`):

```js
  { path: '/changelog', title: 'Changelog', description: changelog.description, lastmod: changelog.updated },
```

- [ ] **Step 7: Failing component test**

Create `frontend/src/app/features/marketing/changelog.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { ChangelogComponent } from './changelog.component';
import { CHANGELOG } from './content.generated';

describe('ChangelogComponent', () => {
  it('renders the H1, every entry heading with a <time>, and sets the title', async () => {
    await TestBed.configureTestingModule({
      imports: [ChangelogComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(ChangelogComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toBe('Changelog');
    const times = Array.from(el.querySelectorAll('article h2 time')).map((t) => t.getAttribute('datetime'));
    expect(times[0]).toBe(CHANGELOG.updated);
    expect(times.length).toBeGreaterThanOrEqual(2);
    expect(document.title).toBe('Changelog — what changed on TulipLot · TulipLot');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://tuliplot.com/changelog/');
  });
});
```

- [ ] **Step 8: Regenerate, run to see it fail**

Run: `node scripts/build-content.mjs` (now prints `sitemap: 22 urls`), then `npx vitest run src/app/features/marketing/changelog.component.spec.ts` → FAIL (component missing).

- [ ] **Step 9: Implement the component and routes**

Create `frontend/src/app/features/marketing/changelog.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHANGELOG } from './content.generated';
import { SeoService } from '../../core/services/seo.service';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from './site-footer.component';

@Component({
  selector: 'tl-changelog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <tl-site-header />
    <div class="tl-hero-band tl-hero-band--tight">
      <div class="tl-hero-band__inner">
        <a routerLink="/" class="tl-back">← TulipLot home</a>
        <h1>Changelog</h1>
        <p>What changed on TulipLot, newest first.</p>
      </div>
    </div>
    <article class="tl-article" [innerHTML]="changelog.html"></article>
    <tl-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--tl-bg); }
    article { flex: 1; padding-top: 36px; }
  `],
})
export class ChangelogComponent {
  protected readonly changelog = CHANGELOG;

  constructor() {
    inject(SeoService).set({
      title: 'Changelog — what changed on TulipLot',
      description: CHANGELOG.description,
      path: '/changelog',
    });
  }
}
```

`app.routes.ts` — insert before the `try` route:

```ts
  { path: 'changelog', loadComponent: () =>
      import('./features/marketing/changelog.component').then((m) => m.ChangelogComponent) },
```

`app.routes.server.ts` — insert before `{ path: 'try', … }`:

```ts
  { path: 'changelog', renderMode: RenderMode.Prerender },
```

- [ ] **Step 10: Run the file and the suite**

Run: `npx vitest run src/app/features/marketing/changelog.component.spec.ts` → PASS.
Run: `npx vitest run` → green. Read `public/sitemap.xml` and confirm `https://tuliplot.com/changelog/` with `lastmod 2026-08-15`; read `public/llms.txt` and confirm a Changelog line under Pages.

- [ ] **Step 11: Commit**

```bash
git add content/changelog.md frontend/scripts/content.util.mjs frontend/scripts/content.util.spec.mjs frontend/scripts/build-content.mjs frontend/src/app/features/marketing/content.model.ts frontend/src/app/features/marketing/content.generated.ts frontend/src/app/features/marketing/changelog.component.ts frontend/src/app/features/marketing/changelog.component.spec.ts frontend/src/app/app.routes.ts frontend/src/app/app.routes.server.ts frontend/public/sitemap.xml frontend/public/llms.txt frontend/public/llms-full.txt
git commit -m "feat(site): /changelog page from content/changelog.md" -m "Entries are '## YYYY-MM-DD — title' headings, newest first; the build validates the shape and order and exports CHANGELOG. The page is prerendered, in the sitemap with the newest date as lastmod, and listed in llms.txt." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 11: `robots.txt`

**Files:**
- Modify: `frontend/public/robots.txt`

- [ ] **Step 1: Replace the file**

```
User-agent: *
Allow: /
Disallow: /app
Content-Signal: search=yes, ai-input=yes, ai-train=yes

User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Applebot-Extended
Allow: /
Disallow: /app

Sitemap: https://tuliplot.com/sitemap.xml
```

- [ ] **Step 2: Check the shape**

Run: `node -e "const t=require('fs').readFileSync('public/robots.txt','utf8'); const g=t.split(/\n\s*\n/); if(g.length!==3) throw new Error('expected 3 groups'); if(!/^User-agent: \*\nAllow: \/\nDisallow: \/app\nContent-Signal: search=yes, ai-input=yes, ai-train=yes$/m.test(t)) throw new Error('wildcard block'); if(!/Sitemap: https:\/\/tuliplot.com\/sitemap.xml/.test(t)) throw new Error('sitemap'); console.log('robots ok')"`
Expected: `robots ok`.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/robots.txt
git commit -m "feat(seo): robots.txt Content-Signal and an explicit AI-crawler allow block" -m "search=yes, ai-input=yes, ai-train=yes is the owner's decision. The named block makes the intent explicit for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, and Applebot-Extended. /app stays disallowed for all." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 12: Footer links

**Files:**
- Modify: `frontend/src/app/features/marketing/site-footer.component.ts`
- Create: `frontend/src/app/features/marketing/site-footer.spec.ts`

- [ ] **Step 1: Failing test**

Create `site-footer.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  it('links Guides, Blog, Try, Changelog, About, Contact, Privacy, Terms in that order', () => {
    TestBed.configureTestingModule({ imports: [SiteFooterComponent], providers: [provideRouter([])] });
    const f = TestBed.createComponent(SiteFooterComponent);
    f.detectChanges();
    const hrefs = Array.from((f.nativeElement as HTMLElement).querySelectorAll('nav.links a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/guides', '/blog', '/try', '/changelog', '/about', '/contact', '/privacy', '/terms']);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/app/features/marketing/site-footer.spec.ts` → FAIL.

- [ ] **Step 3: Implement**

Replace the `<nav class="links">` block in `site-footer.component.ts`:

```html
      <nav class="links">
        <a routerLink="/guides" routerLinkActive="active">Guides</a>
        <a routerLink="/blog" routerLinkActive="active">Blog</a>
        <a routerLink="/try" routerLinkActive="active">Try</a>
        <a routerLink="/changelog" routerLinkActive="active">Changelog</a>
        <a routerLink="/about" routerLinkActive="active">About</a>
        <a routerLink="/contact" routerLinkActive="active">Contact</a>
        <a routerLink="/privacy" routerLinkActive="active">Privacy</a>
        <a routerLink="/terms" routerLinkActive="active">Terms</a>
      </nav>
```

Change the `.links` style so eight links wrap on a narrow screen: `.links { display: flex; flex-wrap: wrap; gap: 12px 22px; }`.

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run src/app/features/marketing/site-footer.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/marketing/site-footer.component.ts frontend/src/app/features/marketing/site-footer.spec.ts
git commit -m "feat(site): footer links Guides, Blog, Try, and Changelog" -m "The header hides Guides and Blog under 640 px and Try appeared only in the hero. Every page now links all public sections from the footer." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 13: Titles and descriptions

**Files:**
- Modify: `content/blog/what-is-a-browser-start-page.md`, `content/blog/tuliplot-vs-toby.md`, `content/blog/tuliplot-vs-workona.md`, `content/blog/tuliplot-vs-start-me.md`, `content/blog/gmail-and-calendar-side-by-side.md`, `content/blog/view-multiple-websites-at-once.md` (frontmatter only)
- Modify: `frontend/src/app/features/marketing/privacy.component.ts`, `terms.component.ts`, `contact.component.ts` (the `description:` string)

- [ ] **Step 1: Add `seoTitle` to four posts**

Insert a `seoTitle:` line after the `title:` line of each frontmatter (do not change `title`):

| File | Line to add |
|---|---|
| `what-is-a-browser-start-page.md` | `seoTitle: What is a browser start page? Do you need one?` |
| `tuliplot-vs-toby.md` | `seoTitle: TulipLot vs Toby: live grid or saved tabs?` |
| `tuliplot-vs-workona.md` | `seoTitle: TulipLot vs Workona: live grid or spaces?` |
| `tuliplot-vs-start-me.md` | `seoTitle: TulipLot vs start.me: live sites or widgets?` |

- [ ] **Step 2: Replace five post descriptions**

Replace the `description:` line:

| File | New `description:` |
|---|---|
| `gmail-and-calendar-side-by-side.md` | `description: Google's side panel, a second window, or a dashboard launcher: three honest ways to keep Gmail and Calendar in view at once, and what Google won't embed.` |
| `tuliplot-vs-start-me.md` | `description: start.me builds a start page from bookmarks and widgets. TulipLot renders a fixed grid of real sites, live. How the two differ, and what each one costs.` |
| `tuliplot-vs-toby.md` | `description: Toby saves tabs you reopen later. TulipLot keeps a fixed grid of sites live at once. An honest look at both, with prices and free-plan limits.` |
| `tuliplot-vs-workona.md` | `description: Workona sorts tabs into per-project spaces with sync. TulipLot keeps a fixed grid of sites rendered live. What each one is for, and what each one costs.` |
| `view-multiple-websites-at-once.md` | `description: Five ways to see two or more websites at the same time: split screen, browser windows, extensions, and a fixed dashboard grid. When each is the right call.` |

- [ ] **Step 3: Replace three component descriptions**

| File | New `description:` value |
|---|---|
| `privacy.component.ts` | `'What TulipLot collects, how the ad cell and cookies work, how long data is kept, how to delete your account, and the rights you have over your data.'` |
| `terms.component.ts` | `'The terms that govern TulipLot: accounts, the free and Premium plans, acceptable use, disclaimer and liability, changes, and how to contact us.'` |
| `contact.component.ts` | `'How to reach the TulipLot team for support, billing, feedback, and privacy requests, which address to use for each, and the response times to expect.'` |

- [ ] **Step 4: Regenerate and verify lengths**

Run: `node scripts/build-content.mjs` (the `seoTitle` check passes; all four are ≤ 49).
Then check the lengths over the markdown:
`node -e "const fs=require('fs');for(const f of fs.readdirSync('../content/blog')){const t=fs.readFileSync('../content/blog/'+f,'utf8');const d=/^description: (.*)$/m.exec(t)[1];const s=/^seoTitle: (.*)$/m.exec(t);console.log(f,'desc',d.length,s?'seoTitle '+s[1].length:'')}"`
Expected: every `desc` between 130 and 160; the four `seoTitle` values 41–46.
Run: `npx vitest run` → green (the `seoTitle` branch of the Task 6 test now runs).

- [ ] **Step 5: Commit**

```bash
git add content/blog frontend/src/app/features/marketing/privacy.component.ts frontend/src/app/features/marketing/terms.component.ts frontend/src/app/features/marketing/contact.component.ts frontend/src/app/features/marketing/content.generated.ts frontend/public/llms.txt frontend/public/llms-full.txt
git commit -m "content(seo): shorter <title> for four posts via seoTitle; 150-160 char descriptions" -m "Four titles were 62-68 characters with the suffix; seoTitle keeps the H1 and trims the tab title. Five post descriptions were 172-187 characters; privacy, terms, and contact were 43-84. All now sit between 134 and 155." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 14: Key-facts lists on the three comparison posts

**Files:**
- Modify: `content/blog/tuliplot-vs-toby.md`, `content/blog/tuliplot-vs-workona.md`, `content/blog/tuliplot-vs-start-me.md`

Every number below is copied from `docs/seo/2026-08-02-competitor-facts-verified.md`. Do not add any other competitor statement.

- [ ] **Step 1: Insert the list**

In each file, insert the block directly after the `# …` H1 line (line 8) and its blank line, before the first paragraph:

`tuliplot-vs-toby.md`:

```markdown
**Key facts**

- Toby is a visual workspace that saves and organizes browser tabs and links into collections. Its own words: "Stop Drowning in Tabs."
- Toby's free Starter plan is $0 and allows up to 60 saved tabs across all your collections.
- Toby Productivity is $6 USD per member per month, or $4.50 per member per month billed yearly ($54/year).
- TulipLot does not save tabs. It keeps up to six sites live in a fixed grid: Try is 2 cells with no account, Free is 5 cells plus 1 ad cell at $0, Premium is 6 cells with no ad at $4/month.

```

`tuliplot-vs-workona.md`:

```markdown
**Key facts**

- Workona is a tab and project workspace manager: tabs go into per-project Spaces with auto-save and cross-device sync. Its own words: "Get your tabs under control."
- Workona's free plan is $0 and is capped at 5 spaces. Workona's FAQ says it "can be used forever."
- Workona Pro is listed as "Starting at $7 / month," which is the annual-billed rate.
- TulipLot does not save or restore sessions. It keeps up to six sites live in a fixed grid: Try is 2 cells with no account, Free is 5 cells plus 1 ad cell at $0, Premium is 6 cells with no ad at $4/month.

```

`tuliplot-vs-start-me.md`:

```markdown
**Key facts**

- start.me is a bookmark manager and custom start page built from links and widgets. Its own title tag: "Bookmark Manager, Custom Start Page & New Tab."
- start.me's free plan is $0, allows a maximum of 3 start pages, and includes advertising.
- start.me Personal PRO is $25 per year, with unlimited start pages and no ads.
- TulipLot renders live sites, not bookmarks or widgets, in a fixed grid: Try is 2 cells with no account, Free is 5 cells plus 1 ad cell at $0, Premium is 6 cells with no ad at $4/month.

```

- [ ] **Step 2: Cross-check every number**

Run: `grep -n "60 Saved Tabs\|\$6 USD per member\|\$4.50\|\$54/year\|5 spaces\|Starting at \$7\|Maximum of 3 start pages\|Includes advertising\|\$25 per year" ../docs/seo/2026-08-02-competitor-facts-verified.md`
Expected: every number in the three lists appears in the output. If one does not, remove that bullet's claim; do not guess.

- [ ] **Step 3: Regenerate and check the render**

Run: `node scripts/build-content.mjs`, then confirm in `content.generated.ts` that each of the three posts' `html` starts with `<p><strong>Key facts</strong></p>\n<ul>`. Run `npx vitest run` → green.

- [ ] **Step 4: Commit**

```bash
git add content/blog/tuliplot-vs-toby.md content/blog/tuliplot-vs-workona.md content/blog/tuliplot-vs-start-me.md frontend/src/app/features/marketing/content.generated.ts frontend/public/llms-full.txt
git commit -m "content(aeo): key-facts list under the H1 of the three comparison posts" -m "Four bullets: what the competitor is, its free-plan limit, its paid price, and what TulipLot does instead with the Try/Free/Premium numbers. Every competitor number is copied from the verified-facts file." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 15: Outbound citations

**Files:**
- Modify: `content/guides/why-sites-wont-load.md`, `content/guides/add-any-site.md`, `content/blog/view-multiple-websites-at-once.md`, `content/blog/tuliplot-vs-toby.md`, `content/blog/tuliplot-vs-workona.md`, `content/blog/tuliplot-vs-start-me.md`

- [ ] **Step 1: Verify every URL first**

Run each with a browser user agent; keep a URL only when the final status is 200:

```bash
for u in \
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options" \
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors" \
  "https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest" \
  "https://support.microsoft.com/en-us/windows/snap-your-windows-885a9b1e-a983-a3b1-16cd-c531795e6241" \
  "https://support.apple.com/en-us/102573" \
  "https://www.gettoby.com/pricing" \
  "https://workona.com/pricing/" \
  "https://start.me/pricing"; do
  printf '%s -> ' "$u"; curl -sL -o /dev/null -w '%{http_code}\n' -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" "$u"
done
```

Rules: a `200` keeps the link. A `301/302` that curl followed to `200` keeps the link, but use the final URL (`-w '%{url_effective}'`). A `403` or `404` drops that link — remove it from the edits below and note it in the commit body. Do not replace a failed URL with a guessed one.

- [ ] **Step 2: Edit the sentences**

`content/guides/why-sites-wont-load.md`:
- Line 23, first words: change `` `X-Frame-Options` is the older of the two `` to `` [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) is the older of the two ``.
- Line 25, first words: change `` `Content-Security-Policy: frame-ancestors` is the newer replacement `` to `` [`Content-Security-Policy: frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) is the newer replacement ``.

`content/guides/add-any-site.md`:
- Line 15: change `` — `X-Frame-Options` or a `Content-Security-Policy` with `frame-ancestors` — `` to `` — [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) or a `Content-Security-Policy` with [`frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) — ``.
- Line 31: change `it adjusts frame-blocking headers only for sites you've explicitly enabled` to `it [adjusts frame-blocking headers](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) only for sites you've explicitly enabled`.

`content/blog/view-multiple-websites-at-once.md`, line 28:
- `Windows has Snap:` → `Windows has [Snap](https://support.microsoft.com/en-us/windows/snap-your-windows-885a9b1e-a983-a3b1-16cd-c531795e6241):`
- `macOS has Split View:` → `macOS has [Split View](https://support.apple.com/en-us/102573):`

`content/blog/tuliplot-vs-toby.md`, line 28 (now shifted by the key-facts block; find the sentence): `Toby's free Starter plan is $0` → `[Toby's free Starter plan](https://www.gettoby.com/pricing) is $0`.

`content/blog/tuliplot-vs-workona.md`, the sentence starting `Workona's free plan is $0, capped at 5 spaces`: → `[Workona's free plan](https://workona.com/pricing/) is $0, capped at 5 spaces`.

`content/blog/tuliplot-vs-start-me.md`, the sentence starting `Above free, the honest number is one that doesn't flatter TulipLot: start.me's Personal PRO plan is $25 per year`: → `… TulipLot: [start.me's Personal PRO plan](https://start.me/pricing) is $25 per year`.

- [ ] **Step 3: Regenerate and check the render**

Run: `node scripts/build-content.mjs`, then `grep -o 'href="https://[^"]*" target="_blank" rel="noopener"' src/app/features/marketing/content.generated.ts | sort | uniq -c`.
Expected: one line per kept URL (MDN URLs appear twice, once per guide), plus the three pre-existing vendor home links.
Run: `npx vitest run` → green.

- [ ] **Step 4: Commit**

```bash
git add content/guides/why-sites-wont-load.md content/guides/add-any-site.md content/blog/view-multiple-websites-at-once.md content/blog/tuliplot-vs-toby.md content/blog/tuliplot-vs-workona.md content/blog/tuliplot-vs-start-me.md frontend/src/app/features/marketing/content.generated.ts frontend/public/llms-full.txt
git commit -m "content(geo): cite MDN, Microsoft, Apple, and vendor pricing pages inline" -m "Six articles now link the source where a concept or a number first appears. Every URL was fetched and returned 200 before it shipped. Dropped URLs, if any: <list them or 'none'>." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 16: About page — canonical sentence and GitHub link

**Files:**
- Modify: `frontend/src/app/features/marketing/about.component.ts`

- [ ] **Step 1: Failing test**

There is no `about.component.spec.ts`. Create `frontend/src/app/features/marketing/about.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { AboutComponent } from './about.component';
import { SITE } from '../../core/site-identity';

describe('AboutComponent', () => {
  it('opens with the canonical sentence and links the GitHub repository', async () => {
    await TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(AboutComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.tl-lead')?.textContent?.replace(/\s+/g, ' ').trim().startsWith(SITE.sentence)).toBe(true);
    const gh = el.querySelector('a[href="https://github.com/xamcross/tuliplot"]');
    expect(gh).toBeTruthy();
    expect(gh?.getAttribute('rel')).toBe('noopener');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/app/features/marketing/about.component.spec.ts` → FAIL.

- [ ] **Step 3: Implement**

In `about.component.ts`: add `import { SITE } from '../../core/site-identity';`. Replace the lead paragraph:

```html
      <p class="tl-lead">
        {{ sentence }} It is an independent productivity tool built for people who live
        in a handful of web apps all day. Instead of a wall of browser tabs, you
        get a single fixed grid — a personal cockpit for the sites you actually
        use.
      </p>
```

Replace the Contact paragraph:

```html
      <h2>Contact</h2>
      <p>
        Questions, feedback, or press: email
        <a href="mailto:hello&#64;tuliplot.com">hello&#64;tuliplot.com</a>.
        The code is public on
        <a [href]="github" target="_blank" rel="noopener">GitHub</a>.
      </p>
```

In the class body add, above the constructor:

```ts
  protected readonly sentence = SITE.sentence;
  protected readonly github = SITE.sameAs[0];
```

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run src/app/features/marketing/about.component.spec.ts` → PASS. Then `npx vitest run` → green.

- [ ] **Step 5: Bump the About lastmod**

In `build-content.mjs` `STATIC_PAGES`, set the `/about` row `lastmod` to `'2026-08-15'`. Run `node scripts/build-content.mjs`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/marketing/about.component.ts frontend/src/app/features/marketing/about.component.spec.ts frontend/scripts/build-content.mjs frontend/public/sitemap.xml
git commit -m "content(geo): About opens with the canonical sentence and links the GitHub repo" -m "The sentence renders from SITE so it cannot drift from JSON-LD and llms.txt. No founder or disambiguation text (owner decision)." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 17: Build gate and local verification

**Files:** none modified (fixes, if any, go into the task that owns the file).

- [ ] **Step 1: Full suite**

Run (from `frontend/`): `npx vitest run` → all files green. Note the counts.

- [ ] **Step 2: Production build with the pinned Node**

Run (Git Bash, from `frontend/`):
```bash
export PATH="$HOME/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"; node -v; npm run build
```
Expected: `node -v` prints `v22.22.3`; the build prerenders 23 routes (22 sitemap URLs + `/404`) and exits 0.

- [ ] **Step 3: Inspect the output**

```bash
ls dist/frontend/browser/changelog/index.html dist/frontend/browser/llms.txt dist/frontend/browser/llms-full.txt dist/frontend/browser/logo-512.png dist/frontend/browser/banners/tuliplot-vs-toby-og.png dist/frontend/browser/404.html
grep -c '<loc>' dist/frontend/browser/sitemap.xml
grep -o '<title>[^<]*' dist/frontend/browser/blog/tuliplot-vs-toby/index.html
grep -o 'property="og:type" content="[^"]*"\|property="article:published_time" content="[^"]*"\|property="og:image" content="[^"]*"' dist/frontend/browser/blog/tuliplot-vs-toby/index.html
grep -o '"@type":"BreadcrumbList"\|"dateModified":"[^"]*"\|"sameAs":\[[^]]*\]' dist/frontend/browser/blog/tuliplot-vs-toby/index.html dist/frontend/browser/index.html
grep -o '<time datetime="[^"]*"' dist/frontend/browser/guides/why-sites-wont-load/index.html | head -1
grep -c 'rel="noopener"' dist/frontend/browser/guides/why-sites-wont-load/index.html
grep -o '<h1[^>]*>[^<]*' dist/frontend/browser/blog/tuliplot-vs-toby/index.html
grep -o 'nav class="links".*</nav>' dist/frontend/browser/index.html | grep -o 'href="[^"]*"' | tr '\n' ' '
```
Expected: all six files exist; `22` locs; title `TulipLot vs Toby: live grid or saved tabs? · TulipLot`; `og:type=article`, a published time, the `-og.png` image; BreadcrumbList and dateModified on the post, sameAs on the home page; a `<time datetime="2026-08-02">` on the guide; at least 2 noopener links; the H1 is still `TulipLot vs Toby: which one fits how you actually work?`; eight footer hrefs.

- [ ] **Step 4: Fix and re-run if anything differs**

Fix in the owning file, add a test that would have caught it, commit with a `fix(...)` subject, and repeat Steps 1–3.

---

### Task 18: Pull request and post-deploy verification

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin worktree-seo-geo-aeo-hardening
gh pr create --title "feat(seo): SEO + GEO + AEO hardening — identity, article metadata, llms.txt, changelog" --body-file - <<'EOF'
Implements docs/superpowers/specs/2026-08-15-seo-geo-aeo-hardening-design.md (plan: docs/superpowers/plans/2026-08-15-seo-geo-aeo-hardening.md), from the audit docs/seo/2026-08-15-seo-geo-aeo-audit.md.

- site-identity.json/.ts: one source for name, URL, canonical sentence, PNG logo, sameAs, price
- SeoService: optional type/image/published/modified; article:* tags reset on website pages
- Home JSON-LD: Organization @id + sameAs + logo + description; WebSite.publisher; two offers
- Article JSON-LD: dateModified from `updated:`, per-post 1200x630 image, PNG publisher logo; BreadcrumbList; visible <time> on guides and posts; `seoTitle:` for four long titles (H1 unchanged)
- Content build: real-date validation, llms.txt + llms-full.txt, /changelog page, per-route sitemap lastmod, external links get target/rel
- robots.txt: Content-Signal search=yes, ai-input=yes, ai-train=yes + explicit AI-crawler block
- Footer: Guides, Blog, Try, Changelog
- Content: 8 descriptions to 134-155 chars, key-facts lists on the three vs-posts, citations in six articles, About opens with the canonical sentence

Post-merge verification (curl-level) is in the plan's Task 18.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u
EOF
```

- [ ] **Step 2: Wait for CI, then merge (owner or on the owner's instruction)**

Run: `gh pr checks --watch`. Merge only when green and the owner agrees.

- [ ] **Step 3: Verify the live site after the auto-deploy**

Wait about two minutes after merge, then run from any folder:

```bash
curl -s -o /dev/null -w 'llms.txt %{http_code} %{content_type}\n' https://tuliplot.com/llms.txt
curl -s https://tuliplot.com/llms.txt | head -3
curl -s -o /dev/null -w 'llms-full %{http_code}\n' https://tuliplot.com/llms-full.txt
curl -s https://tuliplot.com/robots.txt | grep -c 'Content-Signal\|GPTBot\|ClaudeBot'
curl -s -o /dev/null -w 'changelog %{http_code}\n' https://tuliplot.com/changelog/
curl -s https://tuliplot.com/sitemap.xml | grep -c '<loc>'
curl -s https://tuliplot.com/blog/tuliplot-vs-toby/ | grep -o '<title>[^<]*\|property="og:type" content="[^"]*"\|property="article:published_time" content="[^"]*"\|property="og:image" content="[^"]*"\|"@type":"BreadcrumbList"'
curl -s -o /dev/null -w 'og %{http_code} %{content_type}\n' https://tuliplot.com/banners/tuliplot-vs-toby-og.png
curl -s -o /dev/null -w 'logo %{http_code}\n' https://tuliplot.com/logo-512.png
curl -s https://tuliplot.com/ | grep -o '"sameAs":\[[^]]*\]'
curl -s https://tuliplot.com/guides/why-sites-wont-load/ | grep -o '<time datetime="[^"]*"' | head -1
```
Expected: `200 text/plain` and `# TulipLot`; `200`; count 3; `200`; `22`; the shorter title, `article`, a date, the `-og.png`, BreadcrumbList; `200 image/png`; `200`; the sameAs array; a `<time>`.
Then open https://search.google.com/test/rich-results for `https://tuliplot.com/` and one post; expect no errors (warnings are acceptable).

- [ ] **Step 4: Record**

Tick the four boxes in `docs/seo/2026-08-15-seo-geo-aeo-audit.md`'s action plan that this PR covered (items 7–14 under "Quick wins — one code PR") by adding `— DONE <date>` after each, and commit that edit on `main` (or in a follow-up PR).

---

## Self-review notes

- Spec coverage: §1 → Task 1; §2 → Task 2; §3 → Task 3; §4 → Tasks 4, 6; §5 frontmatter/og/llms/changelog/sitemap → Tasks 5, 7, 9, 10; §6 → Task 6; §7 → Task 11; §8 → Task 12; §9 titles/descriptions → 13, About → 16, key facts → 14, citations → 8 + 15; Testing → each task; Verification → 17, 18. The spec's `banners.spec.mjs` both-sizes assertion is Task 7; `site-footer.spec.ts` is Task 12; `about.component.spec.ts` (not named in the spec) is added in Task 16 because About now renders from `SITE`.
- Names used across tasks: `SITE` (Task 1) in 2, 3, 4, 9 (JSON), 16; `SeoOptions.type/image/published/modified` (Task 2) in 6; `buildBreadcrumbJsonLd` (Task 4) in 6; `ContentDoc.updated/seoTitle/ogImage` (Task 4) in 5, 6; `validateDates/validateSeoTitle/isRealIsoDate` (Task 5) in 10; `isExternalHref` (Task 8) in `build-content.util.mjs`; `STATIC_PAGES` (Task 9) in 10, 16; `parseChangelog` and `CHANGELOG` (Task 10) in the component and routes.
