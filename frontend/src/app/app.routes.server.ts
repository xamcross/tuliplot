import { RenderMode, ServerRoute } from '@angular/ssr';
import { GUIDES, POSTS } from './features/marketing/content.generated';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },
  { path: 'guides', renderMode: RenderMode.Prerender },
  {
    path: 'guides/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => GUIDES.map((g) => ({ slug: g.slug })),
  },
  { path: 'blog', renderMode: RenderMode.Prerender },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => POSTS.map((p) => ({ slug: p.slug })),
  },
  { path: '404', renderMode: RenderMode.Prerender },
  { path: 'changelog', renderMode: RenderMode.Prerender },
  { path: 'try', renderMode: RenderMode.Prerender },
  // Dashboard + auth are client-side only (CSR).
  { path: '**', renderMode: RenderMode.Client },
];
