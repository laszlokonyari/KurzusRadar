import {
  Assessment,
  CLASS_SLOT_TYPE_LABELS,
  ConflictRecord,
  Course,
  DAY_LABELS,
  DayOfWeek,
} from '../models/academic.models';

export function parseTimeToMinutes(time?: string): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

export function getIsoDayOfWeek(dateStr: string): DayOfWeek {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const jsDay = date.getDay();
  return (jsDay === 0 ? 7 : jsDay) as DayOfWeek;
}

export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && startB < endA;
}

export function detectAcademicConflicts(
  courses: Course[],
  assessments: Assessment[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  const courseMap = new Map<string, Course>(courses.map((c) => [c.id, c]));

  const activeAssessments = assessments.filter(
    (item) => item.status !== 'submitted' && item.status !== 'graded'
  );

  const byDate = new Map<string, Assessment[]>();
  for (const item of activeAssessments) {
    const group = byDate.get(item.date) ?? [];
    group.push(item);
    byDate.set(item.date, group);
  }

  for (const [date, dayItems] of byDate.entries()) {
    const timedItems = dayItems
      .map((item) => ({
        item,
        start: parseTimeToMinutes(item.startTime),
        end: parseTimeToMinutes(item.endTime),
      }))
      .filter(
        (entry): entry is { item: Assessment; start: number; end: number } =>
          entry.start !== null && entry.end !== null && entry.start < entry.end
      );

    for (let i = 0; i < timedItems.length; i++) {
      for (let j = i + 1; j < timedItems.length; j++) {
        const first = timedItems[i];
        const second = timedItems[j];

        if (intervalsOverlap(first.start, first.end, second.start, second.end)) {
          const courseA = courseMap.get(first.item.courseId);
          const courseB = courseMap.get(second.item.courseId);
          const codeA = courseA ? courseA.code : 'Ismeretlen tárgy';
          const codeB = courseB ? courseB.code : 'Ismeretlen tárgy';

          conflicts.push({
            id: `overlap-${first.item.id}-${second.item.id}`,
            severity: 'critical',
            category: 'time_overlap',
            date,
            title: `Időpont-ütközés: ${codeA} és ${codeB}`,
            description: `${first.item.title} (${first.item.startTime}–${first.item.endTime}) átfedésben van ezzel: ${second.item.title} (${second.item.startTime}–${second.item.endTime}).`,
            involvedAssessmentIds: [first.item.id, second.item.id],
            involvedCourseIds: Array.from(
              new Set([first.item.courseId, second.item.courseId])
            ),
          });
        }
      }
    }

    const dayOfWeek = getIsoDayOfWeek(date);
    for (const entry of timedItems) {
      for (const course of courses) {
        if (course.id === entry.item.courseId) {
          continue;
        }
        for (const slot of course.slots) {
          if (slot.dayOfWeek !== dayOfWeek) {
            continue;
          }
          const slotStart = parseTimeToMinutes(slot.startTime);
          const slotEnd = parseTimeToMinutes(slot.endTime);
          if (slotStart === null || slotEnd === null || slotStart >= slotEnd) {
            continue;
          }
          if (intervalsOverlap(entry.start, entry.end, slotStart, slotEnd)) {
            const slotLabel = CLASS_SLOT_TYPE_LABELS[slot.type].toLowerCase();
            conflicts.push({
              id: `class-${entry.item.id}-${slot.id}`,
              severity: 'warning',
              category: 'class_collision',
              date,
              title: `Órarendi ütközés: ${course.code} ${slotLabel}`,
              description: `${entry.item.title} (${entry.item.startTime}–${entry.item.endTime}) ütközik a(z) ${DAY_LABELS[dayOfWeek]} ${slot.startTime}–${slot.endTime} (${slot.room}) órával.`,
              involvedAssessmentIds: [entry.item.id],
              involvedCourseIds: Array.from(
                new Set([entry.item.courseId, course.id])
              ),
            });
          }
        }
      }
    }

    const totalWeight = dayItems.reduce((sum, item) => sum + item.weightPercent, 0);
    const majorCount = dayItems.filter(
      (item) => item.type === 'zh' || item.type === 'exam'
    ).length;

    if (dayItems.length >= 3 || majorCount >= 2 || totalWeight >= 40) {
      const reasons: string[] = [];
      if (majorCount >= 2) {
        reasons.push(`${majorCount} számonkérés`);
      }
      if (dayItems.length >= 3) {
        reasons.push(`${dayItems.length} aktív határidő`);
      }
      if (totalWeight >= 40) {
        reasons.push(`${totalWeight}% összsúly`);
      }

      conflicts.push({
        id: `overload-${date}`,
        severity: 'warning',
        category: 'daily_overload',
        date,
        title: `Napi terhelési csúcs (${date})`,
        description: `Egy napra koncentrálódó terhelés: ${reasons.join(', ')}. Érdemes előrehozni a felkészülést vagy pótalkalmat tervezni.`,
        involvedAssessmentIds: dayItems.map((item) => item.id),
        involvedCourseIds: Array.from(new Set(dayItems.map((item) => item.courseId))),
      });
    }
  }

  return conflicts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return a.date.localeCompare(b.date);
  });
}
