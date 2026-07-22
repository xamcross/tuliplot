import { describe, it, expect } from 'vitest';
import { isSafeHttpsUrl } from './url.util';

describe('isSafeHttpsUrl', () => {
  it('accepts safe https urls', () => {
    expect(isSafeHttpsUrl('https://mail.google.com')).toBe(true);
    expect(isSafeHttpsUrl('  https://example.com/path?q=1  ')).toBe(true);
  });
  it('rejects unsafe or malformed urls', () => {
    for (const bad of ['http://x.com', 'javascript:alert(1)', 'data:text/html,x', 'blob:https://x/y',
      'file:///etc', 'https://user:pass@x.com', '//x.com', 'not a url', '', '   ', null, undefined]) {
      expect(isSafeHttpsUrl(bad as any)).toBe(false);
    }
  });
});
