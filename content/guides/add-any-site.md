---
title: Adding sites that refuse to be framed
slug: add-any-site
description: Why some sites show "refused to connect" in a dashboard, and how the TulipLot Companion extension unlocks them safely, one site at a time.
date: 2026-08-01
category: Advanced
order: 2
---
# Adding sites that refuse to be framed

Paste almost any HTTPS URL into a cell and it loads. But every so often you'll add a site and the cell says the site refuses to connect, or that it won't load here. That's not a TulipLot bug — it's the site itself, and there's a fix for most of them.

## Why some sites refuse to load

Browsers let any site send an instruction that means "don't let other pages frame me." It comes through as a response header — `X-Frame-Options` or a `Content-Security-Policy` with `frame-ancestors` — for a real reason: without it, someone could load your bank's login page inside a hidden frame on their own site and trick you into typing your password into what looks like the real thing. Blocking embedding stops that cold; [the full explanation of why sites refuse to be embedded](/guides/why-sites-wont-load) covers the headers involved and what does and doesn't fix it.

The same header also blocks harmless embedding, like a cell in your grid. The browser can't tell a malicious overlay from a dashboard you built on purpose — it just sees "don't embed me" and obeys, and TulipLot can't override that at the page level. So instead of pretending it can, it tells you what happened and gives you a real option, rather than a broken pane.

## What TulipLot shows you instead

When a site blocks embedding, the cell shows you one of three states, depending on what that particular site allows:

- **Needs the Companion.** The site can be unlocked, but only with the Companion extension installed and turned on for it — Notion and Hacker News are common examples. The cell shows three buttons: **Install TulipLot Companion**, **Enable for this site**, and **Open in a tab instead**.
- **Opens in its own tab.** Some sites — Gmail, Outlook, and Google Calendar are common examples — never embed, Companion or not. Their protections run deeper than a header. The cell just offers to open the site in a normal tab.
- **Load-failed with Retry.** A site tried to load and didn't. Often it's a Companion-eligible site that isn't granted yet; sometimes it's just a slow server or a timed-out connection. Either way, the cell shows a Retry button, and there's more on sorting out which is which below.

None of these is a dead end — each gives you the fastest working path for that particular site.

## Install the TulipLot Companion

The TulipLot Companion is a free, optional Chrome extension, and it's the reason most stubborn sites end up embedding anyway. What it does is narrow: it adjusts frame-blocking headers only for sites you've explicitly enabled, one at a time. It doesn't touch any other site, and it collects nothing about you or your browsing.

To install it, click **Install TulipLot Companion** on any cell that needs it. That opens the Chrome Web Store listing, where installation happens the normal Chrome way. Once it's installed, come back to your dashboard — the cell is still waiting for the second step.

The Companion is Chrome-only, since it relies on Chrome's extension APIs. On a different browser, sites that need it fall back to opening in a tab.

## Enable a stubborn site

Installing the Companion doesn't unlock anything by itself — it just makes unlocking possible, site by site. A browser won't let a page grant itself permission to relax another site's security headers, so the enabling step happens deliberately, one click at a time, back in the cell:

1. **Install TulipLot Companion**, if you haven't already — opens the Chrome Web Store listing, where installation happens.
2. Back in the cell, click **Enable for this site** — the required second step, specific to that one site.
3. The cell retries and, for most sites, loads live in the grid from then on.

The in-cell prompt sticks around until TulipLot detects the Companion, which happens the next time you load your dashboard — so in that first pass you can enable several sites right from their cells, one **Enable for this site** click each. Add a stubborn site after that and the cell goes straight to trying to load; if it isn't granted, you'll land on "didn't load" instead of the button. That's expected, and the fix is just as quick: open `chrome://extensions`, click **TulipLot Companion**, go to **Site access**, and add the new site there, then hit **Retry** in the cell. Same permission, same one-at-a-time scoping — just requested through Chrome's settings instead of the cell.

## What still can't be embedded

Not every site gives in, even with the Companion enabled — worth saying plainly, rather than letting you assume you did something wrong. Many banks and some login flows, including Gmail, Outlook, and Google Calendar, refuse to embed no matter what. Their protection runs deeper than the header the Companion adjusts, often tied to how login and session cookies work in a top-level window. The Companion genuinely can't unlock them, and it's honest to say so instead of promising a fix that doesn't exist.

Those cells aren't wasted, though. They get a reduced toolbar of three controls — open in tab, edit, remove — and **open in tab** does the real work: one click and the site opens in its own tab, fully itself. Sites like Trello need none of this — they embed live in the grid the moment you add them.

## Troubleshooting

### Reload the cell

If a site that normally loads fine shows a blank cell, try reload first. A stale connection or a slow response is the most common cause, and reloading clears it without touching the rest of the grid.

### Re-grant the site

If a stubborn site stops embedding, or a newly added one lands on "didn't load" instead of the Companion prompt, the fix is the same: open `chrome://extensions`, click **TulipLot Companion**, open **Site access**, and add (or re-add) the site. Hit Retry in the cell. A few seconds, and it doesn't touch your other sites.

### Load-failed → Retry

A load-failed cell often just means the Companion hasn't been granted access to that site yet — check **Site access** at `chrome://extensions` first, add the site if it's missing, then Retry. Already granted and still failing? That's more likely a genuine hiccup — a slow server or timeout — and a second Retry usually clears it. Still stuck, check the site in a regular tab; it may just be down.

### When in doubt, open in a tab

If a cell isn't behaving as expected and nothing above clears it, **open in tab** always works as a fallback. It's on every cell, live or not, and it gets you to the actual site with zero troubleshooting.

## Safety questions, answered

### Is loosening those headers safe?

Yes, because of how narrow the change is. The Companion adjusts embedding headers only for the specific sites you chose, only inside your own browser, and only while it's installed. It never touches sites you haven't enabled, and never changes how those sites behave for anyone else.

### Why is it a separate extension?

Because a web page isn't allowed to grant itself that power — it's a browser rule, not a TulipLot limitation. Only an installed extension, one you explicitly add and that asks Chrome for permission, can adjust how a site's headers get handled for you. Splitting it out keeps the unlock opt-in and visible, not hidden in the page.

### Does it read my browsing?

No. The Companion collects nothing — no browsing history, no page contents, no analytics. Its only job is adjusting embedding headers for sites you've enabled; there's nothing else it does.

Most sites need none of this — they just work. For the ones that don't, now you know what "refused to connect" means and what to click next. Haven't set up your grid yet? [Get started](/guides/getting-started) or [create a free account](/register) and add your first stubborn site today.
