# SEO + GEO + AEO hardening — design

Date: 2026-08-15
Status: approved by the owner (this session), section by section
Source: `docs/seo/2026-08-15-seo-geo-aeo-audit.md` (the audit that proposed this work)
Scope decision: the "one code PR" quick wins from the audit, plus a small `/changelog/` page.
The `/companion/` page, the per-app embed pages, a `Person` author, and founder text on About are
out of scope. They get their own specs.

## The problem

The audit found a strong technical base and three gaps that code can close:

1. Generative engines cannot identify the entity. The `Organization` JSON-LD has no `sameAs`, an SVG
   logo, and no description. Home, About, and JSON-LD each describe the product with different words.
   There is no `llms.txt`.
2. Article metadata is incomplete. `dateModified` always equals `datePublished`. `og:type` is
   `website` on every article. Every page shares one `og:image`. There is no `BreadcrumbList`.
   Guides show no visible date. Ten of thirteen articles cite no external source.
3. Small on-page defects: four `<title>` tags over 60 characters, five meta descriptions over 160,
   three under 90, a footer that omits Guides, Blog, and Try, and static sitemap `lastmod` values
   that no longer match the pages.

The indexation problem itself (zero pages indexed) is an owner action (Search Console, Bing, Cloudflare
toggles, directory listings). This spec does not cover it.

## What does not change

- The prerender pipeline (`@angular/ssr`, `outputMode: static`), the route list, and `_redirects`.
- `SeoService.set()` stays backward compatible. Every existing caller keeps its current arguments.
- The article markdown pipeline (`marked`, `stripLeadingH1`, `extractFaq`, `pickRelated`) and the
  `.tl-article` prose styles.
- The `og-card.png` site card and its render script.
- Article H1s. A shorter `<title>` comes from a new optional frontmatter key, not from the H1.
- The competitor-facts rule from Wave 5: every competitor number comes from
  `docs/seo/2026-08-02-competitor-facts-verified.md`. This spec adds no new competitor claims.
- Author identity: `author` stays `{ '@type': 'Organization', name: 'TulipLot' }`.

## Design

### 1. Site identity — one source of truth

New file `frontend/src/app/core/site-identity.json`:

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

New file `frontend/src/app/core/site-identity.ts` re-exports the JSON as typed constants
(`SITE`). `tsconfig.app.json` sets `resolveJsonModule: true` if it is not set. `build-content.mjs`
reads the same JSON with `readFileSync` + `JSON.parse`. The Chrome Web Store URL joins `sameAs` when
the listing exists; that is a one-line JSON edit.

New asset `frontend/public/logo-512.png` (512×512). A new script `frontend/scripts/render-logo.mjs`
rasterizes the existing `public/favicon.svg` with `sharp` onto an opaque brand-background square
(the same background colour `render-og-card.mjs` uses), asserts 512×512, and writes the PNG.
`package.json` gets `"logo": "node scripts/render-logo.mjs"`. The PNG is committed, like `og-card.png`.
Google's logo guidelines want a raster image of at least 112×112; the SVG favicon does not qualify.

### 2. `SeoService.set()` — optional article fields

```ts
set(opts: {
  title: string;
  description: string;
  path: string;
  jsonLd?: object[];
  type?: 'website' | 'article';   // default 'website'
  image?: string;                  // absolute URL; default SITE.ogImage
  published?: string;              // ISO date; used when type === 'article'
  modified?: string;               // ISO date; used when type === 'article'
}): void
```

Behaviour:

- `og:type` = `opts.type ?? 'website'`.
- When `type === 'article'`: upsert `article:published_time` = `published` and
  `article:modified_time` = `modified ?? published`. When `type` is not `article`, remove both
  tags if present. This follows the Wave 2 head-reset rule: a later navigation must not carry stale
  article tags.
- `og:image` and a new `twitter:image` = `opts.image ?? SITE.ogImage`. `og:image:width` and
  `og:image:height` stay `1200` × `630`; every image this service receives is rendered at that size.
- Everything else is unchanged.

### 3. Home JSON-LD

