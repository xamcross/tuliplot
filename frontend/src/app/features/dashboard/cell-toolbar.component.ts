import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'dd-cell-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar" data-testid="cell-toolbar">
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
    .toolbar { display: flex; align-items: center; gap: 2px; padding: 2px 6px; background: rgba(0,0,0,0.05); font-size: 12px; }
    .spacer { flex: 1; }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40%; }
    button { border: none; background: transparent; cursor: pointer; padding: 2px 4px; line-height: 1; }
  `],
})
export class CellToolbarComponent {
  title = input<string>('');
  asleep = input<boolean>(false);

  reload = output<void>();
  focusToggle = output<void>();
  popOut = output<void>();
  openInTab = output<void>();
  edit = output<void>();
  sleep = output<void>();
  remove = output<void>();
}
