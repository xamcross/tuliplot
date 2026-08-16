# Trailing-Slash Internal Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every internal link on tuliplot.com renders with the trailing slash of its canonical URL, so crawlers and browsers reach the page without a `308` hop.

**Architecture:** A `TrailingSlashUrlSerializer` (extends Angular's `DefaultUrlSerializer`) is provided once in `app.config.ts`; every `routerLink` and programmatic navigation then serializes with a trailing slash. A pure `normalizeInternalHref` helper in the content build rewrites the plain anchors that article markdown produces. Routes, `_redirects`, canonicals, and the sitemap do not change.

**Tech Stack:** Angular 22 (`@angular/router` `UrlSerializer`), Vitest 4, `marked` 12 (content build), Node 22 pinned for `ng build`.

**Spec:** `docs/superpowers/specs/2026-08-16-trailing-slash-links-design.md`

## Global Constraints

- Work in the worktree `C:\Users\xamcr\DashDash\.claude\worktrees\seo-geo-aeo-hardening` on branch `feature/trailing-slash-links` (cut from `origin/main` `62d282d`; spec commit `aa796d9`). Run commands from that path or its `frontend/` subfolder as each step states. Never `cd` to `C:\Users\xamcr\DashDash`. Never use bare `git stash`.
- Tests: `cd frontend && npx vitest run <file>`; suite `npx vitest run` (55 files / 238 tests green at start). Build: `export PATH="$HOME/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"; npm run build` in `frontend/` (never bare `ng build`); expect 23 prerendered routes.
- Serialization rule: the path part of every serialized URL ends with `/`; root stays `/`; `?…` and `#…` follow the slash. Examples: `/guides` → `/guides/`, `/app?checkout=success` → `/app/?checkout=success`, `/guides#faq` → `/guides/#faq`, `/` → `/`, `` → `/`.
- Content rule: `normalizeInternalHref` changes only hrefs that start with `/` and not `//`; it leaves `/`, `#anchor`, `mailto:`, `http(s)://…`, and `//host` unchanged; markdown source files do not change.
- Templates and navigation calls do not change (`routerLink="/guides"` stays as written).
- Commit subjects keep the conventional-commit format; bodies are short sentences in the active voice; every commit ends with the two trailer lines:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u`.

---

## File map

| Path | Responsibility | Task |
|---|---|---|
| `frontend/src/app/core/trailing-slash-url.serializer.ts` (create) | `withTrailingSlash()` + `TrailingSlashUrlSerializer` | 1 |
| `frontend/src/app/core/trailing-slash-url.serializer.spec.ts` (create) | helper cases, parse round-trip, `routerLink` render | 1 |
| `frontend/src/app/app.config.ts` | provide the serializer | 2 |
| `frontend/src/app/app.config.spec.ts` (create) | wiring guard | 2 |
| `frontend/src/app/features/marketing/site-footer.spec.ts` | representative component with the provider | 2 |
| `frontend/scripts/content.util.mjs` + `content.util.spec.mjs` | `normalizeInternalHref` | 3 |
| `frontend/scripts/build-content.util.mjs` + `build-content.spec.mjs` | renderer uses the helper | 3 |
| `frontend/src/app/features/marketing/content.generated.ts` (regenerated) | internal hrefs gain the slash | 3 |

---

### Task 1: `TrailingSlashUrlSerializer`

**Files:**
- Create: `frontend/src/app/core/trailing-slash-url.serializer.ts`
- Create: `frontend/src/app/core/trailing-slash-url.serializer.spec.ts`

**Interfaces:**
- Produces: `withTrailingSlash(url: string): string` and `class TrailingSlashUrlSerializer extends DefaultUrlSerializer` (overrides `serialize(tree: UrlTree): string`). Task 2 imports both from `'./core/trailing-slash-url.serializer'` (from `app.config.ts`).

- [ ] **Step 1: Write the failing spec**

Create `frontend/src/app/core/trailing-slash-url.serializer.spec.ts`:

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { RouterLink, UrlSerializer, provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { TrailingSlashUrlSerializer, withTrailingSlash } from './trailing-slash-url.serializer';

describe('withTrailingSlash', () => {
  it('appends a slash to a path and keeps the root as "/"', () => {
    expect(withTrailingSlash('/guides')).toBe('/guides/');
    expect(withTrailingSlash('/blog/tuliplot-vs-toby')).toBe('/blog/tuliplot-vs-toby/');
    expect(withTrailingSlash('/guides/')).toBe('/guides/');
    expect(withTrailingSlash('/')).toBe('/');
    expect(withTrailingSlash('')).toBe('/');
  });

  it('keeps query and fragment after the slash', () => {
    expect(withTrailingSlash('/app?checkout=success')).toBe('/app/?checkout=success');
    expect(withTrailingSlash('/guides#faq')).toBe('/guides/#faq');
    expect(withTrailingSlash('/app/?checkout=success')).toBe('/app/?checkout=success');
    expect(withTrailingSlash('/?utm=x')).toBe('/?utm=x');
  });
});

describe('TrailingSlashUrlSerializer', () => {
  const s = new TrailingSlashUrlSerializer();

  it('serializes both slash forms of a parsed URL to the slash form', () => {
    expect(s.serialize(s.parse('/guides'))).toBe('/guides/');
    expect(s.serialize(s.parse('/guides/'))).toBe('/guides/');
    expect(s.serialize(s.parse('/'))).toBe('/');
    expect(s.serialize(s.parse('/app?checkout=success'))).toBe('/app/?checkout=success');
  });
});

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<a id="root" routerLink="/">Home</a><a id="guides" routerLink="/guides">Guides</a><a id="post" [routerLink]="['/blog', 'x']">Post</a>`,
})
class HostComponent {}

