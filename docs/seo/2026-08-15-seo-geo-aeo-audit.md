# SEO + GEO + AEO audit — tuliplot.com

**Audit date:** 2026-08-15 (site live since 2026-07-31; 15 days).
**Scope:** SEO (search engines), GEO (generative engines: ChatGPT, Perplexity, Gemini, Claude), AEO (answer engines: featured snippets, AI Overviews, People Also Ask).
**Method:** live crawl of all 21 sitemap URLs (HTML saved and parsed), header and redirect probes, 14 crawler user-agent probes, asset weight measurement, `site:` checks on Google, Bing, and DuckDuckGo, SERP samples for the target keywords, competitor probes for `llms.txt` and AI robots rules, and a code inspection of `SeoService`, `article-jsonld.ts`, `landing.component.ts`, and `build-content.mjs`.
**Not available:** no SEO tool is connected, so volume and difficulty stay qualitative. PageSpeed Insights refused the anonymous quota, so Core Web Vitals are not measured here.
**Previous audit:** `docs/seo/2026-08-01-seo-audit-remediation.md`. Waves 1–5 of that plan are live. Wave 6 (off-site, owner actions) is open. This document does not repeat closed items.

---

## 1. Executive summary

The technical foundation is strong. Every public page is prerendered HTML. The home page ships about 24 KB of compressed JS and CSS. TTFB is about 170 ms from Europe. Redirects, canonicals, the sitemap, robots.txt, and the 404 page are all correct. Twelve pages carry JSON-LD, eleven of them carry `FAQPage`. The 13 articles run 771–2,099 words each.

One problem blocks everything else: **zero pages are indexed on Google and Bing** 15 days after launch. `site:tuliplot.com` returns no result on Google, Bing, or DuckDuckGo. A search for "tuliplot browser dashboard" returns Tulip (tulip.co) results. The cause is not the site. The cause is that nobody told the engines the site exists: Search Console and Bing Webmaster (roadmap 6.3) are not set up, no directory lists the product (6.1), and no external page links to the domain.

GEO status: AI crawlers can fetch the site (14 user agents tested, all `200`). But the site gives generative engines nothing to corroborate: no `llms.txt`, no `sameAs` on the Organization, no third-party listing, no Chrome Web Store page, and a brand name that collides with "Tulip". A generative engine cites what it can verify. Today it can verify nothing about TulipLot.

AEO status: the content structure is good. Question headings, answer-first openings, comparison tables, and FAQ sections exist. The gaps are small: `dateModified` always equals `datePublished`, the author is an Organization and not a person, and 10 of 13 articles cite no external source.

**Top three priorities:**
1. Get indexed: verify Google Search Console and Bing Webmaster, submit the sitemap, request indexing for all 21 URLs, and turn on Cloudflare Crawler Hints (IndexNow). One to two hours. Owner action.
2. Get corroborated: publish the directory listings from the Wave 6 kit, upload Companion 1.2.0 to the Chrome Web Store, and make the GitHub README link to the site. Half a day. Owner action.
3. Ship one code PR that hardens the entity and answer signals: Organization `sameAs` and PNG logo, `og:type=article` and `dateModified`, per-post `og:image`, `llms.txt`, a robots Content-Signal line, footer links, title and description trims, and outbound citations. About half a day.

**Overall assessment: strong foundation, needs work — and the work is mostly off-site.**

---

## 2. Indexation and discovery (critical)

| Check | Result | Evidence |
|---|---|---|
| Google index | **0 pages** | `site:tuliplot.com` returns unrelated Tulip results |
| Bing index | **0 pages** | Bing answers "There are no results" |
| DuckDuckGo index | **0 pages** | no organic result |
| Google Search Console | not verified | roadmap 6.3 open |
| Bing Webmaster Tools | not verified | roadmap 6.3 open |
| IndexNow / Cloudflare Crawler Hints | unknown, probably off | no owner record; a free Cloudflare toggle |
| Known backlinks | 0 | no directory listing, no CWS listing, no forum mention found |
| Brand SERP | collision | "tuliplot browser dashboard" → tulip.co (manufacturing dashboards) |

