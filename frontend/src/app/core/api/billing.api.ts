import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  createPortalSession(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/billing/portal-session`, {});
  }
}
