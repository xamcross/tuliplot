// marked extension: external links open in a new tab with rel="noopener".
// marked 12 renderer methods take positional arguments (href, title, text);
// the object form ({ href, title, tokens }) arrives only in marked 13+.
import { isExternalHref } from './content.util.mjs';

export function externalLinkExtension() {
  return {
    renderer: {
      link(href, title, text) {
        const titleAttr = title ? ` title="${String(title).replaceAll('"', '&quot;')}"` : '';
        const ext = isExternalHref(href) ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${href}"${titleAttr}${ext}>${text}</a>`;
      },
    },
  };
}
