# Trailing-slash internal links — design

Date: 2026-08-16
Status: draft for owner review
Scope: bounded — one Angular provider, one content-build helper, test updates. No route, `_redirects`, or content-wording change.

## The problem

The canonical URL of every public page ends with a slash (`https://tuliplot.com/guides/`), set in Wave 1 (2026-08-01): canonicals, the sitemap, and the prerendered file layout (`guides/index.html`) all use that form, and Cloudflare Pages answers the slash-less form with a `308` to it.

Every internal link on the site still points at the slash-less form:

- Angular `routerLink` renders `href="/guides"`, `href="/blog/tuliplot-vs-toby"`, `href="/try"` — header, footer, hero buttons, "Keep reading" lists, cards. Verified on the live home page and inside a live article on 2026-08-16.
- Article markdown links render as plain anchors `<a href="/try">`, `<a href="/guides/premium-vs-free">` — about 50 occurrences across the 13 articles.

Consequence, visible in Search Console on 2026-08-16: 15 slash-less URLs (plus the three `http`/`www` host variants) sit under "Page with redirect", last crawled 2–8 August. Googlebot follows a nav or body link, gets the `308`, then fetches the canonical page. Each internal hop costs a crawl request on a brand-new domain with a small crawl budget, and the report bucket never empties. The `http`/`www` variants are normal and stay.

## What does not change

- Canonical URLs, the sitemap, `robots.txt`, `_redirects` (all trailing-slash client routes already answer `200`: `/app/`, `/app/upgrade/`, `/app/settings/`, `/login/`, `/register/`, `/app/?checkout=success` — checked live 2026-08-16).
- The route table (`app.routes.ts`, `app.routes.server.ts`) and every `routerLink` string in templates. Templates keep writing `routerLink="/guides"`; the serializer adds the slash at render time.
- Programmatic navigation calls (`navigateByUrl('/app')`, `createUrlTree(['/login'])`, `navigateByUrl('/')`) — unchanged source; the URL bar shows the slash form after navigation.
- External redirect targets that land on the site (`OAUTH2_SUCCESS_URL=https://tuliplot.com/app`, the billing return URL `/app?checkout=success`): the request still hits the slash-less URL, `_redirects` serves the shell, the router reads `?checkout=success` as before, and the first client navigation rewrites the address bar to `/app/?checkout=success`.
- Article wording. Only the rendered `href` values change.

## Design

### 1. `TrailingSlashUrlSerializer` (Angular)

New file `frontend/src/app/core/trailing-slash-url.serializer.ts`:

```ts
import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/** Appends "/" to the path part of a serialized URL: "/guides" → "/guides/"; "/" stays "/". */
export function withTrailingSlash(url: string): string {
  const m = /^([^?#]*)(.*)$/.exec(url)!;
  const path = m[1];
  const rest = m[2];              // "?…", "#…", or ""
  if (path === '' || path === '/') return `/${rest}`;
  return path.endsWith('/') ? `${path}${rest}` : `${path}/${rest}`;
}

/** Router URL serializer: same parsing as Angular's default, serialized paths end with "/". */
export class TrailingSlashUrlSerializer extends DefaultUrlSerializer {
  override serialize(tree: UrlTree): string {
    return withTrailingSlash(super.serialize(tree));
  }
}
```

`frontend/src/app/app.config.ts` adds `{ provide: UrlSerializer, useClass: TrailingSlashUrlSerializer }` to `providers`. The server config merges `appConfig`, so prerendered HTML carries the same hrefs as the client.

Behaviour:

- `routerLink="/guides"` → `href="/guides/"`; `routerLink="/"` → `href="/"`; `[routerLink]="['/blog', slug]"` → `/blog/<slug>/`.
- Query and fragment stay after the slash: `/app/?checkout=success`, `/guides/#faq`.
- `parse()` is Angular's default: `/guides/` and `/guides` both resolve to the `guides` route (the router already accepts the slash form on every hard load of a prerendered page).
- `routerLinkActive` keeps working: it compares URL trees, not strings.
- Matrix parameters (`;key=value`) are not used on this site; the serializer does not special-case them.

