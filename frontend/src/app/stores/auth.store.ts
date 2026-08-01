import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, pipe, switchMap, tap } from 'rxjs';
import { AuthApi } from '../core/api/auth.api';
import { Tier } from '../core/models/enums';
import { Credentials, RegisterPayload, User } from '../core/models/user.model';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
}

const initialState: AuthState = { user: null, status: 'idle', error: null };

function messageFrom(err: unknown): string {
  const e = err as { error?: { message?: string } };
  return e?.error?.message ?? 'Something went wrong. Please try again.';
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({
    isAuthenticated: computed(() => user() !== null),
    tier: computed<Tier>(() => user()?.tier ?? 'FREE'),
    adFree: computed(() => user()?.adFree ?? false),
  })),
  withMethods((store, api = inject(AuthApi)) => ({
    loadMe: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(() =>
          api.me().pipe(
            tap((user) => patchState(store, { user, status: 'authenticated' })),
            catchError(() => {
              patchState(store, { user: null, status: 'anonymous' });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
    login: rxMethod<Credentials>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap((cred) =>
          api.login(cred).pipe(
            tap((user) => patchState(store, { user, status: 'authenticated', error: null })),
            catchError((err) => {
              patchState(store, { user: null, status: 'error', error: messageFrom(err) });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
    register: rxMethod<RegisterPayload>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap((payload) =>
          api.register(payload).pipe(
            tap((user) => patchState(store, { user, status: 'authenticated', error: null })),
            catchError((err) => {
              patchState(store, { user: null, status: 'error', error: messageFrom(err) });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
    logout: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { user: null, status: 'anonymous', error: null })),
        switchMap(() =>
          api.logout().pipe(
            tap(() => patchState(store, { user: null, status: 'anonymous', error: null })),
            catchError(() => {
              patchState(store, { user: null, status: 'anonymous' });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
  })),
);
