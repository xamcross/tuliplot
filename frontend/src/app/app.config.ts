import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy, UrlSerializer } from '@angular/router';
import { TrailingSlashUrlSerializer } from './core/trailing-slash-url.serializer';
import { TlTitleStrategy } from './core/services/title.strategy';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { provideClientHydration } from '@angular/platform-browser';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // Internal links and navigations serialize with a trailing slash — the canonical form
    // Cloudflare Pages serves without a 308 hop. Must come after provideRouter.
    { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
    { provide: TitleStrategy, useClass: TlTitleStrategy },
    // XSRF is handled by credentialsInterceptor, not withXsrfConfiguration: Angular's built-in
    // XSRF interceptor skips absolute URLs, so it never sets the header on our cross-origin API.
    provideHttpClient(
      withInterceptors([credentialsInterceptor]),
    ),
    provideClientHydration(),
    provideAppInitializer(() => inject(ThemeService).init()),
  ],
};
