// marked extension: external links open in a new tab with rel="noopener"; internal links get the canonical trailing slash.
// marked 12 renderer methods take positional arguments (href, title, text);
// the object form ({ href, title, tokens }) arrives only in marked 13+.
import { isExternalHref, normalizeInternalHref, xmlEscape } from './content.util.mjs';

export function externalLinkExtension() {
  return {
    renderer: {
      link(href, title, text) {
        // marked's tokenizer HTML-escapes `title` before any renderer sees it
        // (lib/marked.cjs outputLink: `title: title ? escape$1(link.title) : null`);
        // escaping it again here would double-escape entities. `href` is passed
        // through raw, so it still needs escaping here.
        if (href === null || href === undefined) return text;
        const external = isExternalHref(href);
        const safeHref = xmlEscape(external ? href : normalizeInternalHref(href));
        const titleAttr = title ? ` title="${title}"` : '';
        const ext = external ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${safeHref}"${titleAttr}${ext}>${text}</a>`;
      },
    },
  };
}
