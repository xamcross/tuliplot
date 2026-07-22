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
      <input type="search" class="tl-input" placeholder="Search apps…" data-testid="catalog-search"
        [value]="query()" (input)="query.set(asValue($event))" />
      <ul class="apps">
        @for (app of filtered(); track app.id) {
          <li>
            <button type="button" class="app" [attr.data-testid]="'catalog-app-' + app.id" (click)="choose(app)">
              <img [src]="app.iconUrl" alt="" width="18" height="18" />
              <span class="name">{{ app.name }}</span>
              <span [class]="'compat-badge tl-pill tl-pill--neutral'" [attr.data-compat]="app.compatibility">{{ badgeFor(app) }}</span>
              <span class="cat">{{ app.category }}</span>
            </button>
          </li>
        } @empty {
          <li class="empty">No apps found</li>
        }
      </ul>
      <div class="actions">
        <button type="button" class="tl-btn tl-btn--soft tl-btn--sm" data-testid="catalog-url" (click)="chooseUrl()">Add by URL instead</button>
        <button type="button" class="ghost" data-testid="catalog-cancel" (click)="cancel()">Cancel</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { background: #fff; border-radius: 24px; box-shadow: var(--tl-shadow-card); padding: 28px;
      width: 100%; max-width: 480px; font-family: var(--tl-font-body); color: var(--tl-ink); }
    h2 { margin: 0 0 16px; font-family: var(--tl-font-display); font-weight: 700; font-size: 22px; }
    .apps { list-style: none; margin: 14px 0; padding: 0; max-height: 320px; overflow: auto;
      display: flex; flex-direction: column; gap: 2px; }
    .app { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none;
      border-radius: 12px; background: transparent; cursor: pointer; font-family: var(--tl-font-body);
      font-size: 15px; color: var(--tl-ink); text-align: left; }
    .app:hover { background: var(--tl-surface); }
    .app img { border-radius: 4px; }
    .name { font-weight: 600; }
    .compat-badge { margin-left: auto; }
    .cat { color: var(--tl-ink-faint); font-size: 12px; }
    .empty { padding: 16px; text-align: center; color: var(--tl-ink-faint); }
    .actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 14px; }
    .ghost { border: none; background: none; cursor: pointer; font-family: var(--tl-font-body);
      font-size: 14px; color: var(--tl-ink-soft); }
    .ghost:hover { color: var(--tl-ink); }
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
