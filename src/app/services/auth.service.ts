import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  AuthActionResult,
  AuthSession,
  RegisterPayload,
  StoredAccountRecord,
  UserAccount,
} from '../models/auth.models';

const ACCOUNTS_STORAGE_KEY = 'kurzusradar_accounts_v1';
const SESSION_STORAGE_KEY = 'kurzusradar_session_v1';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly sessionSignal = signal<AuthSession>(this.readInitialSession());
  private readonly scopeChangesSubject = new Subject<string | null>();

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

  enterDemoMode(): void {
    this.setSession({
      mode: 'demo',
      user: null,
    });
  }

  register(payload: RegisterPayload): AuthActionResult {
    const name = payload.name.trim();
    const email = payload.email.trim().toLowerCase();
    const password = payload.password;
    const semester = payload.semester.trim() || '2026/27/1';

    if (name.length < 2) {
      return { ok: false, error: 'Add meg a neved (legalább 2 karakter).' };
    }
    if (!email.includes('@') || email.length < 5) {
      return { ok: false, error: 'Adj meg egy érvényes e-mail címet.' };
    }
    if (password.length < 6) {
      return {
        ok: false,
        error: 'A jelszónak legalább 6 karakter hosszúnak kell lennie.',
      };
    }

    const accounts = this.readAccounts();
    if (accounts.some((account) => account.email === email)) {
      return {
        ok: false,
        error: 'Ezzel az e-mail címmel már létezik regisztrált fiók.',
      };
    }

    const created: StoredAccountRecord = {
      id: this.generateUserId(),
      name,
      email,
      semester,
      password,
      createdAt: new Date().toISOString(),
    };

    this.writeAccounts([...accounts, created]);
    this.setSession({
      mode: 'authenticated',
      user: this.toPublicUser(created),
    });

    return { ok: true };
  }

  login(emailInput: string, password: string): AuthActionResult {
    const email = emailInput.trim().toLowerCase();
    const accounts = this.readAccounts();
    const matched = accounts.find(
      (account) => account.email === email && account.password === password
    );

    if (!matched) {
      return {
        ok: false,
        error: 'Hibás e-mail cím vagy jelszó.',
      };
    }

    this.setSession({
      mode: 'authenticated',
      user: this.toPublicUser(matched),
    });

    return { ok: true };
  }

  logout(): void {
    this.setSession({
      mode: 'guest',
      user: null,
    });
  }

  private setSession(next: AuthSession): void {
    this.sessionSignal.set(next);
    this.persistSession(next);
    this.scopeChangesSubject.next(this.workspaceScope());
  }

  private toPublicUser(record: StoredAccountRecord): UserAccount {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      semester: record.semester,
      createdAt: record.createdAt,
    };
  }

  private readInitialSession(): AuthSession {
    if (typeof localStorage === 'undefined') {
      return { mode: 'guest', user: null };
    }

    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return { mode: 'guest', user: null };
    }

    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed.mode === 'demo') {
        return { mode: 'demo', user: null };
      }
      if (parsed.mode === 'authenticated' && parsed.user?.id) {
        return parsed;
      }
    } catch {
      return { mode: 'guest', user: null };
    }

    return { mode: 'guest', user: null };
  }

  private persistSession(session: AuthSession): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      if (session.mode === 'guest') {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
    } catch {
      return;
    }
  }

  private readAccounts(): StoredAccountRecord[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeAccounts(accounts: StoredAccountRecord[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } catch {
      return;
    }
  }

  private generateUserId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `usr_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }
}
