import { ContentDoc } from './content.model';
import { SITE } from '../../core/site-identity';

const ORG_ID = `${SITE.url}#org`;

/** The Article JSON-LD both detail pages emit; single-sourced so the shapes can't drift. */
export function buildArticleJsonLd(doc: ContentDoc, basePath: '/guides' | '/blog'): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.description,
    datePublished: doc.date,
    dateModified: doc.updated ?? doc.date,
    mainEntityOfPage: `https://tuliplot.com${basePath}/${doc.slug}/`,
    image: doc.ogImage ?? SITE.ogImage,
    author: { '@type': 'Organization', name: SITE.name },
    publisher: {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: SITE.logo },
    },
  };
}

/** schema.org FAQPage built from a doc's question-style h3 sections. */
export function buildFaqJsonLd(faq: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** schema.org BreadcrumbList: Home › section › page. Positions are 1-based. */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
