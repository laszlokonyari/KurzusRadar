import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CLASS_SLOT_TYPE_LABELS,
  COURSE_COLOR_MAP,
  ClassSlotType,
  Course,
  CourseColorToken,
  CourseScheduleSlot,
  DAY_LABELS,
  DayOfWeek,
} from '../../models/academic.models';
import { AcademicStoreService } from '../../services/academic-store.service';
import {
  intervalsOverlap,
  parseTimeToMinutes,
} from '../../services/conflict-engine';

interface TimetableEntry {
  slot: CourseScheduleSlot;
  course: Course;
  color: string;
  hasOverlap: boolean;
}

interface TimetableDayColumn {
  day: DayOfWeek;
  label: string;
  entries: TimetableEntry[];
}

interface ColorOption {
  token: CourseColorToken;
  label: string;
  hex: string;
}

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './courses.html',
  styleUrl: './courses.css',
})
export class CoursesPage {
  protected readonly store = inject(AcademicStoreService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly dayLabels = DAY_LABELS;
  protected readonly slotTypeLabels = CLASS_SLOT_TYPE_LABELS;
  protected readonly colorMap = COURSE_COLOR_MAP;

  protected readonly allDays: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];
  protected readonly slotTypes: ClassSlotType[] = ['lecture', 'practice', 'lab'];
  protected readonly colorOptions: ColorOption[] = [
    { token: 'pine', label: 'Fenyő', hex: COURSE_COLOR_MAP.pine },
    { token: 'slate', label: 'Pala', hex: COURSE_COLOR_MAP.slate },
    { token: 'terracotta', label: 'Terrakotta', hex: COURSE_COLOR_MAP.terracotta },
    { token: 'ochre', label: 'Okker', hex: COURSE_COLOR_MAP.ochre },
    { token: 'indigo', label: 'Indigó', hex: COURSE_COLOR_MAP.indigo },
    { token: 'plum', label: 'Szilva', hex: COURSE_COLOR_MAP.plum },
  ];

  protected readonly courseFormOpen = signal(false);
  protected readonly editingCourseId = signal<string | null>(null);
  protected readonly activeSlotCourseId = signal<string | null>(null);
  protected readonly confirmDeleteCourseId = signal<string | null>(null);
  protected readonly slotError = signal<string | null>(null);

