import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HealthStatus {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class HealthApi {
  private readonly http = inject(HttpClient);

  check(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${environment.apiBaseUrl}/health`);
  }
}
