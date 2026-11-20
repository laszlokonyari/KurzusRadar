import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    res.status(400).json({
      error: firstIssue?.message ?? 'Érvénytelen bemeneti adatok.',
    });
    return;
  }

  if (env.nodeEnv !== 'production') {
    console.error(err);
  }

  res.status(500).json({
    error: 'Váratlan szerverhiba történt.',
  });
}
