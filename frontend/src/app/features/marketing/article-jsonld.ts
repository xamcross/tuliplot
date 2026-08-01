import { ContentDoc } from './content.model';

/** The Article JSON-LD both detail pages emit; single-sourced so the shapes can't drift. */
export function buildArticleJsonLd(doc: ContentDoc, basePath: '/guides' | '/blog'): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.description,
    datePublished: doc.date,
    dateModified: doc.date,
    mainEntityOfPage: `https://tuliplot.com${basePath}/${doc.slug}/`,
    image: 'https://tuliplot.com/og-card.png',
    author: { '@type': 'Organization', name: 'TulipLot' },
    publisher: {
      '@type': 'Organization',
      name: 'TulipLot',
      logo: { '@type': 'ImageObject', url: 'https://tuliplot.com/og-card.png' },
    },
  };
}
