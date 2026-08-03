# Competitor facts — primary-source verified

**Verified:** 2026-08-02, from each vendor's own pages (pricing, help centre, blog). Third-party listicles were used only to *find* pages, never as a source for a fact.
**Purpose:** Wave 5's comparison pages state facts about other companies' products. Everything published must come from this file or a fresh re-verification — and prices go stale, so **re-check before publishing if this file is more than ~2 months old.**

## Toby (gettoby.com)

- **What it is:** a visual workspace for saving and organising browser tabs and links into collections. Their words: "Stop Drowning in Tabs."
- **Free ("Starter"):** $0. Quoted limit: **"Up to 60 Saved Tabs: You can save and manage up to 60 tabs across all your collections."** Unlimited members. No Advanced Search, no Remove Duplicates.
- **Productivity:** $6 USD per member/month, or $4.50 per member/month billed yearly ($54/year). Unlimited saved tabs, advanced search, remove duplicates.
- **Team:** $10 USD per member/month, or $8 billed yearly ($96/year). Adds SSO, priority support, centralised billing.
- **Do not publish:** the "up to 5 members per organization" figure. It survives in a stale help article (66000517157) but Toby's current pricing page and change FAQ both say **"There are no more restrictions on how many members you have."**
- **Context:** the 60-tab Starter cap arrived when Toby retired its old single free plan; existing free users were transitioned by 12 Nov 2024, per Toby's own FAQ.
- Sources: `gettoby.com/pricing`, `gettoby.com`, help articles 66000519429 (Free plan), 66000526654 (New plans FAQ), 66000526655 (What these changes mean).

## Workona (workona.com)

- **What it is:** a tab/project workspace manager — "Get your tabs under control," organising tabs into per-project Spaces with auto-save and cross-device sync.
- **Free:** exists but is documented only in a pricing-page FAQ accordion, not shown as a plan card. Quoted limit: **"Free users are restricted to 5 spaces… When Free users reach the space limit, they won't be able to create additional spaces until they upgrade."** Their FAQ also says the Free plan "can be used forever."
- **Pro:** "Starting at $7 / month" — confirmed to be the annual-billed rate (checkout resolves to `?term=annual`). Unlimited spaces/sections, 90-day session backups, integrations, templates. A separate monthly-only rate is **UNVERIFIED** — not displayed distinctly.
- **Team:** "Starting at $8 / user / month," 3-user minimum, up to 25 users. **Enterprise:** contact sales.
- **Do not publish:** "$6/month" for Pro (stale aggregator figure; the live page says $7). Do not state the "free tier was cut from 10 spaces to 5" story as Workona's own — it is third-party reporting only; attribute it explicitly or omit it.
- Sources: `workona.com/pricing/` (JS-rendered — a static fetch misses the numbers), `workona.com`, `workona.com/help/subscriptions-billing/`.

## start.me

- **What it is:** their own title tag — "Bookmark Manager, Custom Start Page & New Tab." Hero: "All your important links, one click away."
- **Free:** $0. Quoted limit: **"Maximum of 3 start pages"** (help centre: "Free users can create only three personal pages"). Basic widgets only. **"Includes advertising."** Widgets and bookmarks are unlimited even on free — only the page count is capped.
- **Personal PRO:** $25 per year. Unlimited start pages, 27 PRO features/widgets, no ads, AI features.
- **Team:** $25/month billed annually, 10 users included, 1 workspace, custom subdomain/branding, SAML2 SSO. 30-day trial, no card. **Enterprise:** quote.
- **Actively shipping:** a July 2026 changelog covers a bookmark clean-up tool, a rebuilt Notes editor, timer and page-introduction widgets, 7-column pages, and AI site suggestions / smart title cleanup.
- Sources: `start.me/pricing` (403s to plain fetches — render it), `start.me`, `support.start.me` article 9182818, `blog.start.me` July 2026 update.

## Checked and NOT verifiable — do not publish these

Recorded 2026-08-02 after a Wave-5 review caught an unsourced claim. These were actively looked for and not found. Absence of evidence is not evidence: do not restate them from intuition in a later wave.

- **"Toby requires an account / does not work without signup."** `gettoby.com` does not address account requirements at all. Its calls to action are "Install toby" / "Install Toby" linking to the Chrome Web Store; the homepage never mentions signing up, account creation, a demo, or guest access. Plausible in reality, but **not sourceable**, so it must not appear as a factual claim or as a comparison-table row.
- **"Workona requires an account."** `workona.com` likewise does not state this.
- **"A Workona Space lies dormant / its tabs are closed until you restore it."** The homepage says only "Browsers are memory hogs, so we added tab suspension to keep your computer running smoothly" — a general statement about tab suspension, not about closed Spaces. Do not describe the closed-Space lifecycle as fact on this basis.

**The safe way to make the try-without-signup point** is to state it about TulipLot alone ("TulipLot gives you two live cells with no account") and let the reader draw their own comparison. Never assert what a competitor requires unless their own page says it.

## Currency caveat

Only Toby prints "usd" explicitly. Workona and start.me show a bare "$" with no currency code anywhere findable. Assume USD for a US reader; don't state it as their claim.

## Apples-to-oranges warnings — read before writing any comparison table

1. **Different job entirely.** Toby and Workona *save references* to tabs you reopen later. start.me is a widget-based start page whose widgets are mostly first-party (weather, RSS, notes), not arbitrary third-party web apps. **None of the three keep multiple live, interactive third-party apps rendered simultaneously** — which is TulipLot's whole product. A "5 cells vs 60 tabs vs 5 spaces" table counts three unrelated things and would mislead readers. Compare jobs to be done, and say plainly where the products aren't substitutes.
2. **Different pricing model.** Toby and Workona charge per seat (they're collaboration tools). A fair single-user column is Toby Productivity $6 ($4.50 annual), Workona Pro $7 (annual-billed), start.me Personal PRO $25/year (≈$2.08/mo), TulipLot Premium $4/mo. Do not blend their team tiers into a single-user table.
3. **Ad-supported free tiers.** start.me's free plan explicitly includes advertising, which is genuinely comparable to TulipLot's free tier. Toby and Workona do **not** describe their free tiers as ad-supported — don't imply symmetry.
