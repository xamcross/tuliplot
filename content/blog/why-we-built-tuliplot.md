---
title: Why we built TulipLot
slug: why-we-built-tuliplot
description: Tab overload is a workflow problem, not a willpower problem. Why we think a fixed grid beats a wall of tabs — and what we deliberately left out.
date: 2026-08-01
category: Product
---
# Why we built TulipLot

## The tab pile

You know the pile. It starts with a couple of tabs in the morning and by the afternoon it's a wall of them, and somewhere in there is the doc you were editing earlier, except now it's drifted somewhere to the left of where you last saw it, next to another tab from the same site that you opened because you couldn't find the first one.

The favicons blur together after a while. You hover, wait for the tooltip, hover the next one, wait again. You've got a duplicate of the same dashboard open because you forgot you already had it. The tab you actually need is the one that always seems to have wandered off, and you spend stray moments, over and over, just relocating things you already opened once.

None of that is a discipline problem. Nobody fails at tabs. The browser tab bar was built to hold pages you're skimming for a minute and then closing, not the handful of apps you live inside all day, every day, for months on end. Ask it to be a home for your workflow and it's going to sag under the weight, no matter how careful you are about closing things.

## Why the usual fixes didn't stick for us

We tried the standard advice, same as you probably have. Tab groups color-code the pile into sections, which helps for about a day, until the sections themselves start multiplying and you're back to hunting, just within a smaller haystack. Tab managers and tree-style extensions impose more structure on top, but the structure lives inside the same bar, competing for the same sliver of horizontal space. It's still a pile. It's just a pile with labels.

Splitting apps across separate browser windows helps for exactly the apps you keep in view, and fragments everything else. Now you're alt-tabbing between windows instead of tabs, which is the same problem wearing a different hat. And more monitors don't solve it either, not really. A second or third screen just gives the pile more room to spread out. You still can't find the one tab you need, you can just fail to find it across a wider desk.

Every fix we tried treated the symptom. The tabs kept accumulating because nothing changed about where things lived.

## A fixed place for everything

So we stopped trying to organize the pile and got rid of it instead. TulipLot turns one browser tab into a 3×2 grid: six fixed cells, each holding one app, each cell staying exactly where you put it.

The bet is on spatial memory over search. You don't search for your keys every morning, because they live in the bowl by the door. Once you decide mail goes top-left, it stays top-left, tomorrow and the week after. You stop reading labels and start just reaching for where things are. Drag any two cells to swap them if your workflow changes, and the grid still stays fixed at six, so there's no fresh pile to manage in its place.

That's the whole trade. You give up the infinite, anything-goes tab bar for six spots you actually remember. For the handful of apps most of us live in daily, that's a fair trade to make.

## Built for the real web

Here's the part we won't dress up: a lot of the web doesn't want to be put in a box like this, and that's the site's call to make. Some sites send an explicit signal telling browsers not to frame them elsewhere, full stop. That's a real security choice by real teams, and when a site refuses outright like that, TulipLot isn't in the business of overriding it.

What we can do is be honest about which case you're in, cell by cell. Add a site and one of three things happens. Plenty of the catalog, and plenty of custom HTTPS URLs, just embed and load live right there in the grid. Some sites need a nudge: install the free TulipLot Companion extension once, then flip it on for that specific site, and the cell unlocks. It only touches the sites you explicitly enable, one at a time, and it isn't a bypass for everything. A handful of sites, Gmail and Google Calendar are the common examples, stay outside the grid no matter what you enable. The Companion doesn't change that. For those, the cell becomes a one-click launcher: click it, and the app opens in its own tab the way it always has.

We'd rather show you which of those three is true the moment you add a site than fake an embed that breaks the first time you click something inside it.

## What we deliberately left out

We left things out on purpose, and we want to say which, because the constraint is the actual point.

The grid is fixed at 3×2. No resizing panes, no dragging the borders wider, no seventh cell you unlock by rearranging harder. Six is the number.

There are no tabs inside a cell either. Each cell holds one app, not a stack of them. Opening a second tab inside a cell just rebuilds the pile you came here to leave, one cell at a time, and we're not interested in shipping that.

And there's no feed. No aggregated timeline pulling content from all six apps into one scroll. TulipLot shows you where your apps live. It doesn't try to read them for you.

Every one of those is a deliberate no, not a missing feature. A dashboard that does everything is just a tab bar with worse ergonomics.

## Where it's going

We're still early, and the roadmap gets shaped by what people actually run into, not by what looks good on a features page. If you want to see the grid in the shape other people have already found useful, we wrote up [five ways to lay out a productive dashboard](/blog/dashboard-productivity-tips) with real cell-by-cell examples.

If you've got five minutes, our [getting started guide](/guides/getting-started) walks the whole setup, first app to sixth cell. And if something about TulipLot doesn't fit the way you actually work, or you've got an idea for what should, we'd rather hear it than guess. Reach us through [About](/about).

Otherwise, the fastest way to see whether the fixed-grid bet pays off for you is to try it: [create a free account](/register), no credit card, and put your first five apps somewhere they'll actually stay.