describe('routerLink with TrailingSlashUrlSerializer', () => {
  it('renders hrefs with a trailing slash; the root stays "/"', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
      ],
    });
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#root')?.getAttribute('href')).toBe('/');
    expect(el.querySelector('#guides')?.getAttribute('href')).toBe('/guides/');
    expect(el.querySelector('#post')?.getAttribute('href')).toBe('/blog/x/');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run (from `frontend/`): `npx vitest run src/app/core/trailing-slash-url.serializer.spec.ts`
Expected: FAIL — cannot resolve `./trailing-slash-url.serializer`.

- [ ] **Step 3: Implement**

Create `frontend/src/app/core/trailing-slash-url.serializer.ts`:

```ts
import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/**
 * Appends "/" to the path part of a serialized URL so internal links match the
 * canonical form ("/guides/" not "/guides"). The root stays "/". Query and
 * fragment follow the slash.
 */
export function withTrailingSlash(url: string): string {
  const m = /^([^?#]*)(.*)$/.exec(url)!;
  const path = m[1];
  const rest = m[2]; // "?…", "#…", or ""
  if (path === '' || path === '/') return `/${rest}`;
  return path.endsWith('/') ? `${path}${rest}` : `${path}/${rest}`;
}

/**
 * Router URL serializer: Angular's default parsing, serialized paths end with "/".
 * Cloudflare Pages answers "/guides" with a 308 to "/guides/"; with this serializer
 * every routerLink and navigation targets the canonical URL directly.
 */
export class TrailingSlashUrlSerializer extends DefaultUrlSerializer {
  override serialize(tree: UrlTree): string {
    return withTrailingSlash(super.serialize(tree));
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/app/core/trailing-slash-url.serializer.spec.ts`
Expected: PASS (4 tests). If the host-component test shows `href="/guides"` (no slash), the provider order lost to `provideRouter` — confirm the custom provider is listed AFTER `provideRouter([])` in the test's `providers` array (it is, above).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/trailing-slash-url.serializer.ts frontend/src/app/core/trailing-slash-url.serializer.spec.ts
git commit -m "feat(router): TrailingSlashUrlSerializer" -m "Serialized paths end with a slash so internal links match the canonical URL. Parsing stays Angular's default. Query and fragment follow the slash; the root stays /." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 2: Provide the serializer app-wide

**Files:**
- Modify: `frontend/src/app/app.config.ts`
- Create: `frontend/src/app/app.config.spec.ts`
- Modify: `frontend/src/app/features/marketing/site-footer.spec.ts`

**Interfaces:**
- Consumes: `TrailingSlashUrlSerializer` from Task 1.
- Produces: `appConfig.providers` contains `{ provide: UrlSerializer, useClass: TrailingSlashUrlSerializer }` placed after `provideRouter(routes)`. `app.config.server.ts` merges `appConfig`, so prerendering uses it too (no change there).

