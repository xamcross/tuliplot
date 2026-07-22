import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { isSafeHttpsUrl } from '../../core/util/url.util';

@Component({
  selector: 'dd-safe-frame',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showFrame()) {
      <iframe
        [src]="safeSrc()"
        [title]="title()"
        class="frame"
        data-testid="app-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
        allow="fullscreen; clipboard-write; autoplay"
        referrerpolicy="strict-origin-when-cross-origin"
        (error)="loadFailed.emit()"
      ></iframe>
    } @else {
      <div class="asleep" data-testid="asleep-placeholder">
        <span>{{ asleep() ? 'Sleeping — wake to reload' : 'Loading…' }}</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .frame { width: 100%; height: 100%; border: 0; display: block; }
    .asleep { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #888; background: #fafafa; }
  `],
})
export class SafeFrameComponent {
  url = input.required<string>();
  title = input<string>('');
  asleep = input<boolean>(false);
  loadFailed = output<void>();

  private sanitizer = inject(DomSanitizer);
  private cacheBuster = signal(0);
  private mounted = signal(false);

  constructor() {
    // Staggered mount: defer the first render so 5-6 iframes do not boot simultaneously.
    const timer = setTimeout(() => this.mounted.set(true), 300);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  private urlSafe = computed(() => isSafeHttpsUrl(this.url()));

  protected showFrame = computed(() => this.mounted() && !this.asleep() && this.urlSafe());

  protected safeSrc = computed<SafeResourceUrl | null>(() => {
    if (!this.showFrame()) {
      return null;
    }
    const bust = this.cacheBuster();
    const u = new URL(this.url().trim());
    if (bust > 0) {
      u.searchParams.set('_dd', String(bust));
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(u.toString());
  });

  reload(): void {
    this.cacheBuster.update((n) => n + 1);
  }
}
