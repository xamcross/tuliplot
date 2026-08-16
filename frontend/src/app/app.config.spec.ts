import { UrlSerializer } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { appConfig } from './app.config';
import { TrailingSlashUrlSerializer } from './core/trailing-slash-url.serializer';

describe('appConfig', () => {
  it('provides the TrailingSlashUrlSerializer as the router UrlSerializer', () => {
    const entry = appConfig.providers.find(
      (p) => typeof p === 'object' && p !== null && (p as { provide?: unknown }).provide === UrlSerializer,
    ) as { useClass?: unknown } | undefined;
    expect(entry?.useClass).toBe(TrailingSlashUrlSerializer);
  });
});
