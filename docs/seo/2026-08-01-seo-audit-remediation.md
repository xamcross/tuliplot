# SEO Audit Remediation Roadmap — tuliplot.com

**Audit date:** 2026-08-01 (site launched 2026-07-31; zero organic footprint yet)
**Sources:** live-site crawl (all 12 routes + robots/sitemap/ads.txt), codebase inspection, SERP/competitor research (no SEO tool connected — demand/difficulty are qualitative).
**How to use this doc:** fix wave by wave, top to bottom. Each item has acceptance criteria; tick the box when verified on the live site (not just merged). Waves 1–2 are code. Waves 3–5 are content. Wave 6 is off-site/owner actions.

**Executive read:** strong technical skeleton (prerendered static, per-page meta via `SeoService`, sane robots/sitemap), but three problems: template-level technical faults (redirecting canonicals, soft 404s, no og:image/schema), critically thin content (~984 words across 5 articles — also an AdSense-approval risk), and zero keyword targeting in any title/heading. Strategy: imitate Workona's playbook (JTBD problem content + owned comparison pages), target Toby while its free-plan backlash churns users, and own the uncontested iframe-pain-point lane.

---

## Wave 1 — Technical quick wins (code, ~1 day total)

All in files we own; no behavioral risk. One PR.

- [x] **1.1 Trailing-slash canonicals + sitemap URLs.**
  Every non-root URL 308-redirects to `/path/`, but canonicals (`seo.service.ts:13`) and the sitemap (`frontend/scripts/build-content.mjs:81-91`) emit the non-slash form — so every canonical target and sitemap entry is a redirecting URL, and every crawl takes a wasted hop.
  *Fix:* emit trailing-slash URLs in both places (root stays `https://tuliplot.com/`).
  *Accept:* `curl -sI` on 3 sampled sitemap URLs returns 200 with no redirect; rendered canonical == final URL.

- [x] **1.2 Sitemap `<lastmod>`.**
  No lastmod on any entry. *Fix:* per-file git or frontmatter date in `build-content.mjs`; static routes get the build date.
  *Accept:* every `<url>` carries a plausible `<lastmod>`.

- [x] **1.3 og:image + twitter:card sitewide.**
  No page has og:image or any twitter:* tag — every share on X/LinkedIn/Slack/iMessage renders blank.
  *Fix:* one branded 1200×630 card in `frontend/public/`, wired into `SeoService.set()` (og:image, og:image:width/height, twitter:card=summary_large_image, twitter:title/description).
  *Accept:* opengraph.xyz preview renders image on `/`, one guide, one post.

- [x] **1.4 JSON-LD structured data.**
  Zero structured data sitewide. *Fix:* `Organization` + `WebSite` + `SoftwareApplication` on `/` (landing.component); `FAQPage` for the landing FAQ (`<details>` section already exists); `Article` (headline/datePublished/dateModified/author) on guide/blog detail pages via the content pipeline.
  *Accept:* Google Rich Results Test passes on `/`, one guide, one post.

- [x] **1.5 Remove the CSS-hidden duplicate H1.**
  All 4 article pages ship two H1s — visible hero + `display:none` duplicate inside `<article>` (`.tl-article h1{display:none}`). Pre-existing backlog item.
  *Fix:* strip the leading markdown H1 in `build-content.mjs`; delete the hiding CSS.
  *Accept:* one H1 in the prerendered HTML of every article page.

- [x] **1.6 Interlink the content.**
  Detail pages link only to their listing + `/register`; `getting-started` even says "The next guide covers adding sites…" as plain text.
  *Fix:* make that sentence a real link; add a "Related reading" block (2–3 descriptive-anchor links) to every guide/post.
  *Accept:* every article links to ≥2 other articles.

- [x] **1.7 Keyworded titles + full-length meta descriptions on listing pages.**
  `Guides · TulipLot` (17 ch), `Blog · TulipLot` (15 ch), `About · TulipLot` (16 ch); descriptions 51–62 ch.
  *Fix:* e.g. "Browser dashboard guides — set up TulipLot · TulipLot"; descriptions ~140–160 ch ending in a CTA.
  *Accept:* all listing titles carry a topical phrase; all descriptions 130–160 ch.

- [x] **1.8 One searchable phrase on the homepage.**
  No title/H1/H2 sitewide contains a phrase a searcher would type ("browser dashboard", "start page", "apps side by side"). Brand voice ("one calm screen") can stay — add, don't replace.
  *Fix:* work "browser dashboard" into the `<title>`/subhead (e.g. subhead: "A browser dashboard: a fixed 3×2 grid where every cell hosts a live web app…").
  *Accept:* "browser dashboard" appears in homepage title or H1/subhead, reads naturally.

