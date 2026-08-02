export interface ContentDoc {
  slug: string;
  title: string;
  description: string;
  date: string;          // ISO date (YYYY-MM-DD)
  category: string;
  readingMinutes: number;
  faq: { q: string; a: string }[];   // question-style h3s, for FAQPage schema
  html: string;          // pre-rendered HTML from markdown
}
