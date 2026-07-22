# DNR header-strip verification (manual)

Automated tests confirm the *shape* of `rules.json`. This procedure confirms the
rule actually removes `X-Frame-Options` and `Content-Security-Policy` for frames
initiated by `tuliplot.com`, and only for those.

## Prerequisites

- Chrome (or Chromium) with Developer Mode enabled at `chrome://extensions`.
- The `extension/` folder loaded via **Load unpacked**.

## Test page

Save this as `dnr-harness.html` and serve it from a host that resolves as
`tuliplot.com` (add `127.0.0.1 tuliplot.com` to your hosts file and serve over a
local TLS proxy, or run against the deployed `https://tuliplot.com`). The frame
target is a site that sends `X-Frame-Options: SAMEORIGIN`.

```html
<!doctype html>
<title>DNR harness</title>
<h1>DNR harness (must be loaded as tuliplot.com)</h1>
<iframe src="https://www.github.com/" width="600" height="400"></iframe>
```

## Steps

1. **Baseline (extension disabled).** Disable TulipLot Companion at
   `chrome://extensions`, reload the harness. Expected: the iframe is blank / the
   DevTools Console shows `Refused to display 'https://www.github.com/' in a
   frame because it set 'X-Frame-Options' to 'sameorigin'`.
2. **Grant host access.** Enable the extension. In the TulipLot app, add GitHub
   and approve the per-site permission prompt (or, for this harness, grant
   `github.com` at `chrome://extensions` → TulipLot Companion → *Site access*).
3. **With extension enabled.** Reload the harness. Expected: the iframe renders
   GitHub. In DevTools → Network, select the `github.com` document request; the
   **Response Headers** no longer list `x-frame-options` or
   `content-security-policy`.
4. **Scope check (negative).** Open `https://www.github.com/` in a normal tab
   with an inner iframe of another XFO site (a page NOT on `tuliplot.com`).
   Expected: headers are **still present** — the rule only matches sub-frames
   whose `initiatorDomains` is `tuliplot.com`, so ordinary browsing is
   unaffected.

## Recording results

Log each site tested and the before/after outcome into
`docs/compatibility-matrix.md` (maintained in Task 7). Sites that still refuse to
frame after headers are stripped (major-provider logins, service-worker/PWA
sites) belong in the `refuses-frame` / `needs-ext` columns there.
