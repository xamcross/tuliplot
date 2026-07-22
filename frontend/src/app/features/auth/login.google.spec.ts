import { googleAuthUrl } from './login.component';
import { environment } from '../../../environments/environment';

describe('googleAuthUrl', () => {
  it('strips /api/v1 and targets the Spring OAuth2 authorization endpoint', () => {
    expect(googleAuthUrl('http://localhost:8080/api/v1')).toBe(
      'http://localhost:8080/oauth2/authorization/google',
    );
    expect(googleAuthUrl('https://api.dashdash.app/api/v1')).toBe(
      'https://api.dashdash.app/oauth2/authorization/google',
    );
  });

  it('derives a valid URL from the configured environment base', () => {
    const url = googleAuthUrl(environment.apiBaseUrl);
    expect(url).toContain('/oauth2/authorization/google');
    expect(url).not.toContain('/api/v1');
  });
});
