import { Assessment, CourseScheduleSlot, Prisma } from '@prisma/client';

export type CourseWithSlots = Prisma.CourseGetPayload<{
  include: { slots: true };
}>;

export function serializeSlot(slot: CourseScheduleSlot) {
  return {
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
    type: slot.type,
  };
}

export function serializeCourse(course: CourseWithSlots) {
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    credits: course.credits,
    semester: course.semester,
    instructor: course.instructor,
    colorToken: course.colorToken,
    slots: course.slots
      .slice()
      .sort((a, b) =>
        a.dayOfWeek !== b.dayOfWeek
          ? a.dayOfWeek - b.dayOfWeek
          : a.startTime.localeCompare(b.startTime)
      )
      .map(serializeSlot),
  };
}

export function serializeAssessment(item: Assessment) {
  return {
    id: item.id,
    courseId: item.courseId,
    title: item.title,
    type: item.type,
    date: item.date,
    startTime: item.startTime ?? undefined,
    endTime: item.endTime ?? undefined,
    weightPercent: item.weightPercent,
    status: item.status,
    location: item.location ?? undefined,
    notes: item.notes ?? undefined,
  };
}

export function parseTimeToMinutes(time: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return null;
  }
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function extractRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}