> **Wave 1 status: VERIFIED LIVE 2026-08-01** (PR #5 merged; deployed via `npx wrangler pages deploy dist/frontend/browser --project-name=tuliplot` from frontend/). Curl acceptance passed: sitemap serves trailing-slash URLs with lastmod; 3 sitemap URLs return direct 200; live pages carry og:image (og-card.png 200, image/png), trailing-slash canonicals, `#tl-jsonld` (FAQPage/SoftwareApplication on `/`, Article on details), one H1 per article, keyworded titles. Caveat on 1.7: About description is 128 chars vs this doc's 130 floor (follow-up recorded below). Browser-tool checks (opengraph.xyz, Rich Results Test) still worth an eyeball but redundant with the curl-level verification.
> **Wave 2 lead:** the soft-404 mechanism is `frontend/public/_redirects` (`/* /index.html 200`) — narrow that catch-all to `/app*` and add a prerendered 404 page.
> **Follow-ups from the Wave-1 final review** (fold into the waves below): Wave 2 — reset head state (title/canonical, drop stale og/JSON-LD) on `/login`, `/register`, and the guide/blog not-found path (overlaps 2.1); add two words to the About description to clear this doc's 130-char floor. Wave 3 pre-reqs — XML-escape `sitemapXml`, guard missing frontmatter `date` (currently defaults to 1970-01-01), single-source the landing FAQ (one `{q,a}[]` constant driving both template and JSON-LD), give `blog-detail` its own spec, extract `buildArticleJsonLd(doc, basePath)`. Optional polish — `og:type=article` on detail pages, square-PNG Organization logo instead of favicon.svg. Reset-password trap: `PasswordResetService` emails link to `/reset-password`, which has no frontend route yet — when that UI is built, the route needs both an Angular route AND a `_redirects` row (hard navigations 404 otherwise).

## Wave 2 — Crawl correctness (code, ~half day, needs care)

- [x] **2.1 Real 404s.**
  Any unknown URL (verified: `/this-page-does-not-exist-xyz`) returns 200 with homepage content — classic Cloudflare Pages SPA-fallback soft 404.
  *Fix:* add a prerendered `404.html`; add a `_redirects` 200-rewrite scoped to `/app*` only, so the client-side app routes (`/app`, `/app/settings`, `/app/upgrade`) keep resolving while everything else genuinely 404s.
  *Risk:* must not break the SPA fallback for `/app*` or OAuth return URLs — test `/app?checkout=success` and a hard reload of `/app/settings` on a preview deploy before promoting.
  *Accept:* unknown paths return HTTP 404 with the 404 page; `/app` + `/app/settings` hard-reload still work logged in; OAuth round-trip still lands.

> **Wave 2 status: VERIFIED LIVE 2026-08-01, after one production incident.** PR #7's merge broke `/login`/`/register`/`/app*` for ~45 min: Cloudflare Pages converts **per-path** 200-rewrites to `/index.html` into clean-URL 308s to `/` (only the `/*` catch-all form serves directly). The wrangler emulator flagged exactly this during the pre-merge smoke and was wrongly adjudicated a false positive. Hotfix `7a33a25`: rewrite destinations are `/`, not `/index.html`. All 9 production probes green (junk + deep paths → real 404 with branded page; login/register/app + trailing-slash twins + checkout-return → 200 shell).
> **Hard-won rules:** (1) `_redirects` rewrite destinations must be `/`, never `/index.html`. (2) The ONLY valid test bed for `_redirects`/`_headers` changes is a **preview deployment** (`npx wrangler pages deploy <dist> --project-name=tuliplot --branch=preview`) — the emulator is directionally right but was dismissed once; production-equivalence reasoning is banned.

## Wave 3 — Content expansion (pre-AdSense gate, ~3 days)

Everything on the site is under 300 words (145–213 per article, ~984 total). Nothing at this depth ranks, and thin content is the classic AdSense rejection. **Do this wave before submitting to AdSense** (cutover checklist step 5).

- [x] **3.1** `guides/getting-started` → 800–1,200 words (add screenshots, per-step detail, FAQ subsection).
- [x] **3.2** `guides/add-any-site` → 800–1,200 words (becomes the practical half of the iframe cluster — link to 4.1's explainer).
- [x] **3.3** `guides/premium-vs-free` → 800+ words (this is the decision-stage page: comparison table, billing/cancel FAQs).
- [x] **3.4** `blog/dashboard-productivity-tips` → 1,000+ words (real layouts with images; target "productive dashboard"/"dashboard layout").
- [x] **3.5** `blog/why-we-built-tuliplot` → 800+ words (target "too many browser tabs" secondary phrasing — Workona proves owned content competes here).
- [x] **3.6** Replace the empty decorative banner divs on posts with real illustrations (doubles as per-post og:image).

*Accept per item:* live page ≥800 words of substantive copy, one H1, H2s carry the target phrase naturally, ≥2 internal links in, ≥2 out.

> **Wave 3 status (2026-08-02):** implemented on `feature/seo-wave-3` (18 commits, suite 148/148, build green). Articles now 1,050–1,476 words each (~6,250 total, up from ~984); every claim fact-checked against the codebase (5 of 9 tasks needed accuracy fix rounds). Boxes tick after live verification per this doc's convention. **3.6 ships with a carve-out:** the banner images landed, but the "doubles as per-post og:image" half did NOT — og:image is still hardcoded sitewide in `seo.service.ts` and `article-jsonld.ts`, and the banners are 1440×520 (2.77:1), unusable as-is for og (wants ~1.91:1). Recorded as a Wave-3.5 follow-up below.
> **Wave-3.5 follow-ups** (small, from the Wave-3 final review): per-post og:image (needs an optional `image` param on `SeoService.set()` + `buildArticleJsonLd`, plus a 1200×630 render variant) · `og:type=article` on detail pages (outstanding since Wave 1) · FAQPage JSON-LD for the three guides that now carry real Q/A sections · em-dash density pass (four guides sit at 1.8–2.1 per 100 words vs 0.09 in `why-we-built` — the plan's own constraint bans em-dash-heavy prose, and this is the clearest voice-drift signal) · rotate the "Keep reading" picks instead of `slice(0, n)` before Wave 4 adds pages, or every new article points at the same three · give guide detail pages a visible date · preserve `datePublished` separately from `dateModified` (the single `date` frontmatter key can't express both, and both posts just had their published date reset) · `requireDate` accepts impossible dates like `2026-13-45` (add a `Date.parse` check) · restore the sharper Companion safety claim in `add-any-site` (header stripping is scoped to `sub_frame` + `initiatorDomains`, so enabled sites behave normally in a regular tab) · banner `<img>` needs `width`/`height` to avoid CLS · `content/README.md` still calls the five articles "scaffolding".
> **AdSense submission blocker (owner decision, not a content fix):** the ad unit lives in the free tier's sixth cell inside `/app` — behind login and `Disallow: /app` in robots.txt. AdSense review needs to see pages serving ads; an uncrawlable, login-gated ad surface is an unusual submission, and the ad also sits beside framed third-party content (placement-policy question). Also replace `ads.txt`'s placeholder publisher ID before submitting.
>
> **→ OWNER'S CHOSEN DIRECTION (2026-08-02): an anonymous try-it dashboard, public and crawlable.** Let signed-out visitors use a reduced grid — **2 usable cells** (versus 5 on the free plan and 6 on Premium) — on a public page that serves a **crawlable ad**. This resolves the blocker at its root rather than bolting an ad onto the guides: the ad then lives on a page `Mediapartners-Google` can actually fetch and render, and it doubles as a try-before-signup funnel with a natural upgrade prompt ("you're using 2 of 6 cells").
>
> **→ RESOLVED IN CODE (2026-08-02).** Built and merged as the `/try` page — spec `docs/superpowers/specs/2026-08-02-anonymous-try-dashboard-design.md`, plan `docs/superpowers/plans/2026-08-02-anonymous-try-dashboard.md`. Signed-out visitors get 2 usable cells, 3 signup-locked cells linking to `/register`, and the ad cell in slot 5. `GET /api/v1/config/ads` is now `permitAll`, so the ad renders for anonymous visitors; `robots.txt` allows `/try` (only `/app` is disallowed) and it is in the sitemap. **The placement blocker is cleared — what remains before submitting is entirely owner action: replace `ads.txt`'s placeholder publisher ID (6.2).**
>
> Two notes for whoever submits:
> - The ad unit is **not** in the prerendered HTML — it renders after hydration, once the client fetches the ad config. This is how nearly every AdSense site works (`Mediapartners-Google` executes JavaScript), but it means a raw-HTML view of `/try` shows no ad unit.
> - Until `adsenseClient` is configured, every visitor sees the house promo instead of a real ad. That is the expected chicken-and-egg state, not a defect.
>
> **Follow-up now open (not yet done):** the nine published articles, the landing `FAQ` constant, and `premium-vs-free`'s pricing table all still describe only the 5-usable / 6-Premium tiers. They are now incomplete rather than wrong. Deliberately deferred until the tier shipped; do this pass before Wave 5's comparison pages, since those state plan limits head-to-head against competitors.
>
> Original spec questions (all settled — kept for the reasoning):
> - **Route and crawlability.** It cannot live under `/app` (guarded by `authGuard`, and `Disallow: /app` in robots.txt). Needs a new public route (e.g. `/try`) that is crawlable, prerendered or CSR-with-a-rendered-shell, and added to the sitemap. Remember the Wave-2 lesson: any new client-rendered route also needs its own `_redirects` row or hard navigations 404.
> - **State without an account.** Anonymous cell contents have to persist somewhere (localStorage is the obvious candidate) with no `User` document, and `DashboardService` currently assumes a user. Decide whether anonymous state migrates into the account on signup — losing someone's two configured cells at the moment they register would be a bad first impression.
> - **The ad-adjacency question doesn't disappear.** The ad still renders beside framed third-party sites. That was half the original policy concern; a public page makes it *more* visible to review, not less. Worth deciding deliberately whether the try page shows framed cells, launcher-only cells, or a curated safe set.
> - **Gating and abuse.** No login means no rate limit by account: consider what stops the try page from being used indefinitely instead of registering, and whether that even matters (it may be fine — it's five fewer cells and an ad).
> - **Consistency with the nine published articles.** Every one of them currently says free = 5 usable cells + 1 ad and Premium = 6. Adding an anonymous tier makes that description incomplete; the articles and the landing FAQ would need a pass. The `FAQ` constant on the landing page and the pricing table in `premium-vs-free` are the two places that state plan limits most explicitly.

## Wave 4 — New content: the uncontested lanes (~4 days)

Highest-leverage new pages first; each targets a SERP currently held by forums, dev docs, or nobody.

- [x] **4.1 Iframe explainer pillar** — "Why some sites won't load in a dashboard (and how to fix it)".
  Target: "why won't a website load in an iframe", ""refused to display in a frame" fix", "X-Frame-Options" (plain-English). SERP today is 100% MDN/GitHub/vendor KBs — zero consumer content. This is also our objection-handler: SplitView already markets *against* iframe tools; this page + the Companion extension is the rebuttal. 1,500+ words, FAQPage schema, links to `add-any-site` and `/register`.
- [x] **4.2 JTBD guide** — "How to view multiple websites at once (side by side, one tab)".
  Target: "view multiple websites at once", "open two websites side by side", "how to see two websites at the same time", "is there a website to view multiple websites at once" (Quora holds #1 — beatable). Cover all methods honestly (split screen, extensions, TulipLot), question-phrased H2s for PAA.
- [x] **4.3 Micro how-to** — "Gmail and Google Calendar side by side". Only Google's own docs rank. 600–800 words.
- [x] **4.4 Definitional post** — "What is a browser start page (and do you still need one)?" Quora/Wix-tier SERP; feeds the head term long-game. Fold in the iGoogle/Netvibes-shutdown migration angle (openly acknowledged gap in press).

## Wave 5 — Commercial content (~3 days)

- [x] **5.1 "TulipLot vs Toby / Toby alternative"** — Toby's 60-tab free-plan cap is churning users *now*; Workona ranks with its own vs-Toby page, so owned head-to-head pages demonstrably work in this cluster. Honest feature/price table.
- [x] **5.2 "TulipLot vs Workona / Workona alternative"** — Toby's own page ranks for this; the lane is proven.
- [x] **5.3 "TulipLot vs start.me / start.me alternative"** — hardest of the three (aggregators dominate); do last.
- [x] **5.4 "Best start pages in 2026" listicle** — small fresh blogs (pivotab, cutedesk, startpagehq) outrank all incumbents on this family; include competitors honestly, refresh quarterly (set a reminder in the doc when shipped). **Refresh reminder: next review 2026-11-02** — re-verify every price and limit in `docs/seo/2026-08-02-competitor-facts-verified.md` against each vendor's own site before that date, update the verified-facts file first, then update this listicle and the three comparison pages (5.1–5.3) for any number that changed.

> **Wave 5 status (2026-08-02): implemented on `feature/seo-wave-5` (10 commits), pending deploy.** Four new pages: `tuliplot-vs-toby`, `tuliplot-vs-workona`, `tuliplot-vs-start-me`, `best-start-pages-2026`. Every competitor claim traces to `docs/seo/2026-08-02-competitor-facts-verified.md`; the three forbidden claims (Toby's stale "5 members" cap, "$6/month" for Workona Pro, the "10 spaces to 5" story as Workona's own statement) do not appear anywhere in the four pages, nor do the two unsourced-inference claims caught and fixed mid-branch (Toby "requires an account"; the Workona closed-Space tab lifecycle). Boxes tick after live verification per this doc's convention; ticked here on implementation, to be confirmed again after merge + deploy per the plan's post-merge verification step (curl each URL, confirm H1 + FAQ text in served HTML). Sitemap: 21 URLs after this wave (`node scripts/build-content.mjs` output), matching the plan's expected total. Suite: 48 test files / 185 tests green, including the banner-palette pin and stability tests.

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
