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

/** Strips the inline markdown we actually use (links, bold, italics, code) down to plain text. */
function plainText(md) {
  return String(md)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * FAQ pairs for schema.org FAQPage: every `### ` heading that ends with a question mark,
 * answered by the paragraph directly beneath it. Headings that aren't questions are skipped.
 */
export function extractFaq(body) {
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const faq = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^###\s+(.*\?)\s*$/.exec(lines[i]);
    if (!m) continue;
    const answer = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (/^#{1,6}\s/.test(line)) break;
      if (line.trim() === '') {
        if (answer.length) break;
        continue;
      }
      answer.push(line.trim());
    }
    if (answer.length) {
      faq.push({ q: plainText(m[1]), a: plainText(answer.join(' ')) });
    }
  }
  return faq;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a YYYY-MM-DD string that names a real calendar day. */
export function isRealIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Frontmatter dates: `date` is required; `updated` is optional and must not be earlier than `date`. */
export function validateDates(data, file) {
  const { date, updated } = data;
  if (!isRealIsoDate(date)) {
    throw new Error(`content: ${file} is missing a valid frontmatter date (YYYY-MM-DD)`);
  }
  if (updated !== undefined && updated !== '') {
    if (!isRealIsoDate(updated)) {
      throw new Error(`content: ${file} has an invalid frontmatter updated (YYYY-MM-DD)`);
    }
    if (updated < date) {
      throw new Error(`content: ${file} has updated (${updated}) before date (${date})`);
    }
    return { date, updated };
  }
  return { date, updated: undefined };
}

/** The ` · TulipLot` suffix adds 11 characters; 49 keeps the full <title> at or under 60. */
export const SEO_TITLE_MAX = 49;

export function validateSeoTitle(seoTitle, file) {
  if (seoTitle === undefined || seoTitle === '') return undefined;
  if (seoTitle.length > SEO_TITLE_MAX) {
    throw new Error(`content: ${file} seoTitle is ${seoTitle.length} chars; max ${SEO_TITLE_MAX}`);
  }
  return seoTitle;
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