`landing.component.ts` builds its JSON-LD from `SITE`. Nodes and their new fields:

- `Organization`: `@id: 'https://tuliplot.com/#org'`, `name`, `url`, `logo` (`SITE.logo`),
  `description` (`SITE.sentence`), `sameAs` (`SITE.sameAs`),
  `contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', url: SITE.contactUrl }]`.
- `WebSite`: adds `publisher: { '@id': 'https://tuliplot.com/#org' }` and `description`.
- `SoftwareApplication`: adds `url`, `image` (`SITE.ogImage`), `description` (`SITE.sentence`),
  `sameAs`, `publisher: { '@id': … }`, and `offers` as an array of two `Offer`s:
  `{ name: 'Free', price: '0', priceCurrency: 'USD' }` and
  `{ name: 'Premium', price: SITE.premiumMonthlyUsd, priceCurrency: 'USD', description: 'per month' }`.
- `FAQPage`: unchanged.

The `FAQ` constant on the landing page stays the single source for both the template and the schema.

### 4. Article JSON-LD and breadcrumbs

`article-jsonld.ts`:

- `buildArticleJsonLd(doc, basePath)`: `datePublished = doc.date`, `dateModified = doc.updated ?? doc.date`,
  `image = doc.ogImage ?? SITE.ogImage`, `publisher.logo.url = SITE.logo`, `publisher['@id']` set.
  `author` unchanged.
- New `buildBreadcrumbJsonLd(items: { name: string; url: string }[])` → `BreadcrumbList` with
  `itemListElement[]` (`position` 1-based). Detail pages call it with
  `[Home, Guides|Blog, doc.title]`.

`guide-detail` and `blog-detail` pass `title: d.seoTitle ?? d.title`, `type: 'article'`,
`published: d.date`, `modified: d.updated ?? d.date`, and (blog only) `image: d.ogImage` to
`SeoService.set()`, and append the breadcrumb node to `jsonLd`. The H1 and the listing cards keep
`d.title`.

### 5. Content pipeline (`frontend/scripts/build-content.mjs`, `content.util.mjs`)

**Frontmatter.** New optional keys:

| Key | Rule | Effect |
|---|---|---|
| `updated: YYYY-MM-DD` | same format check as `date`; must be ≥ `date`; both must parse (`Date.parse` guard also fixes the `2026-13-45` gap from the Wave 3 follow-ups) | `ContentDoc.updated`; sitemap `lastmod`; `dateModified`; visible "Updated" date |
| `seoTitle: …` | plain string; build fails if longer than 49 characters | `ContentDoc.seoTitle`; used for `<title>` and `og:title`; the H1 keeps `title` |

`ContentDoc` gains `updated?: string`, `seoTitle?: string`, `ogImage?: string`. `ogImage` is set by
the build for blog posts to `https://tuliplot.com/banners/<slug>-og.png`; guides have none.

**Per-post og image.** `render-post-banners.mjs` writes a second file per post,
`public/banners/<slug>-og.png`, at 1200×630: same palette pair, the shapes recomposed for the
1.91:1 ratio, no text. The size check applies to both files. `banners.spec.mjs` asserts both exist
with the right dimensions for every post slug.

**`llms.txt` and `llms-full.txt`.** Two pure builders in `content.util.mjs`, called by
`build-content.mjs`, written to `public/`:

- `llmsTxt({ site, guides, posts, staticPages })` returns:
  ```
  # TulipLot

  > <site.sentence>

  ## Facts
  - Try: 2 usable cells, no account. Free: 5 usable cells + 1 ad cell, $0. Premium: 6 cells, no ad, $<premium>/month.
  - Most sites embed live. Some need the optional TulipLot Companion (a Chrome extension). A few never embed and open in their own tab from the grid.
  - Chrome-first. Public site: <site.url>

  ## Guides
  - [<title>](<url>): <description>
  ## Blog
  - [<title>](<url>): <description>
  ## Pages
  - [Home](https://tuliplot.com/): <site.sentence>
  - [Try TulipLot](…/try/): …   (about, changelog, contact, privacy, terms follow, one line each)
  ## Contact
  - <site.contactUrl>
  ```
  The three "Facts" lines are constants in the builder. The tier numbers come from the same values
  the pricing content uses; the Companion wording follows `content/guides/why-sites-wont-load.md`.
