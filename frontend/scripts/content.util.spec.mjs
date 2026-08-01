import { describe, it, expect } from 'vitest';
import { splitFrontmatter, readingMinutes, stripLeadingH1, sitemapXml } from './content.util.mjs';

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
