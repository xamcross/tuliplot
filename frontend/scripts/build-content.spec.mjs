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
});
