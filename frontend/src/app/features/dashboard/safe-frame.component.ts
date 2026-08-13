import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input,
  output, signal, untracked, viewChild,
} from '@angular/core';
import { isSafeHttpsUrl } from '../../core/util/url.util';

const FRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';

@Component({
  selector: 'tl-safe-frame',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showFrame()) {
      <div class="frame-slot" #frameSlot></div>
    } @else {
      <div class="asleep" data-testid="asleep-placeholder">
        <span>{{ asleep() ? 'Sleeping — wake to reload' : 'Loading…' }}</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .frame-slot { width: 100%; height: 100%; }
    .asleep { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--tl-ink-faint); background: var(--tl-surface); }
  `],
})
export class SafeFrameComponent {
  url = input.required<string>();
  title = input<string>('');
  asleep = input<boolean>(false);
  loadFailed = output<void>();

  private cacheBuster = signal(0);
  private mounted = signal(false);
  private frameSlot = viewChild<ElementRef<HTMLElement>>('frameSlot');

  private loadWatchdogId: ReturnType<typeof setTimeout> | null = null;
  private didLoad = false;

  private readonly loadWatchdog = effect(() => {
    const active = !this.asleep() && !!this.url();
    if (active) {
      this.startLoadWatchdog();
    } else {
      this.cancelLoadWatchdog();
    }
  });

  private readonly frameDestroyRef = inject(DestroyRef);

  constructor() {
    // Staggered mount: defer the first render so 5-6 iframes do not boot simultaneously.
    const timer = setTimeout(() => this.mounted.set(true), 300);
    this.frameDestroyRef.onDestroy(() => clearTimeout(timer));
    this.frameDestroyRef.onDestroy(() => this.cancelLoadWatchdog());
  }

  /** Called by the iframe load listener; cancels the watchdog. */
  onFrameLoad(): void {
    this.didLoad = true;
    this.cancelLoadWatchdog();
  }

  /** (Re)arms the 4s watchdog; emits loadFailed if no load event arrives. */
  startLoadWatchdog(timeoutMs = 4000): void {
    this.cancelLoadWatchdog();
    this.didLoad = false;
    this.loadWatchdogId = setTimeout(() => {
      if (!this.didLoad) {
        this.loadFailed.emit();
      }
    }, timeoutMs);
  }

  private cancelLoadWatchdog(): void {
    if (this.loadWatchdogId !== null) {
      clearTimeout(this.loadWatchdogId);
      this.loadWatchdogId = null;
    }
  }

  private urlSafe = computed(() => isSafeHttpsUrl(this.url()));

  protected showFrame = computed(() => this.mounted() && !this.asleep() && this.urlSafe());

  private frameSrc = computed<string | null>(() => {
    if (!this.showFrame()) {
      return null;
    }
    const bust = this.cacheBuster();
    const u = new URL(this.url().trim());
    if (bust > 0) {
      u.searchParams.set('_tl', String(bust));
    }
    return u.toString();
  });

  // The iframe is built imperatively so its src is set BEFORE the element enters
  // the DOM. The Companion's header-strip rule matches on the request initiator;
  // a src assigned to an iframe that is already in the DOM navigates with an
  // initiator that does not match tuliplot.com, so X-Frame-Options survives and
  // the browser refuses the frame. An Angular [src] binding always sets src
  // after insertion, which is why a template binding cannot be used here.
  private readonly buildFrame = effect(() => {
    const slot = this.frameSlot()?.nativeElement;
    const src = this.frameSrc();
    if (!slot || !src) {
      return;
    }
    const frame = slot.ownerDocument.createElement('iframe');
    frame.setAttribute('title', untracked(() => this.title()));
    frame.setAttribute('data-testid', 'app-iframe');
    frame.setAttribute('sandbox', FRAME_SANDBOX);
    frame.setAttribute('allow', 'fullscreen; clipboard-write; autoplay');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    frame.addEventListener('load', () => this.onFrameLoad());
    frame.addEventListener('error', () => this.loadFailed.emit());
    frame.setAttribute('src', src);
    slot.replaceChildren(frame);
  });

  reload(): void {
    this.cacheBuster.update((n) => n + 1);
    // The cache-buster does not touch the watchdog effect's dependencies, so the
    // watchdog is not re-armed automatically. Re-arm it here so a reload that
    // hangs still surfaces load-failed.
    if (!this.asleep() && this.showFrame()) {
      this.startLoadWatchdog();
    }
  }
}
