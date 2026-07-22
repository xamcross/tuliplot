import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DashboardStore } from '../../stores/dashboard.store';

@Component({
  selector: 'dd-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  template: `
    <div class="grid" cdkDropListGroup [class.dragging]="dragging()">
      @for (cell of store.cells(); track cell.slot) {
        <div
          class="cell"
          cdkDropList
          [cdkDropListData]="cell.slot"
          [cdkDropListSortingDisabled]="true"
          [cdkDropListDisabled]="cell.type === 'AD'"
          (cdkDropListDropped)="onDropped($event)"
        >
          <div
            class="drag"
            cdkDrag
            [cdkDragData]="cell.slot"
            [cdkDragDisabled]="cell.type !== 'APP'"
            (cdkDragStarted)="dragging.set(true)"
            (cdkDragEnded)="dragging.set(false)"
          >
            @switch (cell.type) {
              @case ('EMPTY') {
                <button type="button" class="add-btn" data-testid="add-btn" (click)="edit.emit(cell.slot)">
                  + Add app
                </button>
              }
              @case ('AD') {
                <div class="ad-slot" data-testid="ad-slot">Advertisements</div>
              }
              @case ('APP') {
                <div class="app-body" data-testid="app-body">{{ cell.title || cell.url }}</div>
              }
            }
          </div>
        </div>
      }
      @if (dragging()) {
        <div class="iframe-shield" data-testid="iframe-shield"></div>
      }
    </div>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 8px;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .cell { position: relative; min-height: 0; min-width: 0; overflow: hidden; border: 1px solid #e2e2e2; border-radius: 6px; }
    .drag { width: 100%; height: 100%; }
    .add-btn { width: 100%; height: 100%; border: none; background: #fafafa; cursor: pointer; }
    .ad-slot { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; }
    .app-body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .iframe-shield { position: absolute; inset: 0; z-index: 50; pointer-events: auto; background: transparent; }
    .grid.dragging iframe { pointer-events: none; }
  `],
})
export class GridComponent {
  protected store = inject(DashboardStore);
  readonly dragging = signal(false);
  readonly edit = output<number>();

  onDropped(event: CdkDragDrop<number>): void {
    const from = event.item.data as number;
    const to = event.container.data;
    if (from === to) {
      return;
    }
    this.store.swap(from, to);
  }
}
