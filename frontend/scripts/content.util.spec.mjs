import { describe, it, expect } from 'vitest';
import { splitFrontmatter, readingMinutes, stripLeadingH1, sitemapXml, xmlEscape, extractFaq, isRealIsoDate, validateDates, validateSeoTitle, SEO_TITLE_MAX, isExternalHref, normalizeInternalHref, llmsTxt, llmsFullTxt, parseChangelog } from './content.util.mjs';

describe('splitFrontmatter', () => {
  it('parses frontmatter keys and returns the body', () => {
    const raw = '---\ntitle: Hello World\nslug: hello\n---\n# Body\nsome text';
    const { data, body } = splitFrontmatter(raw);
    expect(data.title).toBe('Hello World');
    expect(data.slug).toBe('hello');
    expect(body.trim()).toBe('# Body\nsome text');
  });

  it('handles CRLF line endings and quoted values', () => {
    const raw = '---\r\ntitle: "Quoted Value"\r\norder: 3\r\n---\r\nHi there';
    const { data, body } = splitFrontmatter(raw);
    expect(data.title).toBe('Quoted Value');
    expect(data.order).toBe('3');
    expect(body.trim()).toBe('Hi there');
  });

  it('returns empty data when there is no frontmatter', () => {
    const { data, body } = splitFrontmatter('just text, no frontmatter');
    expect(data).toEqual({});
    expect(body).toBe('just text, no frontmatter');
  });
});

describe('readingMinutes', () => {
  it('is at least 1 minute for short text', () => {
    expect(readingMinutes('a b c')).toBe(1);
  });

  it('scales roughly with word count (~200 wpm)', () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ');
    expect(readingMinutes(words)).toBe(2);
  });
});

describe('stripLeadingH1', () => {
  it('removes a leading ATX h1 and following blank lines', () => {
    expect(stripLeadingH1('# Title\n\nBody text.')).toBe('Body text.');
  });

  it('leaves bodies without a leading h1 untouched', () => {
    expect(stripLeadingH1('Body first.\n\n## Section')).toBe('Body first.\n\n## Section');
  });

  it('only strips the first h1, not later ones', () => {
    expect(stripLeadingH1('# Title\n\nText\n# Not stripped')).toBe('Text\n# Not stripped');
  });
});

describe('sitemapXml', () => {
  it('renders loc with optional lastmod', () => {
    const xml = sitemapXml([
      { loc: 'https://tuliplot.com/', lastmod: '2026-08-01' },
      { loc: 'https://tuliplot.com/guides/getting-started/', lastmod: '2026-06-01' },
      { loc: 'https://tuliplot.com/x/' },
    ]);
    expect(xml).toContain('<url><loc>https://tuliplot.com/</loc><lastmod>2026-08-01</lastmod></url>');
    expect(xml).toContain('<url><loc>https://tuliplot.com/guides/getting-started/</loc><lastmod>2026-06-01</lastmod></url>');
    expect(xml).toContain('<url><loc>https://tuliplot.com/x/</loc></url>');
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset/);
  });
});

describe('xmlEscape', () => {
  it('escapes ampersand, angle brackets, and quotes', () => {
    expect(xmlEscape('a&b<c>"d"')).toBe('a&amp;b&lt;c&gt;&quot;d&quot;');
  });

  it('leaves clean strings untouched', () => {
    expect(xmlEscape('https://tuliplot.com/guides/x/')).toBe('https://tuliplot.com/guides/x/');
  });
});

describe('sitemapXml escaping', () => {
  it('escapes reserved characters in loc', () => {
    const xml = sitemapXml([{ loc: 'https://tuliplot.com/a&b/', lastmod: '2026-08-01' }]);
    expect(xml).toContain('<loc>https://tuliplot.com/a&amp;b/</loc>');
  });
});

describe('isRealIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(isRealIsoDate('2026-08-02')).toBe(true);
  });
  it('rejects wrong shapes and impossible dates', () => {
    expect(isRealIsoDate('2026-8-2')).toBe(false);
    expect(isRealIsoDate('2026-13-45')).toBe(false);
    expect(isRealIsoDate('2026-02-30')).toBe(false);
    expect(isRealIsoDate('')).toBe(false);
    expect(isRealIsoDate(undefined)).toBe(false);
  });
});

