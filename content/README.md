# DashDash content

Markdown here is compiled at build time into
`frontend/src/app/features/marketing/content.generated.ts` by
`frontend/scripts/build-content.mjs`.

- `guides/*.md` → the Guides section (sorted by `order`, then title).
- `blog/*.md`   → the Blog section (sorted by `date`, newest first).

## Frontmatter

```
---
title: Human title
slug: url-slug            # optional; defaults to the filename
description: One-sentence summary for cards + SEO.
date: 2026-07-10          # YYYY-MM-DD
category: Basics
order: 1                  # guides only; controls list order
---
```

## Regenerate after editing

```
cd frontend && npm run generate:content
```

`npm run build` also regenerates automatically (via the `prebuild` script).

## AdSense readiness

Google AdSense review expects a substantial, original content site. Target
**15–25 published guides/blog pages** before submitting for review. This repo
ships 5 as scaffolding — expand the library here; the pipeline and prerender
routes pick up new files with no code changes.
