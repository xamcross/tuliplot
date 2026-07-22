import { BrowserDetectService } from './browser-detect.service';

describe('BrowserDetectService', () => {
  const service = new BrowserDetectService();

  const uaDesc = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
  const dataDesc = Object.getOwnPropertyDescriptor(window.navigator, 'userAgentData');

  function setEnv(ua: string, brands?: Array<{ brand: string }>): void {
    Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
    Object.defineProperty(window.navigator, 'userAgentData', {
      value: brands ? { brands } : undefined,
      configurable: true,
    });
  }

  afterEach(() => {
    if (uaDesc) Object.defineProperty(window.navigator, 'userAgent', uaDesc);
    if (dataDesc) {
      Object.defineProperty(window.navigator, 'userAgentData', dataDesc);
    } else {
      Object.defineProperty(window.navigator, 'userAgentData', { value: undefined, configurable: true });
    }
  });

  it('returns true for Chrome via userAgentData brands', () => {
    setEnv('irrelevant', [{ brand: 'Chromium' }, { brand: 'Google Chrome' }, { brand: 'Not:A-Brand' }]);
    expect(service.isChromium()).toBe(true);
  });

  it('returns true for a Chrome user-agent string (no userAgentData)', () => {
    setEnv(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    );
    expect(service.isChromium()).toBe(true);
  });

  it('returns false for Firefox', () => {
    setEnv('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0');
    expect(service.isChromium()).toBe(false);
  });

  it('returns false for Safari', () => {
    setEnv(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );
    expect(service.isChromium()).toBe(false);
  });
});
