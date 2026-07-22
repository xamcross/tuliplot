import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CatalogApp } from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private http = inject(HttpClient);

  list(): Observable<CatalogApp[]> {
    return this.http.get<CatalogApp[]>(`${environment.apiBaseUrl}/catalog`);
  }
}
