import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'tl-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a [routerLink]="link()" class="logo" [class.logo--compact]="compact()">
      <span class="squares" aria-hidden="true">
        <span class="sq sq--pink"></span><span class="sq sq--peach"></span>
        <span class="sq sq--sky"></span><span class="sq sq--mint"></span>
      </span>
      TulipLot
    </a>
  `,
  styles: [`
    .logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none;
      font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; color: var(--tl-ink); }
    .logo:hover { color: var(--tl-ink); }
    .logo--compact { font-size: 19px; gap: 9px; }
    .squares { display: inline-grid; grid-template-columns: 1fr 1fr; gap: 3px; }
    .sq { width: 9px; height: 9px; border-radius: 3px; }
    .logo--compact .sq { width: 8px; height: 8px; border-radius: 2px; }
    .sq--pink { background: var(--tl-pink); }
    .sq--peach { background: var(--tl-peach); }
    .sq--sky { background: var(--tl-sky); }
    .sq--mint { background: var(--tl-mint); }
  `],
})
export class LogoComponent {
  readonly link = input<string>('/');
  readonly compact = input<boolean>(false);
}
