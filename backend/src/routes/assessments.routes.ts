import { NextFunction, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  extractRouteParam,
  parseTimeToMinutes,
  serializeAssessment,
} from '../lib/serializers';
import {
  AuthenticatedRequest,
  requireAuth,
} from '../middleware/auth.middleware';

const assessmentsRouter = Router();

assessmentsRouter.use(requireAuth);

const assessmentTypeSchema = z.enum(['zh', 'assignment', 'exam', 'project']);
const assessmentStatusSchema = z.enum([
  'planned',
  'in_progress',
  'submitted',
  'graded',
]);

const optionalTimeSchema = z
  .union([
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Érvénytelen időformátum (ÓÓ:PP).'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((value) => (value ? value : null));

const optionalTextSchema = (maxLen: number) =>
  z
    .union([z.string().trim().max(maxLen), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const createAssessmentSchema = z.object({
  courseId: z.string().min(1, 'A tárgy kiválasztása kötelező.'),
  title: z.string().trim().min(1, 'A megnevezés kötelező.').max(100),
  type: assessmentTypeSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátumformátum (ÉÉÉÉ-HH-NN).'),
  startTime: optionalTimeSchema,
  endTime: optionalTimeSchema,
  weightPercent: z.coerce.number().int().min(0).max(100),
  status: assessmentStatusSchema.default('planned'),
  location: optionalTextSchema(60),
  notes: optionalTextSchema(300),
});

const updateAssessmentSchema = z.object({
  courseId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  type: assessmentTypeSchema.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátumformátum (ÉÉÉÉ-HH-NN).')
    .optional(),
  startTime: optionalTimeSchema,
  endTime: optionalTimeSchema,
  weightPercent: z.coerce.number().int().min(0).max(100).optional(),
  status: assessmentStatusSchema.optional(),
  location: optionalTextSchema(60),
  notes: optionalTextSchema(300),
});

function validateTimeWindow(
  startTime: string | null,
  endTime: string | null
): string | null {
  if ((startTime && !endTime) || (!startTime && endTime)) {
    return 'A kezdési és befejezési időpontot együtt add meg, vagy hagyd üresen mindkettőt.';
  }
  if (startTime && endTime) {
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    if (startMin === null || endMin === null || startMin >= endMin) {
      return 'A befejezési időpontnak a kezdés után kell lennie.';
    }
  }
  return null;
}

assessmentsRouter.get(
  '/',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const items = await prisma.assessment.findMany({
        where: { userId: req.userId! },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });

      res.status(200).json({ assessments: items.map(serializeAssessment) });
    } catch (err) {
      next(err);
    }
  }
);

assessmentsRouter.post(
  '/',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = createAssessmentSchema.parse(req.body);
      const timeError = validateTimeWindow(data.startTime, data.endTime);

      if (timeError) {
        res.status(400).json({ error: timeError });
        return;
      }

      const course = await prisma.course.findFirst({
        where: { id: data.courseId, userId: req.userId! },
        select: { id: true },
      });

      if (!course) {
        res.status(404).json({ error: 'A kiválasztott tárgy nem található.' });
        return;
      }

      const created = await prisma.assessment.create({
        data: {
          userId: req.userId!,
          courseId: course.id,
          title: data.title,
          type: data.type,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          weightPercent: data.weightPercent,
          status: data.status,
          location: data.location,
          notes: data.notes,
        },
      });

      res.status(201).json({ assessment: serializeAssessment(created) });
    } catch (err) {
      next(err);
    }
  }
);

assessmentsRouter.patch(
  '/:assessmentId',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const assessmentId = extractRouteParam(req.params['assessmentId']);
      const data = updateAssessmentSchema.parse(req.body);

      const existing = await prisma.assessment.findFirst({
        where: { id: assessmentId, userId: req.userId! },
      });

      if (!existing) {
        res.status(404).json({ error: 'A számonkérés nem található.' });
        return;
      }

      if (data.courseId !== undefined && data.courseId !== existing.courseId) {
        const course = await prisma.course.findFirst({
          where: { id: data.courseId, userId: req.userId! },
          select: { id: true },
        });
        if (!course) {
          res.status(404).json({ error: 'A kiválasztott tárgy nem található.' });
          return;
        }
      }

      const nextStartTime =
        req.body.startTime !== undefined ? data.startTime : existing.startTime;
      const nextEndTime =
        req.body.endTime !== undefined ? data.endTime : existing.endTime;

      const timeError = validateTimeWindow(nextStartTime, nextEndTime);
      if (timeError) {
        res.status(400).json({ error: timeError });
        return;
      }

      const updated = await prisma.assessment.update({
        where: { id: existing.id },
        data: {
          ...(data.courseId !== undefined ? { courseId: data.courseId } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.date !== undefined ? { date: data.date } : {}),
          ...(req.body.startTime !== undefined
            ? { startTime: nextStartTime }
            : {}),
          ...(req.body.endTime !== undefined ? { endTime: nextEndTime } : {}),
          ...(data.weightPercent !== undefined
            ? { weightPercent: data.weightPercent }
            : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(req.body.location !== undefined
            ? { location: data.location }
            : {}),
          ...(req.body.notes !== undefined ? { notes: data.notes } : {}),
        },
      });

      res.status(200).json({ assessment: serializeAssessment(updated) });
    } catch (err) {
      next(err);
    }
  }
);

assessmentsRouter.delete(
  '/:assessmentId',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const assessmentId = extractRouteParam(req.params['assessmentId']);

      const deleted = await prisma.assessment.deleteMany({
        where: { id: assessmentId, userId: req.userId! },
      });

      if (deleted.count === 0) {
        res.status(404).json({ error: 'A számonkérés nem található.' });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export { assessmentsRouter };
