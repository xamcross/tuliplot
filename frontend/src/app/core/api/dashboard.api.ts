import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cell, Dashboard } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/dashboard`;

  get(): Observable<Dashboard> {
    return this.http.get<Dashboard>(this.base);
  }

  updateCells(cells: Cell[]): Observable<Dashboard> {
    return this.http.put<Dashboard>(`${this.base}/cells`, { cells });
  }
}
