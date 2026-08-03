# Wave 6 off-site kit — paste-ready

Covers roadmap items 6.1–6.4 in `docs/seo/2026-08-01-seo-audit-remediation.md`
("Wave 6, off-site + owner actions"). Everything below is copy and
step-by-step procedure for a human to submit. Nothing here was submitted,
fetched, or accounted for on any third-party site while writing this. Follows
the same paste-to-field mapping as `extension/store-listing.md`, and extends
`docs/adsense-launch-checklist.md` rather than repeating it (6.2 cross-refers
its item 3).

**Facts this kit is built from, and where they live:**
- Tiers: Try gives 2 usable cells, no account, stored in-browser, carried
  into the account on signup
  (`frontend/src/app/features/dashboard/try-page.component.ts`,
  `try-migration.ts`). Free is 5 usable cells plus 1 ad cell, $0. Premium is
  6 usable cells, no ad, $4/month (`content/guides/premium-vs-free.md`, "At
  a glance" table; confirmed again in `about.component.ts`).
- Embedding honesty: three real outcomes exist (embeds live, needs a helper,
  never embeds and becomes a one-click launcher), from
  `content/guides/why-sites-wont-load.md`.
- Extension status: **not yet submitted to the Chrome Web Store.**
  `extension/store-listing.md` is itself a pre-submission guide ("Submit
  only after tuliplot.com is live"), and nothing in the repo marks it as
  live. Directory copy below does not promise Companion as installable
  today; see the note in 6.1 before the shared copy block.
- Company/license: the repo is public at `github.com/xamcross/tuliplot`, but
  the root `LICENSE` is **proprietary, all rights reserved**, not open
  source. `extension/store-listing.md` line 50 says "The extension is open
  source," which is inconsistent with `LICENSE`. Fixing that line is out of
  scope here; it belongs to the extension listing, not this kit. This kit
  does not repeat that claim. See the SourceForge/Slashdot note in 6.1.
- Live site facts, verified 2026-08-03 and stated here as given, not
  re-fetched: the sitemap serves 17 URLs including
  `https://tuliplot.com/try/`; `robots.txt` is `Allow: /` with only
  `Disallow: /app`; `/try` returns 200.

---

## 6.1 Directory listings

### What's actually free, at a glance

| Site | Base listing | Verification | Paid tier |
|---|---|---|---|
| AlternativeTo | Free, add via a normal account | None to submit. Claiming the listing as the vendor may need more; verify at the form | No paid tier found for a basic listing |
| Product Hunt | Free, anyone can launch | None beyond an account | No. A launch itself is free (PH sells separate promotion products, not required to list) |
| G2 | Free basic profile | Claiming/"verifying" as the vendor typically wants a work email on the company's domain; verify at the form | Yes. Sponsored/G2 Deals are paid; the profile itself is not |
| Capterra (Gartner Digital Markets) | Free vendor profile | Vendor claim wants a matching business email/domain; verify at the form | Yes. Capterra Ads and featured placement are paid; the profile itself is not |
| SourceForge | Free | None found for a directory-style listing | Promoted placement exists as a paid add-on; verify at the form |
| Slashdot | Historically shares SourceForge Media's back end for software listings, but **verify this is still true before assuming one submission covers both** | Verify at the form | Verify at the form |

### Before you paste anything: the Companion extension

The copy below never says "install the Companion" and never links to a
Chrome Web Store page, because there isn't one yet. `extension/store-listing.md`
is a submission guide, not a record of a completed submission. Where the
description below touches embedding limits, it collapses to what's true
today: most sites embed live, and the sites that don't, whether they'd
normally need the Companion or never embed at all, open as a one-click
launcher. If the Companion ships to the Web Store before you submit these,
add one sentence about it then. Don't add it before that's real.

### Shared copy block (reuse; site sections below note what to change)

**Product name:** TulipLot

**Website:** https://tuliplot.com

**One-line tagline (general use, ~79 characters):**
> A browser dashboard: a fixed 3×2 grid where every cell holds one live web app.

**Short description (~230 characters, trim if a field is stricter; verify the limit at the form):**
> TulipLot is a browser dashboard: a fixed 3×2 grid where every cell holds
> one live web app, whether that's Trello, Notion, Gmail, your news, or any
> HTTPS site. Try 2 cells free with no account, or sign up for 5 (plus
> Premium's 6) at tuliplot.com.

**Long description (~215 words):**
> TulipLot is a browser dashboard for people who live inside a handful of web
> apps all day. Instead of a sprawling browser tab bar, you get one fixed 3×2
> grid: six cells, each holding one app, each cell staying exactly where you
> put it. Drag two cells to swap them, expand one into focus mode, or put a
> cell to sleep when you're not using it. The grid itself never grows past six.
>
> Most sites in the catalog, and any HTTPS URL you paste in yourself, embed
> directly and load live in a cell. A smaller set of sites block embedding
> for a real security reason: the same header that stops clickjacking also
> stops a dashboard from framing them. TulipLot is upfront about it. Those
> sites, plus a handful that never embed anywhere under any circumstances
> (Gmail, Outlook, and Google Calendar are the common examples), open as a
> one-click launcher in their own tab instead. Nothing pretends to embed
> something it can't.
>
> Try it with no account first: two live cells at tuliplot.com/try. A free
> account gets five usable cells plus one ad-supported cell. Premium, $4 a
> month, removes the ad and unlocks the sixth cell. That's the entire
> difference between the two paid tiers: same catalog, same controls, same
> everything else.

**Category/topic (closest fit; every site's taxonomy differs, so verify the exact option list at the form):** Productivity / Personal Productivity Software; secondary fit if offered: Browser Tools or Dashboard Software.

**Tags:** browser dashboard, personal dashboard, start page, new tab page, productivity, tab overload, side-by-side browsing, split screen, freemium, no-login demo

**Pricing summary (all sites):**
> Try is free, no account, 2 usable cells, stored in your browser and
> carried into your account if you sign up. Free is $0/forever, 5 usable
> cells plus 1 ad-supported cell. Premium is $4/month, 6 usable cells, no
> ads. Pricing is flat per account, not per seat. Billing runs through
> Stripe.

**Logo/screenshots to reuse:** `extension/store-assets/screenshot-1-grid.png`,
`screenshot-2-fallback.png`, `screenshot-3-catalog.png` (captured live from
tuliplot.com 2026-08-01) and `frontend/public/og-card.png` (1200×630 social
card) work as generic product screenshots or thumbnails on any of these
sites. None of these were sized for a specific directory's exact
requirement, so check each site's dimensions before upload.

**Social links:** no Twitter/X, LinkedIn, or other social handle exists
anywhere in the repo. If a form requires one, either leave it blank (most
allow this) or use whatever the owner has personally. Don't invent a handle.

---

### AlternativeTo

Entry point: alternativeto.net, sign in, then "Add app" (or "Suggest an
app"; the exact label may have changed, so verify at the form).

- **Name:** TulipLot
- **Tagline / short description:** use the shared tagline above.
- **Description:** use the shared long description above.
- **License:** Freemium (free tier plus paid Premium tier). Do **not**
  select "Open Source." The repo's `LICENSE` is proprietary, all rights
  reserved. Confirm "Freemium" is the exact wording in AlternativeTo's
  dropdown before submitting; verify at the form.
- **Platforms:** Web-based. No native desktop or mobile app exists, so
  don't check any platform beyond Web.
- **Tags:** reuse the shared tag list above; add "iframe" and "dashboard" if
  AlternativeTo's tag field is free-text.
- **"Alternative to" nominations:** Toby, Workona, start.me. Add these as
  *categorization only*: select them as adjacent products and stop there.
  Do not write anything in the submission about their features, prices, or
  limits. That discipline is governed by
  `docs/seo/2026-08-02-competitor-facts-verified.md`, and AlternativeTo's
  own community can and will correct unverified claims about other listed
  products.
- **Official site / source link:** https://tuliplot.com (official). Do not
  add a "source available" or GitHub link on this listing. The product is
  not open source, whatever `extension/store-listing.md` says about the
  extension specifically.
- **Verify at the form:** exact tagline/description character limits, the
  precise license-dropdown wording, and whether claiming the listing as the
  vendor requires a domain-matched email.

---

### Product Hunt

Entry point: producthunt.com, "Launch" (post-signup). Product Hunt launches
are scheduled to a specific day (00:01 PT). Decide the launch date
deliberately rather than submitting the moment the form is open.

- **Name:** TulipLot
- **Tagline (Product Hunt has historically capped this near 60 characters;
  verify the current limit at the form. This one is 49):**
  > A fixed 3×2 grid of live apps in one browser tab
- **Description / "About this launch":** use the shared long description
  above, or trim it. Product Hunt's launch description field length isn't
  something to guess at, so verify at the form and cut from the end if
  needed (the pricing paragraph is the safest one to shorten).
- **Topics:** Productivity, Web App. Add "Browser Extensions" only once the
  Companion is actually on the Chrome Web Store; adding it now would tag
  the launch with a capability that isn't live.
- **Pricing:** Free, with a paid tier. Same summary as the shared pricing
  block above.
- **Gallery images:** reuse the three screenshots in `extension/store-assets/`
  named above. Product Hunt's exact image count and aspect ratio isn't
  something to assume, so verify at the form; a square or 16:9 crop of the
  same shots usually satisfies it.
- **Links:** website https://tuliplot.com. No Twitter/X handle to attach
  (see shared note above).

**Maker's first comment (post this as the first comment on the launch,
signed in as the maker; this is the highest-leverage text on the page):**

> Hey, I'm the person who built TulipLot.
>
> I got tired of hunting for the same six tabs every day, so I built a
> dashboard that fixes them in place: a 3×2 grid, one app per cell, and the
> grid never grows past six. Mail goes where mail always goes. You stop
> reading tab labels and start just reaching for the spot.
>
> Most sites embed straight into a cell. A handful never will, banks,
> Gmail, Google Calendar, because the same security header that stops
> clickjacking also stops framing, and I'd rather say that plainly than
> fake an embed that breaks on the first click. Those open as a one-click
> launcher instead, same as clicking a bookmark.
>
> You can try it with zero signup at tuliplot.com/try: two live cells, add
> any HTTPS site. A free account gets you five cells plus one ad. Premium
> is $4/month, drops the ad, and gives you the sixth cell. That's the whole
> pricing page.
>
> I'd love feedback, especially on what's missing from the free tier or
> what's confusing about the embed-vs-launcher split. I read everything here.

- **Verify at the form:** current tagline character cap, description length
  cap, gallery image spec, and whether a launch slot needs reserving ahead
  of the date you pick.

---

### G2 and Capterra

Both sit in the same category of directory: buyer-review sites with a free
base listing and a paid promotion layer on top. Entry points:
g2.com, "Add product to G2" (vendor sign-up flow); capterra.com, "List your
software" (routes through Gartner Digital Markets, shared with GetApp and
Software Advice).

**What's free vs. what isn't, specifically:**
- Creating the base product profile is free on both. What isn't free is
  sponsored placement, "G2 Deals," Capterra Ads, and any lead-gen product;
  none of those are required to have a listing.
- Both typically want the vendor to claim or verify the listing with a work
  email matching the company's domain (`hello@tuliplot.com` matches
  `tuliplot.com`, so that should satisfy it). Verify at the form, since
  exact verification steps change.
- Both organize products into a fixed category taxonomy that TulipLot
  doesn't map onto cleanly; there's no "browser dashboard" category on
  either site as far as this kit's author can confirm. Pick the closest
  available option at submission time rather than trusting the guess below.
  Verify at the form.

- **Product name:** TulipLot
- **Tagline / short description:** shared copy block above.
- **Long description:** shared copy block above.
- **Category (closest fit; verify at the form):** Personal Productivity
  Software, or Productivity if that's the only tier offered.
- **Pricing model field:** Freemium; flat monthly price for Premium ($4),
  not per-seat, not per-user. If the form asks for a free-trial length,
  answer "unlimited" for the Free tier (it doesn't expire) and separately
  "no account required" for the /try 2-cell tier if there's a field for
  that.
- **Feature checklist:** only check boxes that are literally true, for
  example dashboard/widget-style interface, third-party site embedding,
  custom URL support, drag-and-drop layout, no-signup demo. Do not check
  anything like API access, SSO, or team/multi-user features unless you've
  confirmed the product actually has them. This kit's author did not find
  evidence of any of those in the repo and is not asserting they exist.
- **Company info fields (founded year, HQ, employee count):** founded 2026
  per `LICENSE` copyright year. Employee count and HQ aren't in the repo, so
  fill those in yourself rather than leaving a guess here.
- **Verify at the form:** exact category taxonomy match, verification
  process and timeline, and whether either site has a minimum-criteria gate
  (review count, user count) before a listing goes fully live.

---

### SourceForge and Slashdot

**Read this before submitting anywhere here.** SourceForge's headline
product is hosting open-source projects. TulipLot's repo is public
(`github.com/xamcross/tuliplot`) but its `LICENSE` is proprietary, all
rights reserved. It is not open source. Do not use SourceForge's "Create
Project" open-source-hosting flow for TulipLot. SourceForge also operates a
separate business-software directory, review/comparison listings alongside
its project host, in the same style as G2/Capterra, and that's the right
flow for a commercial product like this. Confirm it's still the live
submission path when you get there, since this kit's author has not
submitted anything and can't verify the current UI. Slashdot's software
listings have historically shared a back end with SourceForge Media.
Whether one submission still covers both, or Slashdot has its own separate
form now, needs checking at the form. Don't assume.

- **Product name:** TulipLot
- **Tagline / short description:** shared copy block above.
- **Long description:** shared copy block above.
- **License field:** Proprietary / Commercial. Not open source, not free
  software, regardless of what any other page in this repo says.
- **Category (verify at the form):** Business & Productivity Software, or
  the closest equivalent in whichever taxonomy the business-directory flow
  actually presents.
- **Tags:** shared tag list above.
- **Pricing:** shared pricing summary above.
- **Verify at the form:** whether the business-directory listing flow, as
  opposed to open-source project hosting, is still where a commercial,
  closed-source product like this belongs on SourceForge today; whether
  Slashdot requires its own separate submission; and exact category names
  on both.

---

## 6.2 ads.txt: replace the placeholder publisher ID

`frontend/public/ads.txt` currently contains, verbatim:

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

`pub-XXXXXXXXXXXXXXXX` is a literal placeholder; it has to be replaced with
the real AdSense publisher ID before this file means anything. This is
`docs/adsense-launch-checklist.md` section 3. That checklist covers the rest
of the AdSense cutover (consent/CMP, verification snippet, go-live flip);
do those separately. This section only covers the ads.txt swap itself.

**Where to find the ID in AdSense:**
1. Sign in to the AdSense account at ads.google.com.
2. Go to **Account → Account information** in the left sidebar. The page
   shows **Publisher ID** formatted `pub-XXXXXXXXXXXXXXXX` (a 16-digit
   number after `pub-`). That's the value for ads.txt.
3. The same number also appears with a `ca-` prefix
   (`ca-pub-XXXXXXXXXXXXXXXX`) inside any ad-unit code snippet AdSense shows
   you, and that `ca-pub-...` form is what feeds
   `environment.adsenseClient` and the backend's `ADSENSE_CLIENT`
   (checklist section 5). It's the same underlying ID with two different
   prefixes depending on where it's used. ads.txt wants the `pub-...` form,
   with no `ca-` prefix.

**The exact edit**, in `frontend/public/ads.txt`: replace only the
placeholder segment, and keep everything else on the line identical:

```
google.com, pub-<the real 16-digit ID>, DIRECT, f08c47fec0942fa0
```

**Ship it:** commit the change, open a PR, merge to main. Deploys to
tuliplot.com are automatic on merge. `.github/workflows/ci.yml` runs a
path-filtered auto-deploy of the frontend to Cloudflare Pages once tests
pass, so no manual `wrangler pages deploy` step is needed for this change.

**Verify after deploy:**

```
curl https://tuliplot.com/ads.txt
```

should print the line with the real publisher ID, not
`pub-XXXXXXXXXXXXXXXX`. Also worth checking the content type:

```
curl -sI https://tuliplot.com/ads.txt
```

should show `content-type: text/plain` (or `text/plain; charset=utf-8`),
which is what `docs/adsense-launch-checklist.md` section 3 requires it to
serve as.

---

## 6.3 Search Console + Bing Webmaster Tools

### Google Search Console

1. Go to **search.google.com/search-console**, sign in with the account
   that should own this property.
2. **Add property → Domain**, not "URL prefix." A Domain property covers
   `tuliplot.com`, `www.tuliplot.com`, and any subdomain in one property,
   and it's verified via DNS, which fits the owner's existing Cloudflare
   access.
3. Google shows a TXT record value, something like
   `google-site-verification=<token>`. In the Cloudflare dashboard, open the
   `tuliplot.com` zone, then **DNS → Records → Add record**: type **TXT**,
   name `@` (root), content is the exact value Google gave you, TTL Auto.
   Proxy status doesn't apply to TXT records.
4. Back in Search Console, click **Verify**. DNS propagation is usually fast
   through Cloudflare but can take a few minutes; retry Verify if it fails
   immediately.
5. **Sitemaps** (left nav), enter `sitemap.xml`, then **Submit**. It
   resolves to `https://tuliplot.com/sitemap.xml`.
6. Confirm it shows **Success** and discovers URLs. As of 2026-08-03 the
   sitemap serves **17 URLs**, including `https://tuliplot.com/try/`. SEO
   Wave 5 (PR #11, currently open) adds four more content pages; once that
   merges, the sitemap grows to **21 URLs**. Google re-reads a submitted
   sitemap on its own schedule, so there's no need to resubmit after the PR
   lands.

**What to check in the first few weeks:**
- **Page indexing** (Coverage) report: expect it to climb toward the full
  URL count (17, then 21 after Wave 5) as "Indexed." A brand-new domain
  takes days to weeks to fully crawl and index, not hours.
- The **Excluded** tab will show `/app` paths as "Excluded by robots.txt."
  That's expected and correct; `robots.txt` deliberately disallows `/app`
  (it's the logged-in dashboard, not public content) while allowing
  everything else, including `/try`.
- Watch for anything excluded that shouldn't be, for example a real content
  page showing "Discovered, currently not indexed" for more than a couple
  of weeks, or "Duplicate without user-selected canonical," which would
  suggest the Wave 1 trailing-slash canonical fix regressed. Neither is
  expected given the current state, but they're the two exclusion reasons
  worth actually reading if they show up.
- **Performance** report won't show meaningful data for the first few weeks
  on a brand-new domain. Don't read too much into a flat line early on.

### Bing Webmaster Tools

1. Go to **bing.com/webmasters**, sign in.
2. Bing has historically offered a one-click **"Import from Google Search
   Console"** option when you sign in with the same Google account already
   verified there. Check for that first, since it skips DNS entirely if
   it's still offered; verify at the form. If it's not there, fall back to
   manual verification.
3. Manual fallback: **Add a site → tuliplot.com**, choose the **DNS (TXT
   record)** verification option, and add the TXT value Bing gives you in
   Cloudflare the same way as step 3 above. This is a second, separate TXT
   record; Bing's value is different from Google's.
4. Submit the sitemap: **Sitemaps → Submit sitemap →
   https://tuliplot.com/sitemap.xml**.
5. First-weeks check: Bing Webmaster's **Site Explorer** / crawl-errors
   view for anything unexpected, and confirm `/app*` isn't showing up as
   crawled. It shouldn't be; it's the same `robots.txt` Bing's crawler
   reads.

---

## 6.4 Publishing cadence

### The schedule

- **One substantive post or refresh per month, minimum.** "Substantive"
  means a new page at the depth of the existing guides/posts (800+ words,
  fact-checked, internally linked) or a real content refresh of an existing
  one, not a typo fix.
- **Quarterly: re-verify `docs/seo/2026-08-02-competitor-facts-verified.md`,
  then update anything that cites a changed number. Next review: 2026-11-02.**
  Do the facts file first, always, in that order: re-check each vendor's
  own pricing/help pages, not third-party listicles (the same discipline
  the file itself was built with), update the file, and only then touch any
  page that cites a number from it. Competitor prices go stale, and
  publishing a page that quotes last quarter's price is worse than not
  having the page.
- **Four pages currently cite competitor facts and are in scope for that
  quarterly pass**, pending SEO Wave 5 / PR #11, currently open. These
  don't exist on `main` yet, but will by the time the November review comes
  around: `content/blog/tuliplot-vs-toby.md`,
  `content/blog/tuliplot-vs-workona.md`, `content/blog/tuliplot-vs-start-me.md`,
  and `content/blog/best-start-pages-2026.md` (the listicle, which
  references the same three competitors). If PR #11 still hasn't merged by
  2026-11-02, re-verify the facts file anyway; it should stay current
  regardless of the branch's merge status, and apply any changed numbers to
  those four pages whenever they do land.

### Candidate topics (suggestions only, not a commitment; pick based on what's actually landing traffic by then)

Drawn from the roadmap's Reference A keyword table, favoring the rows that
don't already have a landing page and don't require any competitor-fact
claims:

- **"new tab page" / "start page" head term.** Reference A marks this
  "earned indirectly" with no dedicated page. A short, plain piece answering
  "what happens to my new tab page" or similar could target it directly
  without touching competitor claims.
- **Role-specific layout follow-up to `dashboard-productivity-tips.md`.**
  That post already covers general layouts. A follow-up like "a support
  engineer's TulipLot grid" or "a solo founder's six cells" is a natural
  monthly refresh candidate, long-tail, and needs no competitor research.
- **"all my apps in one place."** Reference A currently maps this only to
  homepage copy, not a standalone page; it could become one.
- **A monthly build-log or what-shipped post.** Doesn't need new keyword
  research; it's inherently fresh content and can point back at the
  higher-effort pages. It also doubles as evidence of an active product for
  anyone (AdSense reviewers, G2/Capterra visitors) checking whether the
  site is maintained.
- **A /try-usage follow-up**, once there's enough real usage to say
  something honest about it (for example which sites people try first).
  This is a later-stage suggestion, not for the next cycle or two.
