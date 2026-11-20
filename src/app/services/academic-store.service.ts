import { Injectable, computed, effect, signal } from '@angular/core';
import { createSeedData } from '../data/seed-data';
import {
  Assessment,
  AssessmentStatus,
  ConflictRecord,
  Course,
  CourseScheduleSlot,
} from '../models/academic.models';
import { detectAcademicConflicts } from './conflict-engine';

const COURSES_STORAGE_KEY = 'kurzusradar_courses_v1';
const ASSESSMENTS_STORAGE_KEY = 'kurzusradar_assessments_v1';

@Injectable({
  providedIn: 'root',
})
export class AcademicStoreService {
  private readonly coursesSignal = signal<Course[]>([]);
  private readonly assessmentsSignal = signal<Assessment[]>([]);

  readonly courses = this.coursesSignal.asReadonly();
  readonly assessments = this.assessmentsSignal.asReadonly();

  readonly courseMap = computed(() => {
    const map = new Map<string, Course>();
    for (const course of this.coursesSignal()) {
      map.set(course.id, course);
    }
    return map;
  });

  readonly conflicts = computed<ConflictRecord[]>(() =>
    detectAcademicConflicts(this.coursesSignal(), this.assessmentsSignal())
  );

  readonly criticalConflicts = computed(() =>
    this.conflicts().filter((conflict) => conflict.severity === 'critical')
  );

  readonly warningConflicts = computed(() =>
    this.conflicts().filter((conflict) => conflict.severity === 'warning')
  );

  readonly conflictsByAssessmentId = computed(() => {
    const index: Record<string, ConflictRecord[]> = {};
    for (const conflict of this.conflicts()) {
      for (const assessmentId of conflict.involvedAssessmentIds) {
        if (!index[assessmentId]) {
          index[assessmentId] = [];
        }
        index[assessmentId].push(conflict);
      }
    }
    return index;
  });

  readonly totalCredits = computed(() =>
    this.coursesSignal().reduce((sum, course) => sum + course.credits, 0)
  );

  readonly activeAssessmentsCount = computed(
    () =>
      this.assessmentsSignal().filter(
        (item) => item.status !== 'submitted' && item.status !== 'graded'
      ).length
  );

  readonly upcomingAssessments = computed(() =>
    this.assessmentsSignal()
      .filter((item) => item.status !== 'submitted' && item.status !== 'graded')
      .slice()
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return (a.startTime ?? '23:59').localeCompare(b.startTime ?? '23:59');
      })
  );

  constructor() {
    this.hydrateFromStorage();

    effect(() => {
      this.persist(COURSES_STORAGE_KEY, this.coursesSignal());
    });

    effect(() => {
      this.persist(ASSESSMENTS_STORAGE_KEY, this.assessmentsSignal());
    });
  }

  addCourse(input: Omit<Course, 'id'>): Course {
    const created: Course = {
      ...input,
      id: this.generateId('course'),
    };
    this.coursesSignal.update((list) => [...list, created]);
    return created;
  }

  updateCourse(courseId: string, patch: Partial<Omit<Course, 'id'>>): void {
    this.coursesSignal.update((list) =>
      list.map((course) =>
        course.id === courseId ? { ...course, ...patch } : course
      )
    );
  }

  deleteCourse(courseId: string): void {
    this.coursesSignal.update((list) =>
      list.filter((course) => course.id !== courseId)
    );
    this.assessmentsSignal.update((list) =>
      list.filter((item) => item.courseId !== courseId)
    );
  }

  addSlotToCourse(
    courseId: string,
    slot: Omit<CourseScheduleSlot, 'id'>
  ): void {
    const createdSlot: CourseScheduleSlot = {
      ...slot,
      id: this.generateId('slot'),
    };
    this.coursesSignal.update((list) =>
      list.map((course) =>
        course.id === courseId
          ? { ...course, slots: [...course.slots, createdSlot] }
          : course
      )
    );
  }

  removeSlotFromCourse(courseId: string, slotId: string): void {
    this.coursesSignal.update((list) =>
      list.map((course) =>
        course.id === courseId
          ? {
            ...course,
            slots: course.slots.filter((slot) => slot.id !== slotId),
          }
          : course
      )
    );
  }

  addAssessment(input: Omit<Assessment, 'id'>): Assessment {
    const created: Assessment = {
      ...input,
      id: this.generateId('assess'),
    };
    this.assessmentsSignal.update((list) => [...list, created]);
    return created;
  }

  updateAssessment(
    assessmentId: string,
    patch: Partial<Omit<Assessment, 'id'>>
  ): void {
    this.assessmentsSignal.update((list) =>
      list.map((item) =>
        item.id === assessmentId ? { ...item, ...patch } : item
      )
    );
  }

  updateAssessmentStatus(
    assessmentId: string,
    status: AssessmentStatus
  ): void {
    this.updateAssessment(assessmentId, { status });
  }

  deleteAssessment(assessmentId: string): void {
    this.assessmentsSignal.update((list) =>
      list.filter((item) => item.id !== assessmentId)
    );
  }

  resetToDemoData(): void {
    const seed = createSeedData();
    this.coursesSignal.set(seed.courses);
    this.assessmentsSignal.set(seed.assessments);
  }

  clearAllData(): void {
    this.coursesSignal.set([]);
    this.assessmentsSignal.set([]);
  }

  private hydrateFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      this.resetToDemoData();
      return;
    }

    const rawCourses = localStorage.getItem(COURSES_STORAGE_KEY);
    const rawAssessments = localStorage.getItem(ASSESSMENTS_STORAGE_KEY);

    if (rawCourses === null && rawAssessments === null) {
      this.resetToDemoData();
      return;
    }

    try {
      const parsedCourses: Course[] = rawCourses ? JSON.parse(rawCourses) : [];
      const parsedAssessments: Assessment[] = rawAssessments
        ? JSON.parse(rawAssessments)
        : [];
      this.coursesSignal.set(Array.isArray(parsedCourses) ? parsedCourses : []);
      this.assessmentsSignal.set(
        Array.isArray(parsedAssessments) ? parsedAssessments : []
      );
    } catch {
      this.resetToDemoData();
    }
  }

  private persist(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