  protected readonly courseForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    credits: [5, [Validators.required, Validators.min(1), Validators.max(30)]],
    semester: ['2026/27/1', [Validators.required, Validators.maxLength(20)]],
    instructor: ['', [Validators.required, Validators.maxLength(60)]],
    colorToken: ['pine' as CourseColorToken, Validators.required],
  });

  protected readonly slotForm = this.fb.group({
    dayOfWeek: [1 as DayOfWeek, Validators.required],
    startTime: ['10:00', Validators.required],
    endTime: ['12:00', Validators.required],
    room: ['', [Validators.required, Validators.maxLength(30)]],
    type: ['lecture' as ClassSlotType, Validators.required],
  });

  protected readonly totalWeeklyHours = computed(() => {
    let totalMinutes = 0;
    for (const course of this.store.courses()) {
      for (const slot of course.slots) {
        const start = parseTimeToMinutes(slot.startTime);
        const end = parseTimeToMinutes(slot.endTime);
        if (start !== null && end !== null && end > start) {
          totalMinutes += end - start;
        }
      }
    }
    const hours = totalMinutes / 60;
    return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1).replace('.', ',');
  });

  protected readonly totalSlotCount = computed(() =>
    this.store.courses().reduce((sum, course) => sum + course.slots.length, 0)
  );

  protected readonly assessmentCountByCourse = computed(() => {
    const counts: Record<string, number> = {};
    for (const item of this.store.assessments()) {
      counts[item.courseId] = (counts[item.courseId] ?? 0) + 1;
    }
    return counts;
  });

  protected readonly overlappingSlotIds = computed(() => {
    const overlapping = new Set<string>();
    const allSlots: Array<{
      slot: CourseScheduleSlot;
      start: number;
      end: number;
    }> = [];

    for (const course of this.store.courses()) {
      for (const slot of course.slots) {
        const start = parseTimeToMinutes(slot.startTime);
        const end = parseTimeToMinutes(slot.endTime);
        if (start !== null && end !== null && start < end) {
          allSlots.push({ slot, start, end });
        }
      }
    }

    for (let i = 0; i < allSlots.length; i++) {
      for (let j = i + 1; j < allSlots.length; j++) {
        const first = allSlots[i];
        const second = allSlots[j];
        if (
          first.slot.dayOfWeek === second.slot.dayOfWeek &&
          intervalsOverlap(first.start, first.end, second.start, second.end)
        ) {
          overlapping.add(first.slot.id);
          overlapping.add(second.slot.id);
        }
      }
    }

    return overlapping;
  });

  protected readonly timetableColumns = computed<TimetableDayColumn[]>(() => {
    const courses = this.store.courses();
    const overlaps = this.overlappingSlotIds();
    const hasSaturday = courses.some((c) => c.slots.some((s) => s.dayOfWeek === 6));
    const hasSunday = courses.some((c) => c.slots.some((s) => s.dayOfWeek === 7));

    const visibleDays: DayOfWeek[] = [1, 2, 3, 4, 5];
    if (hasSaturday) {
      visibleDays.push(6);
    }
    if (hasSunday) {
      visibleDays.push(7);
    }

    return visibleDays.map((day) => {
      const entries: TimetableEntry[] = [];
      for (const course of courses) {
        for (const slot of course.slots) {
          if (slot.dayOfWeek === day) {
            entries.push({
              slot,
              course,
              color: COURSE_COLOR_MAP[course.colorToken],
              hasOverlap: overlaps.has(slot.id),
            });
          }
        }
      }

      entries.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));

      return {
        day,
        label: DAY_LABELS[day],
        entries,
      };
    });
  });

  protected openCreateForm(): void {
    this.editingCourseId.set(null);
    this.courseForm.reset({
      code: '',
      name: '',
      credits: 5,
      semester: '2026/27/1',
      instructor: '',
      colorToken: 'pine',
    });
    this.courseFormOpen.set(true);
  }

  protected openEditForm(course: Course): void {
    this.editingCourseId.set(course.id);
    this.courseForm.setValue({
      code: course.code,
      name: course.name,
      credits: course.credits,
      semester: course.semester,
      instructor: course.instructor,
      colorToken: course.colorToken,
    });
    this.courseFormOpen.set(true);
  }

  protected closeCourseForm(): void {
    this.courseFormOpen.set(false);
    this.editingCourseId.set(null);
  }

  protected selectColor(token: CourseColorToken): void {
    this.courseForm.controls.colorToken.setValue(token);
  }

  protected submitCourseForm(): void {
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      return;
    }

    const raw = this.courseForm.getRawValue();
    const payload = {
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      credits: Number(raw.credits),
      semester: raw.semester.trim(),
      instructor: raw.instructor.trim(),
      colorToken: raw.colorToken,
    };

    const currentId = this.editingCourseId();
    if (currentId) {
      this.store.updateCourse(currentId, payload);
    } else {
      this.store.addCourse({
        ...payload,
        slots: [],
      });
    }

    this.closeCourseForm();
  }

  protected toggleSlotForm(courseId: string): void {
    if (this.activeSlotCourseId() === courseId) {
      this.activeSlotCourseId.set(null);
      this.slotError.set(null);
      return;
    }

    this.activeSlotCourseId.set(courseId);
    this.slotError.set(null);
    this.slotForm.reset({
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '12:00',
      room: '',
      type: 'lecture',
    });
  }

  protected submitSlotForm(courseId: string): void {
    if (this.slotForm.invalid) {
      this.slotForm.markAllAsTouched();
      this.slotError.set('Kérlek tölts ki minden kötelező mezőt.');
      return;
    }

    const raw = this.slotForm.getRawValue();
    const start = parseTimeToMinutes(raw.startTime);
    const end = parseTimeToMinutes(raw.endTime);

    if (start === null || end === null || start >= end) {
      this.slotError.set('A befejezési időpontnak a kezdés után kell lennie.');
      return;
    }

    this.store.addSlotToCourse(courseId, {
      dayOfWeek: Number(raw.dayOfWeek) as DayOfWeek,
      startTime: raw.startTime,
      endTime: raw.endTime,
      room: raw.room.trim(),
      type: raw.type,
    });

    this.slotError.set(null);
    this.activeSlotCourseId.set(null);
  }

  protected removeSlot(courseId: string, slotId: string): void {
    this.store.removeSlotFromCourse(courseId, slotId);
  }

  protected requestDeleteCourse(courseId: string): void {
    this.confirmDeleteCourseId.set(courseId);
  }

  protected cancelDeleteCourse(): void {
    this.confirmDeleteCourseId.set(null);
  }

  protected confirmDeleteCourse(courseId: string): void {
    this.store.deleteCourse(courseId);
    this.confirmDeleteCourseId.set(null);
    if (this.editingCourseId() === courseId) {
      this.closeCourseForm();
    }
    if (this.activeSlotCourseId() === courseId) {
      this.activeSlotCourseId.set(null);
    }
  }

  protected sortedSlots(slots: CourseScheduleSlot[]): CourseScheduleSlot[] {
    return slots.slice().sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }

  protected linkedAssessmentCount(courseId: string): number {
    return this.assessmentCountByCourse()[courseId] ?? 0;
  }
}
