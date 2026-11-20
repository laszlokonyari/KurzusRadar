import { NextFunction, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { serializeAssessment, serializeCourse } from '../lib/serializers';
import {
  AuthenticatedRequest,
  requireAuth,
} from '../middleware/auth.middleware';

const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

workspaceRouter.get(
  '/',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const [courses, assessments] = await Promise.all([
        prisma.course.findMany({
          where: { userId: req.userId! },
          include: { slots: true },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.assessment.findMany({
          where: { userId: req.userId! },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        }),
      ]);

      res.status(200).json({
        courses: courses.map(serializeCourse),
        assessments: assessments.map(serializeAssessment),
      });
    } catch (err) {
      next(err);
    }
  }
);

workspaceRouter.delete(
  '/',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await prisma.$transaction([
        prisma.assessment.deleteMany({ where: { userId: req.userId! } }),
        prisma.course.deleteMany({ where: { userId: req.userId! } }),
      ]);

      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export { workspaceRouter };
