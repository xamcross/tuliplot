---
title: Gmail and Google Calendar side by side
slug: gmail-and-calendar-side-by-side
description: Google's own side-panel, a second window, and a dashboard launcher — three honest ways to keep mail and calendar in view at once, including what Google won't let you embed.
date: 2026-08-02
category: Tips
---
# Gmail and Google Calendar side by side

## The short answer

Short answer: you can't put Gmail and Google Calendar inside the same page, because Google won't let either one load inside a frame on someone else's site. "Side by side" here means a panel, a second window, or a launcher, not two panes stitched into one webpage. Three options get you there, and each is worth knowing before you pick one.

## Option 1: Gmail's built-in side panel

Google already built this one. Open Gmail on the web and you'll find a side panel that shows your calendar without leaving your inbox. It's free, it's already there, and it's the first thing worth trying before you install anything else.

The catch is size and scope. The panel is narrow, built for a glance rather than planning a full week. And it's Gmail-first: open Calendar on its own and there's no equivalent panel showing your inbox back. It solves the problem from one direction only.

## Option 2: two windows, snapped

The other free option is your operating system. Snap Gmail to one half of the screen and Calendar to the other: Windows Snap or macOS Split View, both a drag or a keyboard shortcut away. Nothing to install, and you get two full, unrestricted windows instead of one narrow panel.

The tradeoff is that it doesn't stick. Close the windows, restart your computer, or just open a fresh browser session, and the split is gone. It's a real fix for right now, rebuilt from scratch the next time you need it.

## Option 3: a dashboard with launcher cells

TulipLot takes a different approach: a fixed grid where Gmail and Calendar each get their own cell, in the same spot every time you open it. Neither one loads live inside that cell. Click it, and it opens the real Gmail or the real Calendar in its own browser tab, exactly as if you'd typed the address yourself.

That's not embedded mail, and it isn't pretending to be. What you get instead is one predictable place to click from, sitting next to cells that do load live: a Trello board, a docs page, whatever else you check in the same few minutes. Gmail and Calendar become two fixed spots in your daily lineup instead of two tabs buried among the rest.

## Why neither one embeds

Gmail and Calendar refuse to load inside anyone else's page on purpose. It's the same defense banks use, aimed at an attack called clickjacking, where a hidden frame tricks you into clicking something you never meant to click. Google isn't being difficult here; it's protecting the account that guards your email and your schedule.

That protection runs deeper than a header any extension could strip. [Why some sites won't load in a dashboard](/guides/why-sites-wont-load) covers the full mechanics, but the short version is that Gmail checks whether it's the top-level page in your browser, not just whether a header allows framing. No tool gets around that, and none honestly should try.

## Questions

### Can I put Gmail inside a dashboard cell?

No. Gmail sends back an instruction telling every browser to refuse displaying it inside another page, with no exception for any dashboard, extension, or tool. A Gmail cell always opens the real Gmail in its own tab instead of loading it live, and that's true everywhere, not just in TulipLot.

### Does the TulipLot Companion unlock Gmail?

No. The Companion is a free extension that strips embedding headers for sites blocked only at that level, which is what unlocks catalog sites like Notion once you turn it on. Gmail's protection goes past headers into how its login and session behave outside a top-level page, and no extension reaches that deep. Gmail stays a one-click launcher whether or not the Companion is installed.

Want both in view without hunting through tabs? [Create a free TulipLot account](/register), put Gmail and Calendar in fixed cells next to the tools you actually work in, and see [more ways to view multiple sites at once](/blog/view-multiple-websites-at-once) if split screen and side panels aren't cutting it.
