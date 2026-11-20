import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
} from '../lib/jwt';
import { prisma } from '../lib/prisma';
import {
  AuthenticatedRequest,
  requireAuth,
} from '../middleware/auth.middleware';

const authRouter = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Túl sok próbálkozás rövid időn belül. Próbáld újra később.',
  },
});

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Add meg a neved (legalább 2 karakter).')
    .max(60, 'A név legfeljebb 60 karakter lehet.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Adj meg egy érvényes e-mail címet.'),
  password: z
    .string()
    .min(6, 'A jelszónak legalább 6 karakter hosszúnak kell lennie.')
    .max(128, 'A jelszó túl hosszú.'),
  semester: z
    .string()
    .trim()
    .min(1, 'Add meg az aktív félévet.')
    .max(20, 'A félév azonosító túl hosszú.')
    .default('2026/27/1'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Érvénytelen e-mail cím.'),
  password: z.string().min(1, 'Add meg a jelszavad.'),
});

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  semester: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    semester: user.semester,
    createdAt: user.createdAt.toISOString(),
  };
}

authRouter.post(
  '/register',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = registerSchema.parse(req.body);

      const existing = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });

      if (existing) {
        res.status(409).json({
          error: 'Ezzel az e-mail címmel már létezik regisztrált fiók.',
        });
        return;
      }

      const passwordHash = await bcrypt.hash(data.password, 12);

      const created = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          semester: data.semester,
        },
        select: {
          id: true,
          name: true,
          email: true,
          semester: true,
          createdAt: true,
        },
      });

      const token = signSessionToken(created.id);
      setSessionCookie(res, token);

      res.status(201).json({ user: toPublicUser(created) });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post(
  '/login',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        res.status(401).json({ error: 'Hibás e-mail cím vagy jelszó.' });
        return;
      }

      const passwordMatches = await bcrypt.compare(
        data.password,
        user.passwordHash
      );

      if (!passwordMatches) {
        res.status(401).json({ error: 'Hibás e-mail cím vagy jelszó.' });
        return;
      }

      const token = signSessionToken(user.id);
      setSessionCookie(res, token);

      res.status(200).json({ user: toPublicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post('/logout', (_req: Request, res: Response): void => {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          name: true,
          email: true,
          semester: true,
          createdAt: true,
        },
      });

      if (!user) {
        clearSessionCookie(res);
        res.status(401).json({ error: 'A fiók nem található.' });
        return;
      }

      res.status(200).json({ user: toPublicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

export { authRouter };
