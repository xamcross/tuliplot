import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdConfig } from '../../core/models/ads.model';
import { ConsentService } from '../../core/services/consent.service';

@Component({
  selector: 'tl-ad-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (config().showAd) {
      <section class="ad-cell" aria-label="Advertisements">
        <span class="ad-cell__label">Ad · Free plan</span>
        @if (showHousePromo()) {
          <a class="ad-cell__promo" routerLink="/app/upgrade">
            <span class="promo-text">Your 6th cell shows one ad.</span>
            <span class="tl-btn tl-btn--primary tl-btn--sm">Remove ad — go Premium</span>
          </a>
        } @else {
          <div #adHost class="ad-cell__slot"></div>
        }
      </section>
    }
  `,
  styles: `
    .ad-cell { height: 100%; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; text-align: center; padding: 16px;
      border: 1.5px dashed var(--tl-border-dashed); border-radius: 12px;
      background: repeating-linear-gradient(45deg, #F4F2FA, #F4F2FA 9px, #ECE8F6 9px, #ECE8F6 18px); }
    .ad-cell__label { font-family: var(--tl-font-mono); font-size: 11px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--tl-ink-faint); }
    .ad-cell__promo { display: flex; flex-direction: column; align-items: center; gap: 12px;
      text-decoration: none; }
    .promo-text { font-family: var(--tl-font-display); font-weight: 600; font-size: 15px;
      color: var(--tl-ink-soft); max-width: 180px; line-height: 1.4; }
    .ad-cell__slot { width: 300px; height: 250px; max-width: 100%; }
  `,
})
export class AdCellComponent {
  readonly config = input.required<AdConfig>();

  private readonly consent = inject(ConsentService);
  private readonly adHost =
    viewChild<ElementRef<HTMLDivElement>>('adHost');

  protected readonly showHousePromo = computed(() => {
    const c = this.config();
    return !c.adClient || !c.adSlot || !this.consent.consentGranted();
  });

  constructor() {
    // Renders (and re-renders on config change) the AdSense unit once the
    // #adHost element exists and we are not showing the house promo.
    effect(() => {
      const c = this.config();
      if (!c.showAd || this.showHousePromo()) return;
      const host = this.adHost()?.nativeElement;
      if (!host) return;
      this.renderAdUnit(host, c);
    });
  }

  private renderAdUnit(host: HTMLDivElement, config: AdConfig): void {
    // Destroy any previous <ins> so a config change gets a fresh unit.
    host.replaceChildren();
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'inline-block';
    ins.style.width = '300px';
    ins.style.height = '250px';
    ins.setAttribute('data-ad-client', config.adClient);
    ins.setAttribute('data-ad-slot', config.adSlot);
    ins.setAttribute('data-full-width-responsive', 'false');
    host.appendChild(ins);
    const w = window as unknown as { adsbygoogle?: unknown[] };
    (w.adsbygoogle = w.adsbygoogle || []).push({});
  }
}
