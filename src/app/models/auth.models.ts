export interface UserAccount {
  id: string;
  name: string;
  email: string;
  semester: string;
  createdAt: string;
}

export type SessionMode = 'guest' | 'demo' | 'authenticated';

export interface AuthSession {
  mode: SessionMode;
  user: UserAccount | null;
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  semester: string;
}
