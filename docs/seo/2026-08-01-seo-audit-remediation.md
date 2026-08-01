# SEO Audit Remediation Roadmap — tuliplot.com

**Audit date:** 2026-08-01 (site launched 2026-07-31; zero organic footprint yet)
**Sources:** live-site crawl (all 12 routes + robots/sitemap/ads.txt), codebase inspection, SERP/competitor research (no SEO tool connected — demand/difficulty are qualitative).
**How to use this doc:** fix wave by wave, top to bottom. Each item has acceptance criteria; tick the box when verified on the live site (not just merged). Waves 1–2 are code. Waves 3–5 are content. Wave 6 is off-site/owner actions.

**Executive read:** strong technical skeleton (prerendered static, per-page meta via `SeoService`, sane robots/sitemap), but three problems: template-level technical faults (redirecting canonicals, soft 404s, no og:image/schema), critically thin content (~984 words across 5 articles — also an AdSense-approval risk), and zero keyword targeting in any title/heading. Strategy: imitate Workona's playbook (JTBD problem content + owned comparison pages), target Toby while its free-plan backlash churns users, and own the uncontested iframe-pain-point lane.

---

## Wave 1 — Technical quick wins (code, ~1 day total)

All in files we own; no behavioral risk. One PR.

- [ ] **1.1 Trailing-slash canonicals + sitemap URLs.**
  Every non-root URL 308-redirects to `/path/`, but canonicals (`seo.service.ts:13`) and the sitemap (`frontend/scripts/build-content.mjs:81-91`) emit the non-slash form — so every canonical target and sitemap entry is a redirecting URL, and every crawl takes a wasted hop.
  *Fix:* emit trailing-slash URLs in both places (root stays `https://tuliplot.com/`).
  *Accept:* `curl -sI` on 3 sampled sitemap URLs returns 200 with no redirect; rendered canonical == final URL.

- [ ] **1.2 Sitemap `<lastmod>`.**
  No lastmod on any entry. *Fix:* per-file git or frontmatter date in `build-content.mjs`; static routes get the build date.
  *Accept:* every `<url>` carries a plausible `<lastmod>`.

- [ ] **1.3 og:image + twitter:card sitewide.**
  No page has og:image or any twitter:* tag — every share on X/LinkedIn/Slack/iMessage renders blank.
  *Fix:* one branded 1200×630 card in `frontend/public/`, wired into `SeoService.set()` (og:image, og:image:width/height, twitter:card=summary_large_image, twitter:title/description).
  *Accept:* opengraph.xyz preview renders image on `/`, one guide, one post.

- [ ] **1.4 JSON-LD structured data.**
  Zero structured data sitewide. *Fix:* `Organization` + `WebSite` + `SoftwareApplication` on `/` (landing.component); `FAQPage` for the landing FAQ (`<details>` section already exists); `Article` (headline/datePublished/dateModified/author) on guide/blog detail pages via the content pipeline.
  *Accept:* Google Rich Results Test passes on `/`, one guide, one post.

- [ ] **1.5 Remove the CSS-hidden duplicate H1.**
  All 4 article pages ship two H1s — visible hero + `display:none` duplicate inside `<article>` (`.tl-article h1{display:none}`). Pre-existing backlog item.
  *Fix:* strip the leading markdown H1 in `build-content.mjs`; delete the hiding CSS.
  *Accept:* one H1 in the prerendered HTML of every article page.

- [ ] **1.6 Interlink the content.**
  Detail pages link only to their listing + `/register`; `getting-started` even says "The next guide covers adding sites…" as plain text.
  *Fix:* make that sentence a real link; add a "Related reading" block (2–3 descriptive-anchor links) to every guide/post.
  *Accept:* every article links to ≥2 other articles.

- [ ] **1.7 Keyworded titles + full-length meta descriptions on listing pages.**
  `Guides · TulipLot` (17 ch), `Blog · TulipLot` (15 ch), `About · TulipLot` (16 ch); descriptions 51–62 ch.
  *Fix:* e.g. "Browser dashboard guides — set up TulipLot · TulipLot"; descriptions ~140–160 ch ending in a CTA.
  *Accept:* all listing titles carry a topical phrase; all descriptions 130–160 ch.

