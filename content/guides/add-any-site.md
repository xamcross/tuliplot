---
title: Adding sites that refuse to be framed
slug: add-any-site
description: Some sites block embedding. Here is how the TulipLot Chrome companion unlocks them safely.
date: 2026-06-08
category: Advanced
order: 2
---
# Adding sites that refuse to be framed

Many popular sites send headers (`X-Frame-Options`, `Content-Security-Policy:
frame-ancestors`) that stop them from loading inside another page. TulipLot
handles this gracefully.

## Detecting a blocked site

When a cell fails to load, TulipLot shows a **needs extension** or **open in a
tab** state instead of a broken frame.

## Installing the Chrome companion

The optional TulipLot companion is a Chrome MV3 extension. It strips
frame-blocking headers **only for frames inside your dashboard**, scoped to the
`tuliplot.com` origin, and only for sites you explicitly allow.

1. Install the companion from the Chrome Web Store.
2. When a cell needs it, click **Allow this site** — Chrome asks for permission
   for that specific site.
3. The cell reloads and composites into your grid.

## What still cannot be embedded

Major provider logins (Google, Microsoft, Meta) refuse to be framed even with
headers stripped, and some cookies only work in a top-level window. For those,
TulipLot offers **open in a real window**. This is expected — the companion is
an unlock, not a guarantee.
