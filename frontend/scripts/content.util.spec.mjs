import { describe, it, expect } from 'vitest';
import { splitFrontmatter, readingMinutes } from './content.util.mjs';

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
