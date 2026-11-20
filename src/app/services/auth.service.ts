import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import {
  AuthActionResult,
  AuthSession,
  RegisterPayload,
  UserAccount,
} from '../models/auth.models';

const DEMO_MODE_STORAGE_KEY = 'kurzusradar_demo_active_v1';

interface AuthResponse {
  user: UserAccount;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionSignal = signal<AuthSession>(this.readInitialState());
  private readonly scopeChangesSubject = new Subject<string | null>();
  private initPromise: Promise<void> | null = null;

  readonly session = this.sessionSignal.asReadonly();
  readonly scopeChanges$ = this.scopeChangesSubject.asObservable();

  readonly mode = computed(() => this.sessionSignal().mode);
  readonly currentUser = computed(() => this.sessionSignal().user);
  readonly isDemo = computed(() => this.sessionSignal().mode === 'demo');
  readonly isAuthenticated = computed(
    () => this.sessionSignal().mode === 'authenticated'
  );
  readonly hasWorkspaceAccess = computed(
    () => this.sessionSignal().mode !== 'guest'
  );

  readonly workspaceScope = computed<string | null>(() => {
    const current = this.sessionSignal();
    if (current.mode === 'demo') {
      return 'demo';
    }
    if (current.mode === 'authenticated' && current.user) {
      return `user_${current.user.id}`;
    }
    return null;
  });

  constructor() {
    void this.ensureInitialized();
  }

  ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.restoreSessionFromApi();
    }
    return this.initPromise;
  }

  enterDemoMode(): void {
    this.writeDemoFlag(true);
    this.setSession({
      mode: 'demo',
      user: null,
    });
  }

  async register(payload: RegisterPayload): Promise<AuthActionResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>('/api/auth/register', payload, {
          withCredentials: true,
        })
      );

      this.writeDemoFlag(false);
      this.setSession({
        mode: 'authenticated',
        user: response.user,
      });

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: this.extractErrorMessage(err, 'A regisztráció nem sikerült.'),
      };
    }
  }

  async login(email: string, password: string): Promise<AuthActionResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(
          '/api/auth/login',
          { email, password },
          { withCredentials: true }
        )
      );

      this.writeDemoFlag(false);
      this.setSession({
        mode: 'authenticated',
        user: response.user,
      });

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: this.extractErrorMessage(err, 'Sikertelen bejelentkezés.'),
      };
    }
  }

  async logout(): Promise<void> {
    const wasAuthenticated = this.isAuthenticated();
    this.writeDemoFlag(false);
    this.setSession({
      mode: 'guest',
      user: null,
    });

    if (wasAuthenticated) {
      try {
        await firstValueFrom(
          this.http.post('/api/auth/logout', {}, { withCredentials: true })
        );
      } catch {
        return;
      }
    }
  }

  private async restoreSessionFromApi(): Promise<void> {
    if (this.sessionSignal().mode === 'demo') {
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<AuthResponse>('/api/auth/me', {
          withCredentials: true,
        })
      );

      if (this.sessionSignal().mode !== 'demo') {
        this.setSession({
          mode: 'authenticated',
          user: response.user,
        });
      }
    } catch {
      if (this.sessionSignal().mode !== 'demo') {
        this.sessionSignal.set({ mode: 'guest', user: null });
      }
    }
  }

  private setSession(next: AuthSession): void {
    this.sessionSignal.set(next);
    this.scopeChangesSubject.next(this.workspaceScope());
  }

  private readInitialState(): AuthSession {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true') {
        return { mode: 'demo', user: null };
      }
    }
    return { mode: 'guest', user: null };
  }

  private writeDemoFlag(active: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      if (active) {
        localStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'A szerver jelenleg nem elérhető. Próbáld újra egy pillanat múlva.';
      }
      const apiError = err.error?.error;
      if (typeof apiError === 'string' && apiError.length > 0) {
        return apiError;
      }
    }
    return fallback;
  }
}