- `llmsFullTxt(...)` returns the same header, then for every article (guides then posts):
  `# <title>`, `Source: <url>`, `Published: <date>` (and `Updated: <updated>` when set), a blank
  line, then the markdown body with the leading H1 stripped (`stripLeadingH1`).

Both files are `text/plain`; Cloudflare Pages serves `.txt` with that type already (`ads.txt` proves it).

**`/changelog/`.** New `content/changelog.md`:

```
---
title: Changelog
description: What changed on TulipLot, newest first: features, fixes, and content updates.
---
## 2026-08-15 — Companion 1.2.0
...
## 2026-08-14 — Google sign-in fix; Companion grant flow
...
## 2026-08-02 — Try without an account; guides and comparisons
...
## 2026-07-31 — TulipLot launches
...
```

Rule: every entry heading is `## YYYY-MM-DD — <title>`, newest first. A parser
`parseChangelog(body)` in `content.util.mjs` returns `{ entries: [{ date, title, html }], newest }`
and throws on a heading that does not match the pattern or on non-descending dates.
`build-content.mjs` exports `CHANGELOG` from `content.generated.ts` as
`{ title, description, html, updated }`. The seed entries state only facts already recorded in the
repo (`docs/`, merged PR titles); no marketing claims.

New `ChangelogComponent` (`frontend/src/app/features/marketing/changelog.component.ts`): header,
hero band with H1 "Changelog", `<article class="tl-article" [innerHTML]>`, footer. Route
`changelog` with `RenderMode.Prerender` in `app.routes.server.ts` and the matching entry in
`app.routes.ts`. `SeoService.set({ title: 'Changelog — what changed on TulipLot', description, path: '/changelog' })`.
No JSON-LD.

**Sitemap.** `STATIC_LASTMOD` becomes a per-route map:

```js
const STATIC_LASTMOD = {
  '/': '2026-08-02', '/about': '2026-08-02', '/privacy': '2026-08-01', '/terms': '2026-08-01',
  '/contact': '2026-08-01', '/guides': '2026-08-01', '/blog': '2026-08-01', '/try': '2026-08-15',
};
```

`/changelog` takes `CHANGELOG.updated`. Articles take `updated ?? date`. Any later copy edit to a
static page bumps its row; the rule is written as a comment above the map. The dates above are the
last known copy changes: `/` and `/about` changed with the Try tier (2026-08-02); `/try` changed with
the full-size grid (2026-08-15).

### 6. Visible dates

`guide-detail` and `blog-detail` render, in the pill line,
`<time [attr.datetime]="d.date">{{ d.date }}</time>` and, when `d.updated` exists,
`· Updated <time [attr.datetime]="d.updated">{{ d.updated }}</time>`. Guides did not show a date
before; they do now, in the same position as posts.

### 7. `robots.txt`

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

The wildcard block already allows these crawlers. The named block makes the intent explicit and
survives a later change to the wildcard. `ai-train=yes` is the owner's decision (this session).

### 8. Footer

`site-footer.component.ts` links, in order: Guides · Blog · Try · Changelog · About · Contact ·
Privacy · Terms. The existing `flex-wrap` handles narrow screens. `routerLinkActive` stays on each.

### 9. Content edits

**Titles.** Four posts get `seoTitle` (H1 unchanged):

| Slug | `seoTitle` | Length (+11 suffix) |
|---|---|---|
| what-is-a-browser-start-page | What is a browser start page? Do you need one? | 46 (57) |
| tuliplot-vs-toby | TulipLot vs Toby: live grid or saved tabs? | 42 (53) |
| tuliplot-vs-workona | TulipLot vs Workona: live grid or spaces? | 41 (52) |
| tuliplot-vs-start-me | TulipLot vs start.me: live sites or widgets? | 44 (55) |

**Descriptions.** Replace the `description` frontmatter or component string:

