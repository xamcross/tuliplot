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
  selector: 'dd-ad-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (config().showAd) {
      <section class="ad-cell" aria-label="Advertisements">
        <span class="ad-cell__label">Advertisements</span>
        @if (showHousePromo()) {
          <a class="ad-cell__promo" routerLink="/app/upgrade">
            <strong>Remove ad — go Premium</strong>
            <span>Unlock all 6 cells and browse ad-free.</span>
          </a>
        } @else {
          <div #adHost class="ad-cell__slot"></div>
        }
      </section>
    }
  `,
  styles: `
    .ad-cell { display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 4px; height: 100%; }
    .ad-cell__label { font-size: 10px; letter-spacing: 0.08em;
      text-transform: uppercase; opacity: 0.6; }
    .ad-cell__promo { display: flex; flex-direction: column; gap: 4px;
      text-align: center; text-decoration: none; padding: 12px; }
    .ad-cell__slot { width: 300px; height: 250px; }
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
