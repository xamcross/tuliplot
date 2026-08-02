import { describe, it, expect } from 'vitest';
import { pickRelated } from './related.util';

const items = ['a', 'b', 'c', 'd', 'e'].map((slug) => ({ slug }));

describe('pickRelated', () => {
  it('never includes the current item', () => {
    for (const item of items) {
      expect(pickRelated(items, item.slug, 2).map((i) => i.slug)).not.toContain(item.slug);
    }
  });

  it('makes every item reachable from some other item (the slice(0,n) bug)', () => {
    const surfaced = new Set(items.flatMap((i) => pickRelated(items, i.slug, 2).map((p) => p.slug)));
    for (const item of items) {
      expect(surfaced.has(item.slug), `${item.slug} is unreachable`).toBe(true);
    }
  });

  it('gives different items different picks', () => {
    const a = pickRelated(items, 'a', 2).map((i) => i.slug).join();
    const c = pickRelated(items, 'c', 2).map((i) => i.slug).join();
    expect(a).not.toBe(c);
  });

  it('returns count items, or all of them when the collection is smaller', () => {
    expect(pickRelated(items, 'a', 2)).toHaveLength(2);
    expect(pickRelated(items.slice(0, 2), 'a', 2)).toHaveLength(1);
    expect(pickRelated(items.slice(0, 1), 'a', 2)).toHaveLength(0);
    expect(pickRelated([], null, 2)).toHaveLength(0);
  });

  it('handles an unknown slug without throwing', () => {
    expect(pickRelated(items, 'nope', 2)).toHaveLength(2);
  });

  it('uses the anchor to vary picks when the slug is not in this collection', () => {
    const a = pickRelated(items, 'nope', 2, 0).map((i) => i.slug).join();
    const b = pickRelated(items, 'nope', 2, 2).map((i) => i.slug).join();
    expect(a).not.toBe(b);
  });
});