| Page | New description | Length |
|---|---|---|
| gmail-and-calendar-side-by-side | Google's side panel, a second window, or a dashboard launcher: three honest ways to keep Gmail and Calendar in view at once, and what Google won't embed. | 153 |
| tuliplot-vs-start-me | start.me builds a start page from bookmarks and widgets. TulipLot renders a fixed grid of real sites, live. How the two differ, and what each one costs. | 152 |
| tuliplot-vs-toby | Toby saves tabs you reopen later. TulipLot keeps a fixed grid of sites live at once. An honest look at both, with prices and free-plan limits. | 142 |
| tuliplot-vs-workona | Workona sorts tabs into per-project spaces with sync. TulipLot keeps a fixed grid of sites rendered live. What each one is for, and what each one costs. | 152 |
| view-multiple-websites-at-once | Five ways to see two or more websites at the same time: split screen, browser windows, extensions, and a fixed dashboard grid. When each is the right call. | 155 |
| privacy | What TulipLot collects, how the ad cell and cookies work, how long data is kept, how to delete your account, and the rights you have over your data. | 148 |
| terms | The terms that govern TulipLot: accounts, the free and Premium plans, acceptable use, disclaimer and liability, changes, and how to contact us. | 143 |
| contact | How to reach the TulipLot team for support, billing, feedback, and privacy requests, which address to use for each, and the response times to expect. | 149 |

The privacy, terms, and contact descriptions name only sections those pages have today
(privacy: collect / advertising and cookies / retention and deletion / your rights; terms: accounts /
plans / acceptable use / disclaimer and liability / changes / contact; contact: general, support and
billing, privacy, response times).

**About.** The first sentence of the About intro becomes `SITE.sentence` (rendered from the constant,
not retyped). The "Contact" section adds a link to the GitHub repository. No founder text; no
disambiguation line (owner decision).

**Key-facts list.** The three comparison posts get, directly under the H1 (that is, as the first
block of the markdown body after the stripped H1), a four-bullet list under a bold lead
"Key facts":

- what the competitor is (its own category words from the facts file),
- its free-plan limit (facts file),
- its paid price (facts file, with the billing basis stated),
- what TulipLot does instead, with the Try/Free/Premium numbers.

Every competitor number is copied from `docs/seo/2026-08-02-competitor-facts-verified.md`. No new
claim. Nothing else in the body moves.

**Citations.** Outbound links (`target="_blank" rel="noopener"`, no `nofollow`) added inline where
the concept first appears:

| Article | Links |
|---|---|
| guides/why-sites-wont-load | MDN `X-Frame-Options`; MDN CSP `frame-ancestors` |
| guides/add-any-site | MDN `X-Frame-Options`; Chrome developer docs for `declarativeNetRequest` |
| blog/view-multiple-websites-at-once | Microsoft Support "Snap your windows"; Apple Support "Use Split View on Mac" |
| blog/tuliplot-vs-toby | Toby pricing page |
| blog/tuliplot-vs-workona | Workona pricing page |
| blog/tuliplot-vs-start-me | start.me pricing page |

Each URL is fetched during implementation and must return 200 (or a 3xx to a 200). A URL that fails
is dropped, not guessed. Because `marked` renders links without `target`, the pipeline adds
`target="_blank" rel="noopener"` to `http(s)` links whose host is not `tuliplot.com` through a
`marked` renderer hook in `build-content.mjs`. Internal links stay as they are.

## Testing

Vitest, existing files extended and two new ones:

- `seo.service.spec.ts`: `type: 'article'` with `published`/`modified` emits `og:type=article`,
  `article:published_time`, `article:modified_time`; a following call without `type` removes both;
  `image` sets `og:image` and `twitter:image`; the default image is `SITE.ogImage`.
- `article-jsonld.spec.ts` (new): `dateModified` falls back to `date`; `updated` wins;
  `image` uses `ogImage` when present; `publisher.logo.url` is the PNG; breadcrumb builder returns
  positions 1..n with the given names and URLs.
- `site-identity.spec.ts` (new): the sentence is non-empty; `sameAs` entries are absolute `https`
  URLs; the JSON and the TS export are the same object (guards drift).
