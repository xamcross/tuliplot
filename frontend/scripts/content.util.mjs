// Pure, dependency-free helpers for the build-time content pipeline.
export function xmlEscape(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function splitFrontmatter(raw) {
  const normalized = String(raw).replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) {
    return { data: {}, body: normalized };
  }
  const data = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: match[2] };
}

export function readingMinutes(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function stripLeadingH1(body) {
  return String(body).replace(/^\s*#[ \t][^\n]*\n+/, '');
}

export function sitemapXml(entries) {
  const urls = entries
    .map(
      ({ loc, lastmod }) =>
        `  <url><loc>${xmlEscape(loc)}</loc>` + (lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : '') + `</url>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls +
    `\n</urlset>\n`
  );
}