describe('validateDates', () => {
  it('returns date and updated when both are valid and ordered', () => {
    expect(validateDates({ date: '2026-08-02', updated: '2026-08-15' }, 'x.md')).toEqual({ date: '2026-08-02', updated: '2026-08-15' });
  });
  it('returns only date when updated is absent', () => {
    expect(validateDates({ date: '2026-08-02' }, 'x.md')).toEqual({ date: '2026-08-02', updated: undefined });
  });
  it('throws on a missing or impossible date', () => {
    expect(() => validateDates({}, 'x.md')).toThrow(/x\.md.*date/);
    expect(() => validateDates({ date: '2026-13-45' }, 'x.md')).toThrow(/x\.md.*date/);
  });
  it('throws on an invalid updated or one before date', () => {
    expect(() => validateDates({ date: '2026-08-02', updated: 'soon' }, 'x.md')).toThrow(/updated/);
    expect(() => validateDates({ date: '2026-08-02', updated: '2026-08-01' }, 'x.md')).toThrow(/before/);
  });
});

describe('validateSeoTitle', () => {
  it('passes undefined and empty through as undefined', () => {
    expect(validateSeoTitle(undefined, 'x.md')).toBeUndefined();
    expect(validateSeoTitle('', 'x.md')).toBeUndefined();
  });
  it('returns a title at or under the limit and throws above it', () => {
    const ok = 'a'.repeat(SEO_TITLE_MAX);
    expect(validateSeoTitle(ok, 'x.md')).toBe(ok);
    expect(() => validateSeoTitle('a'.repeat(SEO_TITLE_MAX + 1), 'x.md')).toThrow(/x\.md.*seoTitle.*49/);
  });
});

describe('extractFaq', () => {
  it('pairs question headings with the paragraph that follows', () => {
    const body = [
      '## Questions',
      '',
      '### Can I switch back?',
      '',
      'Yes, any time, in either direction.',
      '',
      '### Is there a trial?',
      '',
      'Free is the trial. No time limit.',
      '',
    ].join('\n');
    expect(extractFaq(body)).toEqual([
      { q: 'Can I switch back?', a: 'Yes, any time, in either direction.' },
      { q: 'Is there a trial?', a: 'Free is the trial. No time limit.' },
    ]);
  });

  it('ignores h3s that are not questions', () => {
    expect(extractFaq('### Installing the thing\n\nDo it like this.\n')).toEqual([]);
  });

  it('strips inline markdown from questions and answers', () => {
    expect(extractFaq('### Is **this** safe?\n\nYes — see [the guide](/guides/x) for detail.\n'))
      .toEqual([{ q: 'Is this safe?', a: 'Yes — see the guide for detail.' }]);
  });

  it('returns an empty array when there are no h3s', () => {
    expect(extractFaq('## Heading\n\nJust prose.\n')).toEqual([]);
  });
});

describe('isExternalHref', () => {
  it('is true for http(s) hosts other than tuliplot.com', () => {
    expect(isExternalHref('https://developer.mozilla.org/en-US/docs/Web/HTTP')).toBe(true);
    expect(isExternalHref('http://example.com')).toBe(true);
    expect(isExternalHref('https://tuliplot.com.evil.example/')).toBe(true);
  });
  it('is false for tuliplot.com, www.tuliplot.com, relative paths, anchors, and mailto', () => {
    expect(isExternalHref('https://tuliplot.com/guides/')).toBe(false);
    expect(isExternalHref('https://www.tuliplot.com/')).toBe(false);
    expect(isExternalHref('/guides/add-any-site')).toBe(false);
    expect(isExternalHref('#faq')).toBe(false);
    expect(isExternalHref('mailto:hello@tuliplot.com')).toBe(false);
  });
});

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

const site = {
  name: 'TulipLot', url: 'https://tuliplot.com/', contactUrl: 'https://tuliplot.com/contact/', premiumMonthlyUsd: '4',
  sentence: 'TulipLot is a browser dashboard that shows up to six live websites side by side in a fixed 3×2 grid, in one browser tab.',
};