### 2. Internal links in article HTML (content build)

`frontend/scripts/content.util.mjs` gains a pure helper:

```js
/** "/guides/x" → "/guides/x/"; keeps "?…"/"#…"; leaves "/", external, anchor-only, and mailto links alone. */
export function normalizeInternalHref(href) {
  const s = String(href ?? '');
  if (!s.startsWith('/') || s.startsWith('//')) return s;   // external, "#anchor", "mailto:", "//host"
  const m = /^([^?#]*)(.*)$/.exec(s);
  const path = m[1];
  const rest = m[2];
  if (path === '/' || path.endsWith('/')) return s;
  return `${path}/${rest}`;
}
```

Rules: applies only to hrefs that start with `/` and not `//`; the path part gains a trailing slash unless it already ends with `/`; `?` and `#` parts are preserved; `#faq`, `mailto:`, and `http(s)://` are returned unchanged.

`frontend/scripts/build-content.util.mjs` `externalLinkExtension().renderer.link` calls `normalizeInternalHref(href)` for internal links (external links keep the current `xmlEscape` + `target`/`rel` path). Result in the rendered HTML: `<a href="/try/">`, `<a href="/guides/premium-vs-free/">`. The markdown source files do not change.

`llms.txt` and `llms-full.txt` are not touched by this change (they carry markdown, not rendered HTML).

### 3. Tests

- `trailing-slash-url.serializer.spec.ts` (new): `withTrailingSlash` for `''`, `/`, `/guides`, `/guides/`, `/app?checkout=success`, `/guides#faq`; the serializer round-trips `parse('/guides/')` and `parse('/guides')` to `/guides/`; a `TestBed` with `provideRouter` plus the provider renders `routerLink="/guides"` as `href="/guides/"` and `routerLink="/"` as `href="/"`.
- `app.config.spec.ts` (new): `appConfig.providers` contains `{ provide: UrlSerializer, useClass: TrailingSlashUrlSerializer }` — the wiring guard.
- Component specs configure their own `provideRouter([])` and therefore keep Angular's default serializer; their existing slash-less assertions stay valid and unchanged. One representative component spec, `site-footer.spec.ts`, adds the provider and asserts the eight slash-terminated hrefs, which proves a real component renders the new form.
- `content.util.spec.mjs`: `normalizeInternalHref` cases (internal path, path with query, path with fragment, root, external, `#anchor`, `mailto:`, protocol-relative `//host`).
- `build-content.spec.mjs`: `[Try](/try)` renders `<a href="/try/">Try</a>`; `[x](/guides/a#faq)` renders `href="/guides/a/#faq"`; the existing external-link assertions stay green.
- Full suite green; `npm run build` (pinned Node 22) prerenders 23 routes.

### 4. Verification after deploy

- `curl -s https://tuliplot.com/ | grep -o 'href="/[^"]*"' | sort -u` shows only `/` and slash-terminated paths.
- `curl -s https://tuliplot.com/blog/tuliplot-vs-toby/ | grep -o 'href="/[^"]*"' | sort -u` shows the same for body links (e.g. `/try/`, `/guides/premium-vs-free/`).
- A signed-in hard reload of `https://tuliplot.com/app/` and `https://tuliplot.com/app/settings/` works; a Google sign-in round trip lands on the dashboard; `/app?checkout=success` still shows the checkout banner.
- In Search Console, after the next crawls, the "Page with redirect" examples stop growing (existing entries age out; they are not errors).

## Out of scope

- Serving both URL forms with `200` (would create duplicate content) or changing the canonical form to slash-less.
- Absolutizing internal links in `llms-full.txt` (deferred from the hardening review; a later small change can reuse `normalizeInternalHref`).
- Any change to `_redirects` (verified unnecessary), to the sitemap, or to backend redirect URLs.
