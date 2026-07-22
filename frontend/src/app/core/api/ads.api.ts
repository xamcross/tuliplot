import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdConfig } from '../models/ads.model';

@Injectable({ providedIn: 'root' })
export class AdsApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getConfig(): Observable<AdConfig> {
    return this.http.get<AdConfig>(`${this.base}/config/ads`);
  }
}