- [ ] **Step 1: Write the failing wiring guard**

Create `frontend/src/app/app.config.spec.ts`:

```ts
import { UrlSerializer } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { appConfig } from './app.config';
import { TrailingSlashUrlSerializer } from './core/trailing-slash-url.serializer';

describe('appConfig', () => {
  it('provides the TrailingSlashUrlSerializer as the router UrlSerializer', () => {
    const entry = appConfig.providers.find(
      (p) => typeof p === 'object' && p !== null && (p as { provide?: unknown }).provide === UrlSerializer,
    ) as { useClass?: unknown } | undefined;
    expect(entry?.useClass).toBe(TrailingSlashUrlSerializer);
  });
});
```

- [ ] **Step 2: Update the footer spec to the slash form with the provider**

In `frontend/src/app/features/marketing/site-footer.spec.ts`, change the imports and the test body:

```ts
import { TestBed } from '@angular/core/testing';
import { UrlSerializer, provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { SiteFooterComponent } from './site-footer.component';
import { TrailingSlashUrlSerializer } from '../../core/trailing-slash-url.serializer';

describe('SiteFooterComponent', () => {
  it('links Guides, Blog, Try, Changelog, About, Contact, Privacy, Terms in that order, with trailing slashes', () => {
    TestBed.configureTestingModule({
      imports: [SiteFooterComponent],
      providers: [provideRouter([]), { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer }],
    });
    const f = TestBed.createComponent(SiteFooterComponent);
    f.detectChanges();
    const hrefs = Array.from((f.nativeElement as HTMLElement).querySelectorAll('nav.links a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/guides/', '/blog/', '/try/', '/changelog/', '/about/', '/contact/', '/privacy/', '/terms/']);
  });
});
```

- [ ] **Step 3: Run both to see them fail**

Run: `npx vitest run src/app/app.config.spec.ts src/app/features/marketing/site-footer.spec.ts`
Expected: the config guard FAILS (`undefined` is not `TrailingSlashUrlSerializer`); the footer spec PASSES already (it carries its own provider) — that is fine; it proves the component path.

- [ ] **Step 4: Wire the provider**

In `frontend/src/app/app.config.ts`, add the imports and the provider entry directly after `provideRouter(routes),`:

```ts
import { provideRouter, UrlSerializer } from '@angular/router';
import { TrailingSlashUrlSerializer } from './core/trailing-slash-url.serializer';
```

```ts
    provideRouter(routes),
    // Internal links and navigations serialize with a trailing slash — the canonical form
    // Cloudflare Pages serves without a 308 hop. Must come after provideRouter.
    { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
```

(Replace the existing `import { provideRouter } from '@angular/router';` line with the two-name import.)

- [ ] **Step 5: Run the two files, then the suite**

Run: `npx vitest run src/app/app.config.spec.ts src/app/features/marketing/site-footer.spec.ts` → PASS.
Run: `npx vitest run` → all green. Existing component specs keep their `provideRouter([])` and their slash-less assertions; they must still pass unchanged. If any spec that imports `appConfig` breaks, report it — none does today.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/app.config.ts frontend/src/app/app.config.spec.ts frontend/src/app/features/marketing/site-footer.spec.ts
git commit -m "feat(router): provide TrailingSlashUrlSerializer app-wide" -m "routerLink hrefs and navigations now end with a slash on the client and in prerendered HTML. The footer spec proves a real component renders the slash form; a config spec guards the wiring." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 3: Internal links in article HTML

**Files:**
- Modify: `frontend/scripts/content.util.mjs`
- Modify: `frontend/scripts/content.util.spec.mjs`
- Modify: `frontend/scripts/build-content.util.mjs`
- Modify: `frontend/scripts/build-content.spec.mjs`
- Regenerate: `frontend/src/app/features/marketing/content.generated.ts`

**Interfaces:**
- Produces: `normalizeInternalHref(href: string): string` exported from `content.util.mjs`; the marked link renderer applies it to internal hrefs.

- [ ] **Step 1: Failing helper tests**

In `frontend/scripts/content.util.spec.mjs`, add `normalizeInternalHref` to the import from `./content.util.mjs` and append:

