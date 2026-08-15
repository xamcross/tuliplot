export interface ContentDoc {
  slug: string;
  title: string;
  description: string;
  date: string;          // ISO date (YYYY-MM-DD) — datePublished
  updated?: string;      // ISO date — dateModified when set; falls back to date
  seoTitle?: string;     // ≤ 49 chars; <title>/og:title only, the H1 keeps `title`
  ogImage?: string;      // absolute URL of a 1200×630 image (blog posts only)
  category: string;
  readingMinutes: number;
  faq: { q: string; a: string }[];   // question-style h3s, for FAQPage schema
  html: string;          // pre-rendered HTML from markdown
}
