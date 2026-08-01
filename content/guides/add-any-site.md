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

Browsers let any site send an instruction that means "don't let other pages frame me." It comes through as a response header — `X-Frame-Options` or a `Content-Security-Policy` with `frame-ancestors` — for a real reason: without it, someone could load your bank's login page inside a hidden frame on their own site and trick you into typing your password into what looks like the real thing. Blocking embedding stops that trick cold.

The same header also blocks harmless embedding, like a cell in your TulipLot grid. The browser can't tell a malicious overlay from a dashboard you built on purpose — it just sees "don't embed me" and obeys, and TulipLot can't override that at the page level. So instead of pretending it can, it tells you what happened and gives you a real option, rather than leaving you staring at a broken pane.

## What TulipLot shows you instead

When a site blocks embedding, the cell shows you one of three states, depending on what that particular site allows:

- **Needs the Companion.** The site can be unlocked, but only with the Companion extension installed and turned on for it. The cell shows three buttons: **Install TulipLot Companion**, **Enable for this site**, and **Open in a tab instead**.
- **Opens in its own tab.** Some sites — Gmail, Outlook, and Google Calendar are common examples — never embed, Companion or not. Their protections run deeper than a header. The cell just offers to open the site in a normal tab.
- **Load-failed with Retry.** Sometimes a site times out or the connection fails, unrelated to embedding rules. The cell shows a Retry button, and often a second try is all it takes.

None of these is a dead end — each gives you the fastest working path for that particular site.

## Install the TulipLot Companion

The TulipLot Companion is a free, optional Chrome extension, and it's the reason most stubborn sites end up embedding anyway. What it does is narrow: it adjusts the frame-blocking headers only for sites you've explicitly enabled, one at a time. It doesn't touch any other site, and it collects nothing about you or your browsing.

To install it, click **Install TulipLot Companion** on any cell that needs it. That takes you to the Chrome Web Store listing, where installation happens the normal Chrome way. Once it's installed, come back to your dashboard — the cell is still waiting for the second step.

The Companion is Chrome-only, since it relies on Chrome's extension APIs. On a different browser, sites that need it fall back to opening in a tab instead.

## Enable a stubborn site

Installing the Companion doesn't unlock anything by itself — it just makes unlocking possible, site by site. A browser won't let a page grant itself permission to relax another site's security headers, so the enabling step happens deliberately, one click at a time, back in the cell:

1. **Install TulipLot Companion**, if you haven't already — opens the Chrome Web Store listing, where installation happens.
2. Back in the cell, click **Enable for this site** — the required second step, specific to that one site.
3. The cell retries and, for most sites, loads live in the grid from then on.

You'll repeat step 2 for each new stubborn site — enabling one site never enables another. That's what "scoped" means: broad enough to be useful, narrow enough that you never grant more than you meant to.

## What still can't be embedded

Not every site gives in, even with the Companion enabled — worth saying plainly, rather than letting you assume you did something wrong. Many banks and some login flows, including Gmail, Outlook, and Google Calendar, refuse to embed no matter what. Their protection runs deeper than the header the Companion adjusts, often tied to how login and session cookies work in a top-level window. The Companion genuinely can't unlock them, and it's honest to say so instead of promising a fix that doesn't exist.

Those cells aren't wasted, though. They get a reduced toolbar of three controls — open in tab, edit, remove — and **open in tab** does the real work: one click and the site opens in its own tab, fully itself. You still find it in the same spot every time, you just don't get the live-framed view. Sites like Trello need none of this — they embed live in the grid the moment you add them.

## Troubleshooting

### Reload the cell

If a site that normally loads fine shows a blank cell, try reload first. A stale connection or a slow response is the most common cause, and reloading clears it without touching anything else on the grid.

### Re-grant the site

If a Companion-enabled site suddenly stops embedding, the grant may have been cleared — this can happen after a Chrome update or reinstall. Go through **Enable for this site** again from the cell; it takes a few seconds and doesn't touch your other sites.

### Load-failed → Retry

A load-failed state usually means a temporary hiccup — a slow server or a timed-out request. Click Retry. If it keeps failing, the site itself may be down; check it in a regular tab to confirm.

### When in doubt, open in a tab

If a cell isn't behaving as expected and nothing above clears it, **open in tab** always works as a fallback. It's on every cell, live or not, and it gets you to the actual site with zero troubleshooting.

## Safety questions, answered

### Is loosening those headers safe?

Yes, because of how narrow the change is. The Companion adjusts embedding headers only for the specific sites you chose, only inside your own browser, and only while it's installed. It never touches sites you haven't enabled, and it never changes how those sites behave for anyone else.

### Why is it a separate extension?

Because a web page isn't allowed to grant itself that power — it's a browser rule, not a TulipLot limitation. Only an installed extension, one you explicitly add and that asks Chrome for permission, can adjust how a site's headers get handled for you. Splitting it out keeps the unlock opt-in and visible, instead of something hidden in the page.

### Does it read my browsing?

No. The Companion collects nothing — no browsing history, no page contents, no analytics. Its only job is adjusting embedding headers for sites you've enabled; there's nothing else it does.

Most sites need none of this — they just work. For the ones that don't, now you know what "refused to connect" means and what to click next. Haven't set up your grid yet? [Get started](/guides/getting-started) or [create a free account](/register) and add your first stubborn site today.