describe('llmsTxt', () => {
  it('renders the header, facts, and one line per doc under Guides, Blog, Pages, then Contact', () => {
    const txt = llmsTxt({
      site,
      guides: [{ title: 'Getting started', url: 'https://tuliplot.com/guides/getting-started/', description: 'First grid.' }],
      posts: [{ title: 'Vs Toby', url: 'https://tuliplot.com/blog/tuliplot-vs-toby/', description: 'Compare.' }],
      pages: [{ title: 'Home', url: 'https://tuliplot.com/', description: site.sentence }],
    });
    const lines = txt.split('\n');
    expect(lines[0]).toBe('# TulipLot');
    expect(lines[2]).toBe(`> ${site.sentence}`);
    expect(txt).toContain('## Facts\n- Try: 2 usable cells, no account. Free: 5 usable cells + 1 ad cell, $0. Premium: 6 cells, no ad, $4/month.');
    expect(txt).toContain('## Guides\n- [Getting started](https://tuliplot.com/guides/getting-started/): First grid.');
    expect(txt).toContain('## Blog\n- [Vs Toby](https://tuliplot.com/blog/tuliplot-vs-toby/): Compare.');
    expect(txt).toContain('## Pages\n- [Home](https://tuliplot.com/): ');
    expect(txt.trimEnd().endsWith('## Contact\n- https://tuliplot.com/contact/')).toBe(true);
    const order = ['## Facts', '## Guides', '## Blog', '## Pages', '## Contact'].map((h) => txt.indexOf(h));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('llmsFullTxt', () => {
  it('renders the header, then each article with source, dates, and the body', () => {
    const txt = llmsFullTxt({
      site,
      guides: [{ title: 'G', url: 'https://tuliplot.com/guides/g/', date: '2026-08-01', markdown: 'Guide body.' }],
      posts: [{ title: 'P', url: 'https://tuliplot.com/blog/p/', date: '2026-08-02', updated: '2026-08-15', markdown: 'Post body.\n\n## Section' }],
    });
    expect(txt.startsWith('# TulipLot\n\n> ')).toBe(true);
    expect(txt).toContain('# G\nSource: https://tuliplot.com/guides/g/\nPublished: 2026-08-01\n\nGuide body.\n');
    expect(txt).toContain('# P\nSource: https://tuliplot.com/blog/p/\nPublished: 2026-08-02\nUpdated: 2026-08-15\n\nPost body.\n\n## Section\n');
    expect(txt.indexOf('# G')).toBeLessThan(txt.indexOf('# P'));
  });
});

describe('parseChangelog', () => {
  const body = ['## 2026-08-15 — Newest', '', '- a', '', '## 2026-08-02 — Older', '', 'text', ''].join('\n');
  it('splits entries newest-first with date, title, and markdown, and reports newest', () => {
    const r = parseChangelog(body);
    expect(r.newest).toBe('2026-08-15');
    expect(r.entries.map((e) => e.date)).toEqual(['2026-08-15', '2026-08-02']);
    expect(r.entries[0]).toEqual({ date: '2026-08-15', title: 'Newest', markdown: '- a' });
    expect(r.entries[1].markdown).toBe('text');
  });
  it('throws on a heading without the date — title shape', () => {
    expect(() => parseChangelog('## Just a title\n\nx')).toThrow(/YYYY-MM-DD — title/);
  });
  it('throws on an impossible date and on ascending order', () => {
    expect(() => parseChangelog('## 2026-13-45 — x\n\ny')).toThrow(/date/);
    expect(() => parseChangelog('## 2026-08-01 — a\n\nx\n\n## 2026-08-02 — b\n\ny')).toThrow(/newest first/);
  });
  it('throws on text before the first heading and on an empty file', () => {
    expect(() => parseChangelog('stray\n## 2026-08-01 — a\n\nx')).toThrow(/before the first/);
    expect(() => parseChangelog('')).toThrow(/no entries/);
  });
});
