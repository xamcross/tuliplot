import { pillClass, thumbClass } from './pill.util';

describe('pill.util', () => {
  it('maps known categories to pill classes', () => {
    expect(pillClass('Basics')).toBe('tl-pill--amber');
    expect(pillClass('Tips')).toBe('tl-pill--amber');
    expect(pillClass('Product')).toBe('tl-pill--lilac');
    expect(pillClass('Advanced')).toBe('tl-pill--sky');
    expect(pillClass('Billing')).toBe('tl-pill--mint');
    expect(pillClass('Anything else')).toBe('tl-pill--neutral');
  });
  it('maps categories to thumbnail classes', () => {
    expect(thumbClass('Tips')).toBe('thumb--amber');
    expect(thumbClass('Product')).toBe('thumb--sky');
    expect(thumbClass('Nope')).toBe('thumb--neutral');
  });
});