- `landing.component.spec.ts`: JSON-LD contains an `Organization` with `sameAs`, a PNG `logo`, and
  `@id`; `SoftwareApplication` has two offers; `WebSite.publisher['@id']` matches.
- `content.util.spec.mjs`: `updated` before `date` throws; `updated` bad format throws;
  `2026-13-45` throws; `seoTitle` over 49 chars throws; `llmsTxt` output has the `#`, `>`, and
  five `##` sections in order and one line per doc; `llmsFullTxt` contains every article body
  without its H1; `parseChangelog` returns entries newest-first, reports `newest`, throws on a
  malformed heading and on ascending dates; the external-link renderer adds `target`/`rel` only to
  non-tuliplot hosts.
- `banners.spec.mjs`: for every post slug both `<slug>.png` (1440×520) and `<slug>-og.png`
  (1200×630) exist.
- `site-footer.spec.ts` (new, small): the eight links render in order.
- `blog-detail.component.spec.ts` / `guide-detail.component.spec.ts`: the `<time>` element renders
  with `datetime`; "Updated" appears only when `updated` is set; `SeoService.set` receives
  `type: 'article'` and the dates.
- `changelog.component.spec.ts` (new): renders the H1 and the generated HTML.

Build gate: `npm run build` (pinned Node 22 on this machine, per the project notes) prerenders
`/changelog/`, writes `llms.txt`, `llms-full.txt`, the sitemap with 22 URLs, and both banner sets.

## Verification after deploy (curl-level, Wave 1 convention)

- `https://tuliplot.com/llms.txt` and `/llms-full.txt` → 200, `text/plain`, first line `# TulipLot`.
- `/robots.txt` shows the Content-Signal line and the named block.
- `/changelog/` → 200 and present in `/sitemap.xml` (22 URLs).
- One post (`/blog/tuliplot-vs-toby/`): `<title>` = the `seoTitle` + suffix (53 chars),
  `og:type=article`, `article:published_time`, `og:image` = `…/banners/tuliplot-vs-toby-og.png`
  (200, 1200×630), JSON-LD has `BreadcrumbList`, `dateModified`, PNG publisher logo; the H1 is the
  long title; the "Key facts" list is the first block.
- One guide (`/guides/why-sites-wont-load/`): a `<time datetime>` is visible; MDN links present with
  `rel="noopener"`.
- Home JSON-LD: `sameAs`, `logo-512.png` (200), two offers.
- Footer on any page: eight links.
- Rich Results Test on `/` and one post: manual check, no errors.

## Out of scope

- `/companion/` landing page; per-app embed pages; `Person` author and author box; founder or
  location text on About; a `WebSite` `SearchAction` (no site search exists).
- Owner actions from the audit: Search Console and Bing verification, "Request indexing", Cloudflare
  Crawler Hints and the AI-bot toggle, directory listings, the GitHub README line, the CWS upload.
- Any change to `/app`, `/login`, `/register`, `/try` behaviour, or `_redirects`.

## Deviations recorded during implementation (2026-08-16)

- `/changelog/`: the `<h2>` carries no `id`. Angular's `[innerHTML]` sanitizer strips `id`; the sanitizer is not bypassed. Per-entry anchors can come later by rendering the entries in the template.
- Share cards: `render-post-banners.mjs` writes `tuliplot.com` on the 1200×630 card (the plan carried the wordmark; this spec said "no text").
- `parseChangelog` returns `markdown` per entry; `build-content.mjs` renders it. `ChangelogDoc.html` is the rendered result.
- The external-link renderer escapes `href` with `xmlEscape` and leaves `title` as `marked` 12 already escapes it. `build-content.spec.mjs` pins the exact output.
- `STATIC_PAGES` (`build-content.mjs`) holds the sitemap `lastmod` and the `llms.txt` "Pages" descriptions; the `/about` row is `2026-08-15`; the descriptions for `/contact`, `/privacy`, `/terms` equal the component meta descriptions and must be edited together.
- The six articles edited on this branch carry `updated: 2026-08-16`.
- The guide detail spec has no seoTitle test (no guide sets one).