```js
describe('normalizeInternalHref', () => {
  it('adds a trailing slash to internal paths and keeps query and fragment', () => {
    expect(normalizeInternalHref('/try')).toBe('/try/');
    expect(normalizeInternalHref('/guides/premium-vs-free')).toBe('/guides/premium-vs-free/');
    expect(normalizeInternalHref('/guides/a#faq')).toBe('/guides/a/#faq');
    expect(normalizeInternalHref('/app?checkout=success')).toBe('/app/?checkout=success');
  });
  it('leaves already-slashed paths, the root, anchors, mailto, external, and protocol-relative links alone', () => {
    expect(normalizeInternalHref('/try/')).toBe('/try/');
    expect(normalizeInternalHref('/')).toBe('/');
    expect(normalizeInternalHref('#faq')).toBe('#faq');
    expect(normalizeInternalHref('mailto:hello@tuliplot.com')).toBe('mailto:hello@tuliplot.com');
    expect(normalizeInternalHref('https://developer.mozilla.org/x')).toBe('https://developer.mozilla.org/x');
    expect(normalizeInternalHref('//cdn.example/x')).toBe('//cdn.example/x');
    expect(normalizeInternalHref('')).toBe('');
  });
});
```

- [ ] **Step 2: Failing renderer tests**

Append inside the `describe('externalLinkExtension', …)` block of `frontend/scripts/build-content.spec.mjs`:

```js
  it('gives internal links a trailing slash and keeps fragments', () => {
    marked.use(externalLinkExtension());
    const html = marked.parse('[Try](/try) and [FAQ](/guides/a#faq) and [home](/)');
    expect(html).toContain('<a href="/try/">Try</a>');
    expect(html).toContain('<a href="/guides/a/#faq">FAQ</a>');
    expect(html).toContain('<a href="/">home</a>');
  });
```

Also change the expectation in the first existing test from `'<a href="/guides/x">guide</a>'` to `'<a href="/guides/x/">guide</a>'`.

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run scripts/content.util.spec.mjs scripts/build-content.spec.mjs` → FAIL (missing export; old href form).

- [ ] **Step 4: Implement the helper**

Append to `frontend/scripts/content.util.mjs` (after `isExternalHref`):

```js
/**
 * Internal links match the canonical trailing-slash URL: "/guides/x" → "/guides/x/".
 * Keeps "?…" and "#…"; leaves "/", "#anchor", "mailto:", "http(s)://…", and "//host" unchanged.
 */
