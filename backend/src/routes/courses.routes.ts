import { NextFunction, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  extractRouteParam,
  parseTimeToMinutes,
  serializeCourse,
  serializeSlot,
} from '../lib/serializers';
import {
  AuthenticatedRequest,
  requireAuth,
} from '../middleware/auth.middleware';

const coursesRouter = Router();

coursesRouter.use(requireAuth);

const colorTokenSchema = z.enum([
  'pine',
  'slate',
  'terracotta',
  'ochre',
  'indigo',
  'plum',
]);

const slotTypeSchema = z.enum(['lecture', 'practice', 'lab']);

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Érvénytelen időformátum (ÓÓ:PP).');

const createCourseSchema = z.object({
  code: z.string().trim().min(1, 'A tárgykód kötelező.').max(20),
  name: z.string().trim().min(1, 'A tárgy megnevezése kötelező.').max(80),
  credits: z.coerce.number().int().min(1).max(30),
  semester: z.string().trim().min(1, 'A félév kötelező.').max(20),
  instructor: z.string().trim().min(1, 'Az oktató neve kötelező.').max(60),
  colorToken: colorTokenSchema.default('pine'),
});

const updateCourseSchema = createCourseSchema.partial();

const createSlotSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    room: z.string().trim().min(1, 'A terem megadása kötelező.').max(30),
    type: slotTypeSchema,
  })
  .refine(
    (data) => {
      const start = parseTimeToMinutes(data.startTime);
      const end = parseTimeToMinutes(data.endTime);
      return start !== null && end !== null && start < end;
    },
    {
      message: 'A befejezési időpontnak a kezdés után kell lennie.',
    }
  );

coursesRouter.get(
  '/',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const courses = await prisma.course.findMany({
        where: { userId: req.userId! },
        include: { slots: true },
        orderBy: { createdAt: 'asc' },
      });

      res.status(200).json({ courses: courses.map(serializeCourse) });
    } catch (err) {
      next(err);
    }
  }
);

coursesRouter.post(
  '/',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = createCourseSchema.parse(req.body);

      const created = await prisma.course.create({
        data: {
          userId: req.userId!,
          code: data.code.toUpperCase(),
          name: data.name,
          credits: data.credits,
          semester: data.semester,
          instructor: data.instructor,
          colorToken: data.colorToken,
        },
        include: { slots: true },
      });

      res.status(201).json({ course: serializeCourse(created) });
    } catch (err) {
      next(err);
    }
  }
);

coursesRouter.patch(
  '/:courseId',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const courseId = extractRouteParam(req.params['courseId']);
      const data = updateCourseSchema.parse(req.body);

      const existing = await prisma.course.findFirst({
        where: { id: courseId, userId: req.userId! },
        select: { id: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'A tárgy nem található.' });
        return;
      }

      const updated = await prisma.course.update({
        where: { id: courseId },
        data: {
          ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.credits !== undefined ? { credits: data.credits } : {}),
          ...(data.semester !== undefined ? { semester: data.semester } : {}),
          ...(data.instructor !== undefined
            ? { instructor: data.instructor }
            : {}),
          ...(data.colorToken !== undefined
            ? { colorToken: data.colorToken }
            : {}),
        },
        include: { slots: true },
      });

      res.status(200).json({ course: serializeCourse(updated) });
    } catch (err) {
      next(err);
    }
  }
);

coursesRouter.delete(
  '/:courseId',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const courseId = extractRouteParam(req.params['courseId']);

      const deleted = await prisma.course.deleteMany({
        where: { id: courseId, userId: req.userId! },
      });

      if (deleted.count === 0) {
        res.status(404).json({ error: 'A tárgy nem található.' });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

coursesRouter.post(
  '/:courseId/slots',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const courseId = extractRouteParam(req.params['courseId']);
      const data = createSlotSchema.parse(req.body);

      const course = await prisma.course.findFirst({
        where: { id: courseId, userId: req.userId! },
        select: { id: true },
      });

      if (!course) {
        res.status(404).json({ error: 'A tárgy nem található.' });
        return;
      }

      const created = await prisma.courseScheduleSlot.create({
        data: {
          courseId: course.id,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          room: data.room,
          type: data.type,
        },
      });

      res.status(201).json({ slot: serializeSlot(created) });
    } catch (err) {
      next(err);
    }
  }
);

coursesRouter.delete(
  '/:courseId/slots/:slotId',
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const courseId = extractRouteParam(req.params['courseId']);
      const slotId = extractRouteParam(req.params['slotId']);

      const course = await prisma.course.findFirst({
        where: { id: courseId, userId: req.userId! },
        select: { id: true },
      });

      if (!course) {
        res.status(404).json({ error: 'A tárgy nem található.' });
        return;
      }

      const deleted = await prisma.courseScheduleSlot.deleteMany({
        where: { id: slotId, courseId: course.id },
      });

      if (deleted.count === 0) {
        res.status(404).json({ error: 'Az órarendi sáv nem található.' });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export { coursesRouter };