Why this matters: a new domain with zero inbound links can wait weeks for a discovery crawl. Search Console submission plus "Request indexing" moves that to days. Bing accepts an import from Search Console. Crawler Hints pings IndexNow (Bing, Yandex, Naver, Seznam) on every deploy at no cost.

---

## 3. Keyword opportunity table

Ranking column: every page is **not indexed** today, so "current ranking" is "none" for all rows. Difficulty and opportunity are qualitative (no SEO tool connected). Rows sort by opportunity.

| Keyword | Est. difficulty | Opportunity | Current ranking | Intent | Page / recommended content |
|---|---|---|---|---|---|
| view multiple websites at once | Easy–Mod | High | none | Info/Trans | `/blog/view-multiple-websites-at-once/` (live) |
| open two websites side by side | Easy | High | none | Info | same page |
| is there a website to view multiple websites at once | Easy | High | none | Info/Trans | same page (Quora holds #1 — beatable) |
| why won't a website load in an iframe | Easy–Mod | High | none | Info | `/guides/why-sites-wont-load/` (live) |
| refused to connect iframe fix | Easy | High | none | Info | same guide + add MDN citations |
| x-frame-options plain english | Easy | High | none | Info | same guide; short definitional block for a snippet |
| chrome extension to embed sites that block iframes | Easy | High | none | Comm | **new** `/companion/` landing page |
| best start page 2026 | Moderate | High | none | Comm | `/blog/best-start-pages-2026/` (live; refresh 2026-11-02) |
| gmail and google calendar side by side | Easy | High | none | Info | `/blog/gmail-and-calendar-side-by-side/` (live) |
| browser dashboard | Moderate | Medium–High | none | Info/Nav | home (live) |
| personal dashboard for web apps | Moderate | Medium | none | Info/Comm | home + about |
| toby alternative | Moderate | Medium | none | Comm | `/blog/tuliplot-vs-toby/` (live) |
| workona alternative | Moderate | Medium | none | Comm | `/blog/tuliplot-vs-workona/` (live) |
| start.me alternative | Mod–Hard | Medium | none | Comm | `/blog/tuliplot-vs-start-me/` (live) |
| toby free plan limit 60 tabs | Easy | Medium | none | Info | vs-Toby FAQ (live; quotable fact) |
| does trello / notion / youtube work in an iframe | Easy | Medium | none | Info | **new** per-app embed pages from `docs/compatibility-matrix.md` |
| igoogle alternative 2026 / netvibes alternative | Easy | Medium | none | Info/Comm | **new** dedicated post (today folded into the start-page post) |
| split screen browser extension | Moderate | Medium | none | Comm | **new** listicle; the JTBD SERP is extension listicles |
| what is a browser start page | Easy | Medium | none | Info | `/blog/what-is-a-browser-start-page/` (live) |
| try a browser dashboard without an account | Easy | Low–Med | none | Trans | `/try/` (live; add 2–3 sentences of copy) |
| pivotab alternative | Easy | Low–Med | none | Comm | **new** comparison (Pivotab ranks for "best start page") |
| too many browser tabs | Hard | Low–Med | none | Info | `/blog/why-we-built-tuliplot/` (live) |

Avoid (unchanged from the previous audit): "app dashboard", "monitor multiple dashboards on one screen" — enterprise BI intent.

---

## 4. On-page issues

| Page | Issue | Severity | Recommended fix |
|---|---|---|---|
| all 21 pages | not indexed in Google or Bing | **Critical** | Section 2 actions; nothing on-page causes this |
| home | Organization JSON-LD: `logo` is `favicon.svg`, no `sameAs`, no `description`; SoftwareApplication has no `url`, no `image`, only the free `Offer` | High (GEO) | add `logo` PNG ≥ 512×512, `sameAs[]` (GitHub, CWS, Product Hunt, AlternativeTo), one canonical `description`, `Offer` for Premium $4/month |
| 13 articles | Article JSON-LD `dateModified` always equals `datePublished`; `author` is an Organization; `image` and `publisher.logo` point at the 1200×630 og card | Medium | add optional `updated:` frontmatter → `dateModified`; `publisher.logo` → square logo PNG; `Person` author when the owner decides on a public name |
| 10 of 13 articles | zero outbound links to sources (`why-sites-wont-load` explains X-Frame-Options and CSP with no MDN link) | Medium (GEO) | 2–3 authoritative citations per article: MDN, vendor docs, vendor pricing pages |
| about | 179 words; no founder, no location, no founding year; one canonical product sentence missing | Medium (E-E-A-T) | expand to 400+ words: who, where, since when, the one-sentence definition, links to GitHub and CWS |
| footer (all pages) | links only Home/About/Contact/Privacy/Terms; header hides Guides and Blog under 640 px; `/try` appears only in the hero | Medium | add Guides, Blog, Try to the footer |
| 4 posts | `<title>` > 60 chars: what-is-a-browser-start-page (68), tuliplot-vs-toby (66), tuliplot-vs-start-me (66), tuliplot-vs-workona (62) | Low | shorten the page part to ≤ 49 chars (the ` · TulipLot` suffix adds 11) |
| 5 posts | meta description > 160 chars (172–187): gmail-and-calendar, vs-start-me, vs-toby, vs-workona, view-multiple | Low | trim to 150–160 with the CTA intact |
| privacy (67), terms (43), contact (84) | meta description too short | Low | write 130–155 char descriptions |
| 13 articles | `og:type=website`; no `article:published_time`, `article:modified_time` | Low | `og:type=article` on detail pages + the two `article:*` tags |
| 13 articles | sitewide `og:image` (og-card.png); per-post banners exist (1440×520) but are not used | Low–Med | render a 1200×630 variant per post in `render-post-banners.mjs`; pass `image` through `SeoService.set()` (Wave 3.5 follow-up) |
| 9 posts | banner `<img alt="">` | Low | acceptable for decorative art; optional descriptive alt for image search |
| 4 guides | no visible published or updated date | Low | show the date under the H1 as `<time datetime>` (posts already show it as text) |
| all pages | no `BreadcrumbList` JSON-LD | Low | emit Home › Guides › Title on detail pages |
| `/try` | 57 words prerendered; no H2 | Low | add a two-sentence explanation and a link to `getting-started` |
| sitemap | static routes carry `lastmod 2026-08-01`; home copy changed 2026-08-02 | Low | bump `STATIC_LASTMOD` or derive from git |

---

## 5. Technical SEO checklist

| Check | Status | Details |
|---|---|---|
| HTTPS, `http→https` | Pass | 301 |
| `www` → apex | Pass | 301 |
| Trailing-slash canonical == final URL | Pass | 308 to `/path/`; canonical matches |
| robots.txt | Pass | `Allow: /`, `Disallow: /app`, sitemap declared |
| Sitemap | Pass | 21 URLs, all `200`, `lastmod` present |
| Real 404 | Pass | `/nope-xyz` → 404; `/404` carries `X-Robots-Tag: noindex` |
| Title / description / canonical on every page | Pass | via `SeoService` |
| og:image + twitter:card sitewide | Pass | one card sitewide (see per-post note above) |
| JSON-LD | Pass with warnings | 12/21 pages; see Section 4 |
| Page weight | Pass | home: 39 KB HTML, ~24 KB compressed JS+CSS; critical CSS inlined |
| TTFB | Pass | ~170 ms (Vienna PoP) |
| Fonts | Pass | self-hosted, subset, `font-display: swap`; no `preload` for the H1 face (minor LCP win available) |
| Images | Pass | banners carry `width`/`height`; 23 KB PNG |
| Mobile viewport, `lang="en"` | Pass | |
| Core Web Vitals | Not measured | PSI anonymous quota exhausted; re-run in Search Console once verified |
| AI crawler access (UA probe) | Pass | GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, ChatGPT-User, Google-Extended, CCBot, Applebot, Amazonbot, meta-externalagent, Bytespider, DuckAssistBot, bingbot, Googlebot → all `200` |
| Cloudflare "Block AI bots" toggle | **Verify** | the UA probe cannot prove this; Cloudflare's rule keys on verified-bot IPs. Confirm the toggle is off in Security → Bots |
| `llms.txt` | Fail | 404 |
| robots Content-Signal | Absent | Pivotab already serves `search=yes, ai-train=no, use=reference` through Cloudflare's managed robots |
| Search Console / Bing WMT | Fail | not verified |
| IndexNow / Crawler Hints | Unknown | free Cloudflare toggle; recommend on |
| ads.txt | Pass | real publisher id present |
| Backlinks | Fail | none known |

---

## 6. GEO audit (generative engines)

A generative engine cites a source when three things hold: it can fetch the page, it can understand what the entity is, and it can corroborate the entity somewhere else. TulipLot passes the first and fails the other two.

| Signal | Status | Finding | Fix |
|---|---|---|---|
| Crawler access | Pass | 14 user agents get `200` | keep; verify the Cloudflare toggle |
| Machine-readable summary | Fail | no `/llms.txt`; no competitor has one either | add `llms.txt` (curated) and `llms-full.txt` (built from the markdown by `build-content.mjs`) |
| Entity definition | Partial | home, about, and JSON-LD each describe the product with different words | one canonical sentence, used verbatim on home, about, JSON-LD, `llms.txt`, README, and every directory listing |
| Entity disambiguation | Fail | "tuliplot" search returns Tulip / tulip.co | `sameAs` links, directory listings, and the sentence "TulipLot is not related to Tulip Interfaces" on the about page |
| Corroboration | Fail | zero third-party pages mention the product | Wave 6.1 directories; CWS listing; GitHub README; 3–5 honest forum answers |
| Citations in content | Fail | 10/13 articles link to no source | 2–3 outbound citations per article |
| Freshness | Partial | `dateModified == datePublished`; nothing published since 2026-08-02 | `updated:` frontmatter; a `/changelog/` page; monthly cadence (6.4) |
| Author identity | Fail | Organization only | `Person` author + author box, when the owner chooses a public name |
| Quotable facts | Pass | comparison pages state verified numbers (Toby 60 tabs, Workona 5 spaces, start.me 3 pages) | keep `competitor-facts-verified.md` current; next re-verify 2026-11-02 |
| Content-Signal policy | Absent | no statement | add `Content-Signal: search=yes, ai-input=yes, ai-train=yes` (owner decides `ai-train`) |

---

## 7. AEO audit (answer engines)

| Signal | Status | Finding |
|---|---|---|
| Question-form H2/H3 | Pass | JTBD, explainer, and comparison pages use them |
| Answer-first opening | Pass | e.g. "Yes, in more than one way…", "Toby saves tabs. TulipLot renders sites live." |
| `FAQPage` JSON-LD | Pass | 11 pages; built from question-style H3s by `extractFaq` |
| Comparison tables | Pass | "At a glance" tables on the vs-pages and premium-vs-free |
| Definitional snippet block | Partial | `what-is-a-browser-start-page` defines the term; `why-sites-wont-load` lacks a one-paragraph plain-English definition of X-Frame-Options near the top |
| Key-facts box | Missing | comparison pages have no 3–4 bullet fact box under the H1 (price, free limit, category) — the block an AI Overview lifts |
| Visible dates | Partial | posts show an ISO date as text, not `<time>`; guides show none |
| Note | — | Google limits FAQ rich results to authoritative sites since 2023; `FAQPage` still feeds Bing, AI Overviews, and LLM retrieval |

---

## 8. Content gap recommendations

| Topic | Why it matters | Format | Priority | Effort |
|---|---|---|---|---|
| `/companion/` — TulipLot Companion landing page | the extension has no page on tuliplot.com; needed for the CWS link, `sameAs`, and "extension to embed sites that block iframes" queries | landing page + FAQ | High | half day |
| Per-app embed pages ("Does Trello / Notion / YouTube / Slack work in a dashboard?") | long-tail question queries with zero competition; every answer must come from `docs/compatibility-matrix.md` | 6–8 short pages, one template | High | multi-day |
| `/changelog/` | freshness signal for search and LLMs; dated facts to cite | dated list | High | 1–2 hours + upkeep |
| iGoogle / Netvibes / Protopage alternative | today folded into the start-page post; deserves its own URL | blog post | Medium | half day |
| Best split-screen browser extensions | the "view multiple websites" SERP is extension listicles; own one honestly | listicle | Medium | half day |
| TulipLot vs Pivotab; vs Vivaldi tab tiling / Arc split view | the small fresh blogs (Pivotab, StartPageHQ, CuteDesk) rank for "best start page" | comparison posts | Medium | half day each |
| Use-case layouts (support desk, trader, student) | commercial-intent long tail; reuse `dashboard-productivity-tips` | 2 posts | Low–Med | half day each |
| Refresh `best-start-pages-2026` | quarterly per the plan | update | scheduled | 2026-11-02 |

---

## 9. Competitor comparison summary

Qualitative. "n/c" = not checked in this audit.

| Dimension | TulipLot | start.me | Workona | Toby | Pivotab | Winner |
|---|---|---|---|---|---|---|
| Indexed in Google | 0 pages | yes, category #1 | yes | yes | yes | competitors |
| Content depth | 13 articles, ~19k words | blog + help centre | help + JTBD blog | thin | fresh listicle blog | start.me |
| Publishing frequency | 0 since 2026-08-02 | monthly changelog | n/c | n/c | active | start.me |
| Backlinks | 0 known | established | established | established | growing | competitors |
| Technical (weight, prerender, TTFB) | strong | n/c | JS-rendered pricing | n/c | n/c | TulipLot |
| `FAQPage` / Article schema | yes | n/c | n/c | n/c | n/c | TulipLot |
| `llms.txt` | no | no | no | no | no | nobody (first-mover open) |
| AI robots policy | none | none | none | none | Content-Signal via Cloudflare | Pivotab |

---

## 10. Prioritized action plan

### Quick wins (this week)

Owner actions, no code:

1. **Google Search Console** — verify `tuliplot.com` (DNS TXT at Cloudflare), submit `sitemap.xml`, then URL-inspect and "Request indexing" for all 21 URLs. Impact: high. Effort: 1–2 h. Dependency: none.
2. **Bing Webmaster Tools** — import from Search Console, or verify by DNS; submit the sitemap. Impact: high. Effort: 20 min. Dependency: step 1 for the import path.
3. **Cloudflare** — Caching → Configuration → **Crawler Hints: on** (IndexNow). Security → Bots → confirm **Block AI bots is off**. Impact: medium–high. Effort: 10 min.
4. **Directory listings** — AlternativeTo, Product Hunt, SaaSHub, Slant, G2/Capterra with the paste-ready copy in `docs/seo/2026-08-03-wave-6-offsite-kit.md`. Impact: high (backlinks + LLM corroboration). Effort: half day.
5. **GitHub README** — first line = the canonical product sentence + a link to `https://tuliplot.com`. Impact: medium (crawlable link from a high-authority domain). Effort: 10 min.
6. **Chrome Web Store** — upload Companion 1.2.0 (already on the owner list). Impact: medium (entity anchor + link). Dependency: sanity test on real Chrome.

Code, one PR (about half a day):

7. `frontend/public/llms.txt` — curated: the canonical sentence, tiers, the 21 URLs with one-line summaries, contact. Optional `llms-full.txt` emitted by `build-content.mjs`.
8. `robots.txt` — explicit `Allow: /` blocks for GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended, plus `Content-Signal: search=yes, ai-input=yes, ai-train=yes`.
9. `landing.component.ts` JSON-LD — Organization: `logo` PNG (`/logo-512.png`, new asset), `description`, `sameAs[]`, `contactPoint` → `/contact/`; SoftwareApplication: `url`, `image`, `offers[]` free + Premium `4 USD/month`; WebSite: `publisher`.
10. `article-jsonld.ts` + `build-content.mjs` — optional `updated:` frontmatter → `dateModified` (falls back to `date`); `publisher.logo` → the PNG; `og:type=article` + `article:published_time/modified_time` via a new optional `article` param on `SeoService.set()`; per-post `og:image` from a 1200×630 banner variant.
11. `site-footer.component.ts` — add Guides, Blog, Try.
12. Titles and descriptions — trim the 4 long titles, the 5 long descriptions; write real descriptions for privacy, terms, contact.
13. Outbound citations — MDN (X-Frame-Options, CSP `frame-ancestors`), Microsoft Snap and Apple Split View docs, vendor pricing pages, in `why-sites-wont-load`, `add-any-site`, `view-multiple-websites-at-once`, and the three vs-pages.
14. `STATIC_LASTMOD` bump; `<time datetime>` on guides and posts; `BreadcrumbList` on detail pages.

### Strategic investments (this quarter)

- **`/companion/` landing page** — impact high, effort half day, dependency: CWS listing URL.
- **Per-app embed pages** from the compatibility matrix — impact high, effort multi-day; every claim from `docs/compatibility-matrix.md`.
- **`/changelog/` + monthly cadence** — impact medium–high; next post due 2026-09-02; listicle refresh 2026-11-02.
- **About page + author identity** — expand to 400+ words; `Person` schema and an author box once the owner picks a public name (owner decision).
- **Forum presence** — 3–5 honest answers on existing Quora/Reddit threads for "view multiple websites at once" and "iframe refused to connect"; generative engines weight forum corroboration heavily. Owner action; disclose affiliation.
- **Second comparison set** — vs Pivotab, vs Vivaldi tab tiling / Arc split view.
- **Measure** — after Search Console has 4 weeks of data, re-run this audit; connect an SEO MCP (Ahrefs/Semrush) for volume and difficulty.

---

## Reference — audit facts (for re-verification)

- Crawl 2026-08-15: 21 sitemap URLs, all `200`; home HTML 39,478 B; TTFB 0.17 s; initial JS+CSS 23.7 KB compressed; 26 `@font-face` (DM Sans, Space Grotesk, Space Mono; latin/latin-ext/vietnamese subsets; `swap`); banners 1440×520 PNG ~23 KB with `width`/`height`; `og-card.png` 42 KB.
- Titles 18–68 chars; descriptions 43–187 chars; one H1 per page; JSON-LD on 12 pages (`Organization`, `WebSite`, `SoftwareApplication`, `FAQPage` on `/`; `Article` on 13 articles, `FAQPage` on 10 of them).
- Word counts: home 437 (main), about 179, try 57, guides 1,248–1,854, posts 771–2,099.
- Redirects: `http→https` 301, `www→apex` 301, `/blog→/blog/` 308, `/index.html→/` 308, `/nope-xyz` 404.
- Crawler UA probes: 14 agents → `200`, identical size.
- Competitors: none of workona.com, gettoby.com, start.me, pivotab.com, startpagehq.com serve `llms.txt`; only pivotab.com carries AI-related robots rules (Cloudflare managed Content-Signal).