- [ ] **1.8 One searchable phrase on the homepage.**
  No title/H1/H2 sitewide contains a phrase a searcher would type ("browser dashboard", "start page", "apps side by side"). Brand voice ("one calm screen") can stay — add, don't replace.
  *Fix:* work "browser dashboard" into the `<title>`/subhead (e.g. subhead: "A browser dashboard: a fixed 3×2 grid where every cell hosts a live web app…").
  *Accept:* "browser dashboard" appears in homepage title or H1/subhead, reads naturally.

## Wave 2 — Crawl correctness (code, ~half day, needs care)

- [ ] **2.1 Real 404s.**
  Any unknown URL (verified: `/this-page-does-not-exist-xyz`) returns 200 with homepage content — classic Cloudflare Pages SPA-fallback soft 404.
  *Fix:* add a prerendered `404.html`; add a `_redirects` 200-rewrite scoped to `/app*` only, so the client-side app routes (`/app`, `/app/settings`, `/app/upgrade`) keep resolving while everything else genuinely 404s.
  *Risk:* must not break the SPA fallback for `/app*` or OAuth return URLs — test `/app?checkout=success` and a hard reload of `/app/settings` on a preview deploy before promoting.
  *Accept:* unknown paths return HTTP 404 with the 404 page; `/app` + `/app/settings` hard-reload still work logged in; OAuth round-trip still lands.

## Wave 3 — Content expansion (pre-AdSense gate, ~3 days)

Everything on the site is under 300 words (145–213 per article, ~984 total). Nothing at this depth ranks, and thin content is the classic AdSense rejection. **Do this wave before submitting to AdSense** (cutover checklist step 5).

