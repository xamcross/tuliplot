import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Credentials, RegisterPayload, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  register(body: RegisterPayload): Observable<User> {
    return this.http.post<User>(`${this.base}/auth/register`, body);
  }

  login(body: Credentials): Observable<User> {
    return this.http.post<User>(`${this.base}/auth/login`, body);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {});
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.base}/auth/me`);
  }
}
