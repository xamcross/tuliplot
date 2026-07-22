import { ChangeDetectionStrategy, Component, HostListener, inject, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DashboardStore } from '../../stores/dashboard.store';
import { AuthStore } from '../../stores/auth.store';
import { CellComponent } from './cell.component';

@Component({
  selector: 'dd-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CellComponent],
  template: `
    <div class="grid" cdkDropListGroup [class.dragging]="dragging()" [class.has-focus]="focusedSlot() !== null">
      @for (cell of store.cells(); track cell.slot; let i = $index) {
        <div
          class="cell"
          [class.focused]="focusedSlot() === cell.slot"
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
            [cdkDragDisabled]="cell.type !== 'APP' || isSlotLocked(i)"
            (cdkDragStarted)="dragging.set(true)"
            (cdkDragEnded)="dragging.set(false)"
          >
            <dd-cell
              [cell]="cell"
              [dragging]="dragging()"
              [asleep]="asleepSlots().has(cell.slot)"
              (edit)="edit.emit($event)"
              (remove)="onRemove($event)"
              (sleepToggle)="onSleepToggle($event)"
              (focusToggle)="onFocusToggle($event)"
            />
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
    .cell { position: relative; min-height: 0; min-width: 0; overflow: hidden; border: 1px solid #e2e2e2; border-radius: 6px; display: flex; flex-direction: column; }
    .drag { width: 100%; height: 100%; display: flex; flex-direction: column; }
    .cell.focused { position: fixed; inset: 0; z-index: 1000; border-radius: 0; background: #fff; }
    .iframe-shield { position: absolute; inset: 0; z-index: 50; pointer-events: auto; background: transparent; }
    .grid.dragging iframe { pointer-events: none; }
  `],
})
export class GridComponent {
  protected store = inject(DashboardStore);
  private readonly authStore = inject(AuthStore);
  readonly dragging = signal(false);
  readonly focusedSlot = signal<number | null>(null);
  protected readonly asleepSlots = signal<Set<number>>(new Set());
  readonly edit = output<number>();

  /** Slot 5 is the fixed ad slot; it is locked (non-editable, non-draggable) unless the user is ad-free. */
  protected isSlotLocked(index: number): boolean {
    return index === 5 && !this.authStore.adFree();
  }

  onDropped(event: CdkDragDrop<number>): void {
    const from = event.item.data as number;
    const to = event.container.data;
    if (from === to) {
      return;
    }
    this.store.swap(from, to);
  }

  onRemove(slot: number): void {
    this.store.clearCell(slot);
  }

  onSleepToggle(slot: number): void {
    const next = new Set(this.asleepSlots());
    if (next.has(slot)) {
      next.delete(slot);
    } else {
      next.add(slot);
    }
    this.asleepSlots.set(next);
  }

  onFocusToggle(slot: number): void {
    this.focusedSlot.set(this.focusedSlot() === slot ? null : slot);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.focusedSlot.set(null);
  }
}
