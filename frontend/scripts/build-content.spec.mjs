import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import { externalLinkExtension } from './build-content.util.mjs';

describe('externalLinkExtension', () => {
  it('adds target and rel to external links only', () => {
    marked.use(externalLinkExtension());
    const html = marked.parse('[MDN](https://developer.mozilla.org/x) and [guide](/guides/x)');
    expect(html).toContain('<a href="https://developer.mozilla.org/x" target="_blank" rel="noopener">MDN</a>');
    expect(html).toContain('<a href="/guides/x">guide</a>');
  });

  it('escapes special characters in title and href', () => {
    marked.use(externalLinkExtension());
    const html = marked.parse('[MDN](https://developer.mozilla.org/x "A & B <c>")');
    expect(html).toContain(
      '<a href="https://developer.mozilla.org/x" title="A &amp; B &lt;c&gt;" target="_blank" rel="noopener">MDN</a>',
    );
    const html2 = marked.parse('[q](https://example.com/?a=1&b=2)');
    expect(html2).toContain('href="https://example.com/?a=1&amp;b=2"');
  });
});
