---
title: Why some sites won't load in a dashboard
slug: why-sites-wont-load
description: "Refused to connect" isn't a bug in your dashboard. Here's what that message actually means, which sites do it, and what can and can't be done about it.
date: 2026-08-02
updated: 2026-08-16
category: Advanced
order: 4
---
# Why some sites won't load in a dashboard

## What "refused to connect" actually means

Most tools that show one website inside another, including dashboards and widgets, do it through something called an iframe: a small window that displays one webpage inside another page, the same way a picture-in-picture video sits inside a bigger screen. If you've ever pasted a URL into one of these tools, you may have run into a page that won't load in an iframe at all: a message like "refused to connect" or "refused to display in a frame" instead of the site you expected. Here's the short version: that's not the tool breaking. It's the site you tried to load, saying no.

Plenty of sites are perfectly happy to be shown this way. A specific minority send back an instruction first, one that tells the browser: do not display me inside anyone else's page. When that instruction arrives, the browser follows it and blocks the frame, and "refused to connect" is simply what that block looks like on your screen.

Nothing you did caused this. The tool tried to load the site the normal way, the site's own instruction refused that request, and the browser respected the refusal instead of overriding it, because browsers aren't built to ignore it. The failure you're looking at is the site working exactly as its owner designed it, not a bug in whatever you were using to load it. The rest of this guide covers why sites that block embedding do it, what actually fixes it, and what stays out of reach no matter which tool you're using.

## The two headers behind it

That refusal travels as a header: a small piece of information a website sends back alongside its page, invisible on the page itself but read by your browser before anything is displayed. Two different headers can carry this particular instruction, and knowing which one you're dealing with helps make sense of what you're seeing.

[`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) is the older of the two, and it's blunt on purpose. A site sets it to one of two values: `DENY`, which blocks every attempt to frame it with no exceptions, or `SAMEORIGIN`, which allows framing only by pages on that exact same site. There's no middle ground and no list of trusted outsiders, just those two settings.

[`Content-Security-Policy: frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) is the newer replacement, and it works more like a guest list. Instead of an on-or-off switch, a site names the exact sources allowed to frame it, anything from nobody at all to a short list of specific approved sites. A site that wants to block embedding entirely can still use it; it just leaves that list empty.

## Why sites do this — and why it's mostly reasonable

These headers exist because of an attack called clickjacking. An attacker builds an ordinary-looking page, maybe one promising a prize or a video, and secretly loads a real site underneath it in an invisible frame, positioned exactly over a fake button. You think you're clicking "claim your prize." What you're actually clicking is the real site's own button, hidden right below the decoy: confirm a purchase, change a setting, approve a login. Your click is genuine. You just have no idea what it actually landed on.

Blocking embedding shuts that down at the source. If a site refuses to be framed at all, there's no invisible layer for an attacker to hide underneath, and the trick has nothing left to work with. That's why the sites most likely to refuse are the ones with the most to lose from a stolen click: banks, anything tied to a login, anything that moves money or changes an account setting. Framing rules are a genuine defense against a real attack, aimed at attackers, not at dashboards. Tools that embed other sites just happen to sit on the other side of the same rule.

## The three things you'll see instead

Strip away any particular tool, and every embedding attempt lands in one of three places. A site loads live, framed normally, and behaves like the real thing shrunk into a smaller window. A site needs a helper before it will embed: a browser extension you install once and then turn on for that specific site, after which it behaves like the first case. Or a site refuses no matter what, and the tool's only honest option is to hand you a one-click way to open it in its own tab instead.

TulipLot mirrors those three outcomes exactly, and it's upfront about which sites land where. Trello is a catalog example of the first case: add it and it loads live in the grid with nothing extra to do. Notion and Hacker News are catalog examples of the second: they need the free TulipLot Companion extension installed once and enabled for that specific site before they'll embed. Gmail, Outlook, and Google Calendar are catalog examples of the third: they never embed, Companion or not, and each opens in its own tab as a one-click launcher instead.

None of the three is a failure state. A cell that opens a launcher tab is doing exactly what that particular site allows, and it still gets you to the real app in one click.

