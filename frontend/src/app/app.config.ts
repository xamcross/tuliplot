import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { provideClientHydration } from '@angular/platform-browser';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // XSRF is handled by credentialsInterceptor, not withXsrfConfiguration: Angular's built-in
    // XSRF interceptor skips absolute URLs, so it never sets the header on our cross-origin API.
    provideHttpClient(
      withInterceptors([credentialsInterceptor]),
    ),
    provideClientHydration(),
    provideAppInitializer(() => inject(ThemeService).init()),
  ],
};
