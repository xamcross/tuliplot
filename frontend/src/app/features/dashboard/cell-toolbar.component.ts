import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'tl-cell-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar" data-testid="cell-toolbar">
      <span class="dot" [style.background]="accent()" aria-hidden="true"></span>
      <span class="title">{{ title() }}</span>
      <span class="spacer"></span>
      <button type="button" title="Reload" data-testid="tb-reload" (click)="reload.emit()">&#8635;</button>
      <button type="button" title="Expand" data-testid="tb-focus" (click)="focusToggle.emit()">&#8690;</button>
      <button type="button" title="Pop out" data-testid="tb-popout" (click)="popOut.emit()">&#9099;</button>
      <button type="button" title="Open in tab" data-testid="tb-opentab" (click)="openInTab.emit()">&#8599;</button>
      <button type="button" title="Edit" data-testid="tb-edit" (click)="edit.emit()">&#9998;</button>
      <button type="button" [title]="asleep() ? 'Wake' : 'Sleep'" data-testid="tb-sleep" (click)="sleep.emit()">
        {{ asleep() ? '☾' : '☀' }}
      </button>
      <button type="button" title="Remove" data-testid="tb-remove" (click)="remove.emit()">&#128465;</button>
    </div>
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: var(--tl-surface); border-bottom: 1px solid var(--tl-app-bg); font-size: 13px; }
    .dot { width: 14px; height: 14px; border-radius: 4px; flex: none; }
    .title { font-weight: 600; color: var(--tl-ink); overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; max-width: 40%; }
    .spacer { flex: 1; }
    button { border: none; background: transparent; cursor: pointer; padding: 2px 4px;
      line-height: 1; font-size: 13px; color: #b8b3c9; }
    button:hover { color: var(--tl-ink); }
  `],
})
export class CellToolbarComponent {
  title = input<string>('');
  asleep = input<boolean>(false);
  accent = input<string>('var(--tl-lilac)');

  reload = output<void>();
  focusToggle = output<void>();
  popOut = output<void>();
  openInTab = output<void>();
  edit = output<void>();
  sleep = output<void>();
  remove = output<void>();
}
