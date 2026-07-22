export interface ContentDoc {
  slug: string;
  title: string;
  description: string;
  date: string;          // ISO date (YYYY-MM-DD)
  category: string;
  readingMinutes: number;
  html: string;          // pre-rendered HTML from markdown
}