## What actually fixes it (and what doesn't)

For the second category, sites that need a helper, the fix is real and it works: a browser extension that adjusts those two headers, but only for the specific sites you choose. TulipLot's Companion is one example. It's free, Chrome-only, installed once from the Chrome Web Store, then switched on per site rather than granted blanket access to everything you visit. It changes the headers only on frames your own dashboard is loading, so an enabled site still behaves completely normally if you open it in an ordinary tab on its own, and it collects nothing about you or your browsing while it does it.

For the third category, sites that refuse no matter what, nothing fixes it, and it helps to know why. Those sites layer protections well below the header level: login flows that check whether they're running as the top-level page, session cookies that only behave correctly outside a frame, scripts that detect framing and break themselves on purpose. An extension that edits response headers has nothing left to act on there.

It's worth naming the workaround people reach for anyway: routing the site through a proxy, a middleman server that fetches the page for you and passes it along, stripping the blocking header before it arrives. That can work for a static page with nothing to log into. For a logged-in app, it doesn't. Your session, your cookies, and any two-factor check are tied to talking to the real site directly, so a proxy either leaves you logged out or asks you to hand your credentials to a server that isn't the app you're trying to use. Neither one is a fix. A launcher tab that opens the real, unmodified site is the honest answer for that category, not a proxy.

## The honest limits

Some sites will never embed anywhere, in any tool, no matter which extension you install. Banks are the obvious case. Most Google properties are too, and Microsoft's Outlook behaves the same way, which is why Gmail, Outlook, and Google Calendar all open in their own tab rather than a frame. Some single sign-on flows, the shared login systems that let one account cover several separate apps, behave the same way, because the same deep protections that keep your session safe also keep it from working inside a frame.

A launcher cell that opens a site in its own tab isn't a downgrade from the "real" experience. It is the real experience, one click away, with the site's own login and security fully intact instead of routed through something else. TulipLot would rather say that plainly than suggest a future update might unlock Gmail, because it won't: the limits described here aren't a gap waiting to be closed, they're the same protections keeping your accounts safe everywhere else you already use them.

## Common questions

### Is bypassing X-Frame-Options safe?

Adjusting it the way a scoped browser extension does, one site at a time, inside your own browser only, is safe because of how narrow the change is. It doesn't touch the site for anyone else, it doesn't change how the site behaves for you outside that one dashboard, and it stops the moment you disable the site or remove the extension. What's genuinely risky is a general "turn off security headers everywhere" setting with no scoping at all, which is a much broader thing than what an extension like the Companion does.

### Why can't a website just fix this itself?

In a real sense, it already has: refusing to be framed is the fix, not a bug waiting to be patched. A site could switch from a blanket `DENY` to a specific guest list under `frame-ancestors`, but maintaining that list is ongoing work, and one mistake in it reopens the exact clickjacking risk the header exists to close. Plenty of sites decide the simpler, blunter setting is worth the occasional dashboard inconvenience.

### Does this break the site's own security?

No. A scoped extension changes headers only on frames that your own dashboard is loading, for sites you specifically enabled, inside your own browser. Anyone visiting that site directly, or using it on a different device, sees the exact same protections as before. Nothing about the site's actual defenses changes for anyone but you, and only inside the one tool you enabled it for.

### Will Gmail ever load in a dashboard?

Not through TulipLot, and not through any tool that plays by the same rules, because Gmail's protection isn't only the header. It's built into how its login and session behave when it isn't the top-level page in your browser. That's not a limitation TulipLot is waiting to lift; it's why Gmail is a permanent one-click launcher instead, opening in its own tab with its real login fully intact.

Most sites you add don't need any of this: they load live, on the first try, no extension and no explanation required. For the ones that do, [adding sites that refuse to be framed](/guides/add-any-site) walks through installing and enabling the TulipLot Companion, cell by cell. Haven't built a grid yet, or still sorting out how a dashboard differs from [what a browser start page is](/blog/what-is-a-browser-start-page)? [Getting started](/guides/getting-started) covers your first five minutes. And if you'd rather just see which of the three outcomes your own favorite sites land in, [create a free account](/register) and add them yourself.
