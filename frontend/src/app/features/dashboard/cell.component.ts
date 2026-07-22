import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { Cell } from '../../core/models/dashboard.model';
import { CellToolbarComponent } from './cell-toolbar.component';
import { SafeFrameComponent } from './safe-frame.component';

type CellState = 'ok' | 'needs-extension' | 'login-in-tab' | 'load-failed';

@Component({
  selector: 'dd-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellToolbarComponent, SafeFrameComponent],
  template: `
    @switch (cell().type) {
      @case ('EMPTY') {
        <button type="button" class="add-btn" data-testid="add-btn" (click)="edit.emit(cell().slot)">
          <span class="plus">+</span> Add app
        </button>
      }
      @case ('AD') {
        <div class="ad-slot" data-testid="ad-slot" aria-label="Advertisements">Advertisements</div>
      }
      @case ('APP') {
        @switch (state()) {
          @case ('ok') {
            <dd-cell-toolbar
              [title]="cell().title ?? ''"
              [asleep]="asleep()"
              (reload)="onReload()"
              (popOut)="popOut.emit(cell().slot)"
              (openInTab)="openInTab.emit(cell().slot)"
              (focusToggle)="focusToggle.emit(cell().slot)"
              (edit)="edit.emit(cell().slot)"
              (sleep)="sleepToggle.emit(cell().slot)"
              (remove)="remove.emit(cell().slot)"
            />
            <dd-safe-frame
              [url]="cell().url!"
              [title]="cell().title ?? ''"
              [asleep]="asleep()"
              (loadFailed)="onLoadFailed()"
            />
          }
          @case ('needs-extension') {
            <div class="state" data-testid="needs-extension">This app needs the DashDash extension to load here.</div>
          }
          @case ('login-in-tab') {
            <div class="state" data-testid="login-in-tab">Sign in to this app in a new tab, then reload.</div>
          }
          @case ('load-failed') {
            <div class="state" data-testid="load-failed">This app refused to load. Open it in a new window.</div>
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .add-btn { width: 100%; height: 100%; border: none; background: #fafafa; cursor: pointer; font-size: 14px; }
    .ad-slot { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; }
    .state { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 8px; text-align: center; color: #666; }
  `],
})
export class CellComponent {
  cell = input.required<Cell>();
  dragging = input<boolean>(false);
  asleep = input<boolean>(false);
  // Stub state; Plan 04 drives 'needs-extension' | 'login-in-tab' | 'load-failed'.
  state = input<CellState>('ok');

  edit = output<number>();
  remove = output<number>();
  sleepToggle = output<number>();
  popOut = output<number>();
  openInTab = output<number>();
  focusToggle = output<number>();

  private safeFrame = viewChild(SafeFrameComponent);

  onReload(): void {
    this.safeFrame()?.reload();
  }

  onLoadFailed(): void {
    // Plan 04 sets the 'load-failed' state here via framing-failure detection.
  }
}
