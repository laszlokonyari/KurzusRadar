import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const SESSION_COOKIE_NAME = 'kr_session';

interface SessionTokenPayload {
  sub: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: '7d',
  });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.sub === 'string'
    ) {
      return { sub: decoded.sub };
    }
    return null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });
}
