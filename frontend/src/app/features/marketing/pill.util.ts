/** Category → design-system pill/thumb classes (Design System Contract, Task 7). */
export function pillClass(category: string): string {
  switch (category.toLowerCase()) {
    case 'basics':
    case 'tips':
      return 'tl-pill--amber';
    case 'product':
      return 'tl-pill--lilac';
    case 'advanced':
      return 'tl-pill--sky';
    case 'billing':
      return 'tl-pill--mint';
    default:
      return 'tl-pill--neutral';
  }
}

export function thumbClass(category: string): string {
  switch (category.toLowerCase()) {
    case 'basics':
    case 'tips':
      return 'thumb--amber';
    case 'product':
    case 'advanced':
      return 'thumb--sky';
    case 'billing':
      return 'thumb--mint';
    default:
      return 'thumb--neutral';
  }
}
