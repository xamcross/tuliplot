import site from './site-identity.json';

/** The one source of truth for the product identity. Edit the JSON, not this file. */
export interface SiteIdentity {
  name: string;
  url: string;          // trailing slash
  sentence: string;     // the canonical one-sentence definition; used verbatim everywhere
  logo: string;         // 512×512 PNG, absolute URL
  ogImage: string;      // 1200×630 PNG, absolute URL
  sameAs: string[];     // public profiles that name the same entity
  contactUrl: string;
  premiumMonthlyUsd: string;
}

export const SITE: SiteIdentity = site;
