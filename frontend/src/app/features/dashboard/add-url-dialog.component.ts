import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { isSafeHttpsUrl } from '../../core/util/url.util';

export interface AddUrlResult {
  url: string;
  title: string;
}

@Component({
  selector: 'dd-add-url-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" data-testid="add-url-dialog">
      <h2>Add a URL</h2>
      <label>URL
        <input type="url" data-testid="url-input" placeholder="https://…"
          [value]="url()" (input)="url.set(asValue($event))" />
      </label>
      @if (url() && !valid()) {
        <p class="err" data-testid="url-error">Enter a valid https:// URL</p>
      }
      <label>Title
        <input type="text" data-testid="title-input"
          [value]="title()" (input)="title.set(asValue($event))" />
      </label>
      <div class="actions">
        <button type="button" data-testid="url-cancel" (click)="cancel()">Cancel</button>
        <button type="button" data-testid="url-add" [disabled]="!valid()" (click)="add()">Add</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { background: #fff; padding: 16px; width: 100%; max-width: 420px; }
    label { display: block; margin: 8px 0; }
    input { width: 100%; padding: 6px; box-sizing: border-box; }
    .err { color: #c0392b; font-size: 12px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
  `],
})
export class AddUrlDialogComponent {
  private dialogRef = inject<DialogRef<AddUrlResult | null>>(DialogRef);

  readonly url = signal('');
  readonly title = signal('');
  readonly valid = computed(() => isSafeHttpsUrl(this.url()));

  protected asValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  add(): void {
    if (!this.valid()) {
      return;
    }
    const u = this.url().trim();
    this.dialogRef.close({ url: u, title: this.title().trim() || u });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
