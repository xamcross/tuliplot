import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { isSafeHttpsUrl } from '../../core/util/url.util';

export interface AddUrlResult {
  url: string;
  title: string;
}

@Component({
  selector: 'tl-add-url-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" data-testid="add-url-dialog">
      <h2>Add a URL</h2>
      <label class="tl-field-label" for="add-url-url">URL</label>
      <input id="add-url-url" type="url" class="tl-input" data-testid="url-input" placeholder="https://…"
        [value]="url()" (input)="url.set(asValue($event))" />
      @if (url() && !valid()) {
        <p class="tl-form-error" data-testid="url-error">Enter a valid https:// URL</p>
      }
      <label class="tl-field-label" for="add-url-title">Title</label>
      <input id="add-url-title" type="text" class="tl-input" data-testid="title-input"
        [value]="title()" (input)="title.set(asValue($event))" />
      <div class="actions">
        <button type="button" class="ghost" data-testid="url-cancel" (click)="cancel()">Cancel</button>
        <button type="button" class="tl-btn tl-btn--primary tl-btn--sm" data-testid="url-add" [disabled]="!valid()" (click)="add()">Add</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { background: var(--tl-card-bg); border-radius: 24px; box-shadow: var(--tl-shadow-card); padding: 28px;
      width: 100%; max-width: 420px; font-family: var(--tl-font-body); color: var(--tl-ink); }
    h2 { margin: 0 0 16px; font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; }
    .tl-input { margin-bottom: 16px; }
    .actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 6px; }
    .ghost { border: none; background: none; cursor: pointer; font-family: var(--tl-font-body);
      font-size: 14px; color: var(--tl-ink-soft); }
    .ghost:hover { color: var(--tl-ink); }
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
