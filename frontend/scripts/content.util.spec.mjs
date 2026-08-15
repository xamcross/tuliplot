import { describe, it, expect } from 'vitest';
import { splitFrontmatter, readingMinutes, stripLeadingH1, sitemapXml, xmlEscape, extractFaq, isRealIsoDate, validateDates, validateSeoTitle, SEO_TITLE_MAX, isExternalHref } from './content.util.mjs';

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
