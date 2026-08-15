import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Sets "<route title> · TulipLot" when the resolved route declares a title.
 * Leaves the document title alone otherwise: the SeoService pages set their
 * own titles, and this strategy must not overwrite them.
 */
@Injectable({ providedIn: 'root' })
export class TlTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    if (routeTitle !== undefined) {
      this.title.setTitle(`${routeTitle} · TulipLot`);
    }
  }
}