- [ ] **3.1** `guides/getting-started` → 800–1,200 words (add screenshots, per-step detail, FAQ subsection).
- [ ] **3.2** `guides/add-any-site` → 800–1,200 words (becomes the practical half of the iframe cluster — link to 4.1's explainer).
- [ ] **3.3** `guides/premium-vs-free` → 800+ words (this is the decision-stage page: comparison table, billing/cancel FAQs).
- [ ] **3.4** `blog/dashboard-productivity-tips` → 1,000+ words (real layouts with images; target "productive dashboard"/"dashboard layout").
- [ ] **3.5** `blog/why-we-built-tuliplot` → 800+ words (target "too many browser tabs" secondary phrasing — Workona proves owned content competes here).
- [ ] **3.6** Replace the empty decorative banner divs on posts with real illustrations (doubles as per-post og:image).

*Accept per item:* live page ≥800 words of substantive copy, one H1, H2s carry the target phrase naturally, ≥2 internal links in, ≥2 out.

## Wave 4 — New content: the uncontested lanes (~4 days)

Highest-leverage new pages first; each targets a SERP currently held by forums, dev docs, or nobody.

- [ ] **4.1 Iframe explainer pillar** — "Why some sites won't load in a dashboard (and how to fix it)".
  Target: "why won't a website load in an iframe", ""refused to display in a frame" fix", "X-Frame-Options" (plain-English). SERP today is 100% MDN/GitHub/vendor KBs — zero consumer content. This is also our objection-handler: SplitView already markets *against* iframe tools; this page + the Companion extension is the rebuttal. 1,500+ words, FAQPage schema, links to `add-any-site` and `/register`.
- [ ] **4.2 JTBD guide** — "How to view multiple websites at once (side by side, one tab)".
  Target: "view multiple websites at once", "open two websites side by side", "how to see two websites at the same time", "is there a website to view multiple websites at once" (Quora holds #1 — beatable). Cover all methods honestly (split screen, extensions, TulipLot), question-phrased H2s for PAA.
- [ ] **4.3 Micro how-to** — "Gmail and Google Calendar side by side". Only Google's own docs rank. 600–800 words.
- [ ] **4.4 Definitional post** — "What is a browser start page (and do you still need one)?" Quora/Wix-tier SERP; feeds the head term long-game. Fold in the iGoogle/Netvibes-shutdown migration angle (openly acknowledged gap in press).

## Wave 5 — Commercial content (~3 days)

- [ ] **5.1 "TulipLot vs Toby / Toby alternative"** — Toby's 60-tab free-plan cap is churning users *now*; Workona ranks with its own vs-Toby page, so owned head-to-head pages demonstrably work in this cluster. Honest feature/price table.
- [ ] **5.2 "TulipLot vs Workona / Workona alternative"** — Toby's own page ranks for this; the lane is proven.
- [ ] **5.3 "TulipLot vs start.me / start.me alternative"** — hardest of the three (aggregators dominate); do last.
- [ ] **5.4 "Best start pages in 2026" listicle** — small fresh blogs (pivotab, cutedesk, startpagehq) outrank all incumbents on this family; include competitors honestly, refresh quarterly (set a reminder in the doc when shipped).

## Wave 6 — Off-site + owner actions

- [ ] **6.1 Directory listings** (backlinks + presence in the exact SERPs Waves 4–5 target): AlternativeTo, Product Hunt, G2/Capterra where free, Slashdot software listing. These aggregators ARE the "alternative" SERPs. ~Half day of submissions; can start immediately, no dependencies.
- [ ] **6.2 ads.txt** — live file contains literal `pub-XXXXXXXXXXXXXXXX`. Replace at AdSense registration (owner; cutover checklist step 5). Not an SEO blocker, but non-functional until fixed.
- [ ] **6.3 Search Console + Bing Webmaster** — verify domain, submit sitemap (after 1.1/1.2 so the submitted sitemap is clean). Owner has the Cloudflare DNS access needed for TXT verification.
- [ ] **6.4 Publishing cadence** — after Waves 3–5, one substantive post or refresh per month minimum; refresh the 5.4 listicle quarterly.

---

## Reference A — Keyword targets (qualitative; no SEO tool connected)

| Keyword | Difficulty | Opportunity | Intent | Landing page (wave) |
|---|---|---|---|---|
| view multiple websites at once | Easy–Mod | High | Info/Trans | 4.2 |
| open two websites side by side | Easy | High | Info/Trans | 4.2 |
| how to see two websites at the same time | Easy | High | Info | 4.2 |
| is there a website to view multiple websites at once | Easy | High | Info/Trans | 4.2 |
| why won't a website load in an iframe | Easy–Mod | High | Info | 4.1 |
| "refused to display in a frame" fix | Easy | High | Info | 4.1 |
| best start page 2026 | Moderate | High | Commercial | 5.4 |
| gmail and calendar side by side | Easy | High | Info | 4.3 |
| Toby alternative | Moderate | Medium | Commercial | 5.1 |
| Workona alternative | Moderate | Medium | Commercial | 5.2 |
| start.me alternative | Mod–Hard | Medium | Commercial | 5.3 |
| browser dashboard | Moderate | Medium | Info/Nav | 1.8 + 4.4 |
| personal dashboard | Moderate | Medium | Info | 4.4 |
| split screen browser | Moderate | Medium | Commercial | 4.2 |
| best new tab dashboard extension | Moderate | Medium | Commercial | 5.4 |
| too many browser tabs | Hard | Medium | Info | 3.5 |
| all my apps in one place | Moderate | Medium | Commercial | homepage copy |
| what is a browser start page | Easy | Medium | Info | 4.4 |
| iGoogle / Netvibes alternative | Easy | Low–Med | Info/Comm | 4.4 |
| start page / new tab page (heads) | Hard | Low | Nav | earned indirectly |

**Avoid:** "app dashboard", "monitor multiple dashboards on one screen" — enterprise BI/TV-wall SERPs, wrong audience.

## Reference B — Competitive read

- **start.me** — category authority; owns "browser start page" #1; deepest content (blog + help center). Don't fight head-on early.
- **Workona** — the playbook to imitate: JTBD problem content ("too many tabs" ranking beside Atlassian/PCWorld) + a `/reviews/` folder of comparison pages.
- **Toby** — most vulnerable: thin content, aggregator-dependent, free-plan backlash driving "Toby alternative" growth.
- tuliplot.com — zero footprint (2 days old); every keyword above is open territory.

## Reference C — Audit facts (for future re-verification)

- Crawl date 2026-08-01: all 12 sitemap URLs 200 (after 308); soft-404 confirmed on `/this-page-does-not-exist-xyz`; robots.txt = `Allow: /`, `Disallow: /app`, sitemap declared; HTTPS clean; mobile responsive (nav hides Guides/Blog under 640px — footer still exposes them); no JSON-LD anywhere; og:image/twitter absent everywhere; titles/descriptions/canonicals present on all pages via `SeoService`; article word counts 145–213; total site copy ~984 words.
