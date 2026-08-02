/**
 * Picks `count` neighbours for a "Keep reading" block. The window starts at the current
 * item's own index, so each article recommends a different pair and no item is stranded —
 * a plain `slice(0, count)` always surfaces the head of the list and never the newest entries.
 */
export function pickRelated<T extends { slug: string }>(
  items: readonly T[],
  currentSlug: string | null,
  count: number,
): T[] {
  const others = items.filter((i) => i.slug !== currentSlug);
  if (others.length === 0) {
    return [];
  }
  const index = items.findIndex((i) => i.slug === currentSlug);
  const start = index < 0 ? 0 : index;
  const take = Math.min(count, others.length);
  return Array.from({ length: take }, (_, offset) => others[(start + offset) % others.length]);
}
