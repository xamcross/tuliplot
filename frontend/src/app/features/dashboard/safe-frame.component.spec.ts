import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { SafeFrameComponent } from './safe-frame.component';

function setup(url: string, asleep = false) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const f = TestBed.createComponent(SafeFrameComponent);
  f.componentRef.setInput('url', url);
  f.componentRef.setInput('asleep', asleep);
  return f;
}

describe('SafeFrameComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not render an iframe for an unsafe url', () => {
    const f = setup('javascript:alert(1)');
    vi.advanceTimersByTime(300);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();
  });

  it('renders an iframe for a safe https url only after the staggered mount', () => {
    const f = setup('https://example.com');
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();

    vi.advanceTimersByTime(300);
    f.detectChanges();
    const iframe = f.nativeElement.querySelector('[data-testid="app-iframe"]') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads',
    );
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation');
  });

  it('removes the iframe when asleep and shows a placeholder', () => {
    const f = setup('https://example.com', true);
    vi.advanceTimersByTime(300);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="app-iframe"]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="asleep-placeholder"]')).not.toBeNull();
  });

  it('the iframe has its src before it enters the DOM, so the Companion rule sees the right initiator', () => {
    const seen: (string | null)[] = [];
    const record = (node: Node): void => {
      if ((node as Element).tagName === 'IFRAME') {
        seen.push((node as Element).getAttribute('src'));
      }
    };
    const origAppend = Node.prototype.appendChild;
    const origInsert = Node.prototype.insertBefore;
    const origReplace = Element.prototype.replaceChildren;
    (Node.prototype as { appendChild: unknown }).appendChild = function (this: Node, node: Node) {
      record(node);
      return origAppend.call(this, node);
    };
    (Node.prototype as { insertBefore: unknown }).insertBefore = function (this: Node, node: Node, ref: Node | null) {
      record(node);
      return origInsert.call(this, node, ref);
    };
    (Element.prototype as { replaceChildren: unknown }).replaceChildren = function (this: Element, ...nodes: (Node | string)[]) {
      for (const n of nodes) {
        if (typeof n !== 'string') {
          record(n);
        }
      }
      return origReplace.apply(this, nodes);
    };
    try {
      const f = setup('https://example.com');
      vi.advanceTimersByTime(300);
      f.detectChanges();
    } finally {
      Node.prototype.appendChild = origAppend;
      Node.prototype.insertBefore = origInsert;
      Element.prototype.replaceChildren = origReplace;
    }
    expect(seen.length).toBeGreaterThan(0);
    for (const src of seen) {
      expect(src, 'iframe entered the DOM without a src').toBe('https://example.com/');
    }
  });

  it('reload() changes the iframe src', () => {
    const f = setup('https://example.com');
    vi.advanceTimersByTime(300);
    f.detectChanges();
    const before = f.nativeElement.querySelector('[data-testid="app-iframe"]').getAttribute('src');

    f.componentInstance.reload();
    f.detectChanges();
    const after = f.nativeElement.querySelector('[data-testid="app-iframe"]').getAttribute('src');

    expect(after).not.toBe(before);
    expect(after).toContain('_tl=1');
  });
});
