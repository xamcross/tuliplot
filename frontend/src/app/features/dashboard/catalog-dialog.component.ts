import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogApi } from '../../core/api/catalog.api';
import { CatalogApp } from '../../core/models/catalog.model';
import { compatibilityBadge } from '../../core/services/compatibility.util';

type CatalogChoice = CatalogApp | 'ADD_URL';

@Component({
  selector: 'tl-catalog-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" data-testid="catalog-dialog">
      <h2>Add an app</h2>
      <input type="search" placeholder="Search apps…" data-testid="catalog-search"
        [value]="query()" (input)="query.set(asValue($event))" />
      <ul class="apps">
        @for (app of filtered(); track app.id) {
          <li>
            <button type="button" class="app" [attr.data-testid]="'catalog-app-' + app.id" (click)="choose(app)">
              <img [src]="app.iconUrl" alt="" width="18" height="18" />
              <span class="name">{{ app.name }}</span>
              <span class="compat-badge" [attr.data-compat]="app.compatibility">{{ badgeFor(app) }}</span>
              <span class="cat">{{ app.category }}</span>
            </button>
          </li>
        } @empty {
          <li class="empty">No apps found</li>
        }
      </ul>
      <div class="actions">
        <button type="button" data-testid="catalog-url" (click)="chooseUrl()">Add by URL instead</button>
        <button type="button" data-testid="catalog-cancel" (click)="cancel()">Cancel</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { background: #fff; padding: 16px; width: 100%; max-width: 480px; }
    .apps { list-style: none; margin: 8px 0; padding: 0; max-height: 320px; overflow: auto; }
    .app { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px; border: none; background: transparent; cursor: pointer; }
    .app:hover { background: #f2f2f2; }
    .compat-badge { margin-left: auto; color: #555; font-size: 11px; background: #eee; border-radius: 8px; padding: 2px 8px; }
    .cat { color: #999; font-size: 12px; }
    .actions { display: flex; justify-content: space-between; margin-top: 8px; }
  `],
})
export class CatalogDialogComponent {
  private dialogRef = inject<DialogRef<CatalogChoice | null>>(DialogRef);
  private catalogApi = inject(CatalogApi);

  readonly query = signal('');
  private readonly apps = toSignal(this.catalogApi.list(), { initialValue: [] as CatalogApp[] });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.apps();
    if (!q) {
      return list;
    }
    return list.filter((a) => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  });

  protected asValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  badgeFor(app: CatalogApp): string {
    return compatibilityBadge(app.compatibility);
  }

  choose(app: CatalogApp): void {
    this.dialogRef.close(app);
  }

  chooseUrl(): void {
    this.dialogRef.close('ADD_URL');
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
