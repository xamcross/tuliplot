import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/**
 * Appends "/" to the path part of a serialized URL so internal links match the
 * canonical form ("/guides/" not "/guides"). The root stays "/". Query and
 * fragment follow the slash.
 */
export function withTrailingSlash(url: string): string {
  const m = /^([^?#]*)(.*)$/.exec(url)!;
  const path = m[1];
  const rest = m[2]; // "?…", "#…", or ""
  if (path === '' || path === '/') return `/${rest}`;
  return path.endsWith('/') ? `${path}${rest}` : `${path}/${rest}`;
}

/**
 * Router URL serializer: Angular's default parsing, serialized paths end with "/".
 * Cloudflare Pages answers "/guides" with a 308 to "/guides/"; with this serializer
 * every routerLink and navigation targets the canonical URL directly.
 */
export class TrailingSlashUrlSerializer extends DefaultUrlSerializer {
  override serialize(tree: UrlTree): string {
    return withTrailingSlash(super.serialize(tree));
  }
}
