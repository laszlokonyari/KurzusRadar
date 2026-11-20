import { NextFunction, Request, Response } from 'express';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  verifySessionToken,
} from '../lib/jwt';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (typeof token !== 'string' || token.length === 0) {
    res.status(401).json({ error: 'Bejelentkezés szükséges.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Érvénytelen vagy lejárt munkamenet.' });
    return;
  }

  req.userId = payload.sub;
  next();
}