export function normalizeInternalHref(href) {
  const s = String(href ?? '');
  if (!s.startsWith('/') || s.startsWith('//')) return s;
  const m = /^([^?#]*)(.*)$/.exec(s);
  const path = m[1];
  const rest = m[2];
  if (path === '/' || path.endsWith('/')) return s;
  return `${path}/${rest}`;
}
```

- [ ] **Step 5: Use it in the renderer**

In `frontend/scripts/build-content.util.mjs`, import it and apply it before escaping:

```js
import { isExternalHref, normalizeInternalHref, xmlEscape } from './content.util.mjs';
```

and inside `link(href, title, text)` replace `const safeHref = xmlEscape(href);` with:

```js
        const external = isExternalHref(href);
        const safeHref = xmlEscape(external ? href : normalizeInternalHref(href));
        const titleAttr = title ? ` title="${title}"` : '';
        const ext = external ? ' target="_blank" rel="noopener"' : '';
```

(and delete the old `const ext = isExternalHref(href) ? …` line so `isExternalHref` runs once). Update the file's header comment: `// marked extension: external links open in a new tab with rel="noopener"; internal links get the canonical trailing slash.`

- [ ] **Step 6: Run to green, regenerate, inspect**

Run: `npx vitest run scripts/content.util.spec.mjs scripts/build-content.spec.mjs` → PASS.
Run: `node scripts/build-content.mjs`. Then count internal hrefs in the generated file (quotes are JSON-escaped): `grep -o 'href=\\"/[^\\]*\\"' src/app/features/marketing/content.generated.ts | sort | uniq -c | sort -rn | head -20` — every path must end with `/` (or `/#…`); zero slash-less internal hrefs remain: `grep -c 'href=\\"/[a-z][^\\/]*\\"' src/app/features/marketing/content.generated.ts` → `0`.
`public/llms.txt`, `public/llms-full.txt`, `public/sitemap.xml` are unchanged (`git status --short frontend/public` empty).
Run: `npx vitest run` → all green.

- [ ] **Step 7: Commit**

```bash
git add frontend/scripts/content.util.mjs frontend/scripts/content.util.spec.mjs frontend/scripts/build-content.util.mjs frontend/scripts/build-content.spec.mjs frontend/src/app/features/marketing/content.generated.ts
git commit -m "feat(content): internal article links render with the canonical trailing slash" -m "normalizeInternalHref rewrites root-relative hrefs at build time; markdown sources do not change. External links keep target and rel." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u"
```

---

### Task 4: Build gate, PR, post-deploy checks

**Files:** none new (fixes go to the owning task's files).

- [ ] **Step 1: Suite and build**

From `frontend/` (Git Bash): `npx vitest run` → green. Then
`export PATH="$HOME/.dashdash-tooling/node-v22.22.3-win-x64:$PATH"; node -v; npm run build` → `v22.22.3`, "Prerendered 23 static routes", exit 0.

- [ ] **Step 2: Inspect the prerendered HTML**

```bash
cd dist/frontend/browser
grep -o 'href="/[^"]*"' index.html | sort -u
grep -o 'href="/[^"]*"' blog/tuliplot-vs-toby/index.html | sort -u
grep -c 'href="/[a-z][^"/]*"' index.html blog/tuliplot-vs-toby/index.html guides/why-sites-wont-load/index.html
```
Expected: every href is `/` or ends with `/` (or `/#…`); the last command prints `0` for each file (no slash-less internal href). Anything else: fix in the owning task's file, add a test, commit with a `fix(...)` subject, and repeat Step 1.

- [ ] **Step 3: Push and open the PR (needs the owner's go-ahead)**

```bash
git push -u origin feature/trailing-slash-links
gh pr create --base main --head feature/trailing-slash-links --title "feat(router): internal links carry the canonical trailing slash" --body-file - <<'EOF'
Implements docs/superpowers/specs/2026-08-16-trailing-slash-links-design.md (plan: docs/superpowers/plans/2026-08-16-trailing-slash-links.md).

Every internal link rendered without a trailing slash first hits a 308 (Search Console: 15 URLs under "Page with redirect"). Now:
- `TrailingSlashUrlSerializer` (provided in app.config) makes every routerLink and navigation serialize `/path/`; root stays `/`; query and fragment follow the slash.
- The content build rewrites internal markdown links to the slash form (`normalizeInternalHref`); sources unchanged.
- No change to routes, `_redirects` (trailing-slash client routes already return 200), canonicals, or the sitemap.

Verification: vitest green; ng build 23 routes; prerendered home and article pages contain no slash-less internal href.
Post-deploy: signed-in hard reload of /app/ and /app/settings/, a Google sign-in round trip, /app?checkout=success still works; Search Console "Page with redirect" stops growing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01J7vfmH1iQkJGcby4WJRx5u
EOF
gh pr checks --watch
```

- [ ] **Step 4: After merge and auto-deploy (about two minutes)**

```bash
curl -s https://tuliplot.com/ | grep -o 'href="/[^"]*"' | sort -u
curl -s https://tuliplot.com/blog/tuliplot-vs-toby/ | grep -o 'href="/[^"]*"' | sort -u
curl -s -o /dev/null -w '%{http_code}\n' https://tuliplot.com/app/
```
Expected: only `/` and slash-terminated hrefs; `200`. Then, in a browser while signed in: hard reload `https://tuliplot.com/app/` and `/app/settings/`; run a Google sign-in; open `/app?checkout=success` and confirm the checkout banner shows. In Search Console, no action: the "Page with redirect" examples age out.

---

## Self-review notes

- Spec coverage: §1 serializer → Task 1 + Task 2 (provider); §2 content links → Task 3; §3 tests → each task; §4 verification → Task 4. `_redirects`, routes, sitemap untouched as the spec says.
- Names: `withTrailingSlash`, `TrailingSlashUrlSerializer` (Task 1) used in Task 2; `normalizeInternalHref` (Task 3) used in `build-content.util.mjs`; provider placed after `provideRouter` in both the spec test and `app.config.ts`.
- Placeholder scan: none; every step carries its code and expected output.
