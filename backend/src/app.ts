import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { assessmentsRouter } from './routes/assessments.routes';
import { authRouter } from './routes/auth.routes';
import { coursesRouter } from './routes/courses.routes';
import { workspaceRouter } from './routes/workspace.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/workspace', workspaceRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/assessments', assessmentsRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'A kért végpont nem található.' });
  });

  app.use(errorHandler);

  return app;
}
