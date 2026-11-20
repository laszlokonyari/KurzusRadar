import { Injectable, computed, inject, signal } from '@angular/core';
import { createSeedData } from '../data/seed-data';
import {
  Assessment,
  AssessmentStatus,
  ConflictRecord,
  Course,
  CourseScheduleSlot,
} from '../models/academic.models';
import { AuthService } from './auth.service';
import { detectAcademicConflicts } from './conflict-engine';

@Injectable({
  providedIn: 'root',
})
export class AcademicStoreService {
  private readonly auth = inject(AuthService);
  private readonly coursesSignal = signal<Course[]>([]);
  private readonly assessmentsSignal = signal<Assessment[]>([]);
  private activeScope: string | null = null;

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
    this.hydrateForScope(this.auth.workspaceScope());
    this.auth.scopeChanges$.subscribe((scope) => {
      this.hydrateForScope(scope);
    });
  }

  addCourse(input: Omit<Course, 'id'>): Course {
    const created: Course = {
      ...input,
      id: this.generateId('course'),
    };
    this.coursesSignal.update((list) => [...list, created]);
    this.persistCurrentScope();
    return created;
  }

  updateCourse(courseId: string, patch: Partial<Omit<Course, 'id'>>): void {
    this.coursesSignal.update((list) =>
      list.map((course) =>
        course.id === courseId ? { ...course, ...patch } : course
      )
    );
    this.persistCurrentScope();
  }

  deleteCourse(courseId: string): void {
    this.coursesSignal.update((list) =>
      list.filter((course) => course.id !== courseId)
    );
    this.assessmentsSignal.update((list) =>
      list.filter((item) => item.courseId !== courseId)
    );
    this.persistCurrentScope();
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
    this.persistCurrentScope();
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
    this.persistCurrentScope();
  }

  addAssessment(input: Omit<Assessment, 'id'>): Assessment {
    const created: Assessment = {
      ...input,
      id: this.generateId('assess'),
    };
    this.assessmentsSignal.update((list) => [...list, created]);
    this.persistCurrentScope();
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
    this.persistCurrentScope();
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
    this.persistCurrentScope();
  }

  resetToDemoData(): void {
    const seed = createSeedData();
    this.coursesSignal.set(seed.courses);
    this.assessmentsSignal.set(seed.assessments);
    this.persistCurrentScope();
  }

  clearAllData(): void {
    this.coursesSignal.set([]);
    this.assessmentsSignal.set([]);
    this.persistCurrentScope();
  }

  private hydrateForScope(scope: string | null): void {
    this.activeScope = scope;

    if (!scope) {
      this.coursesSignal.set([]);
      this.assessmentsSignal.set([]);
      return;
    }

    if (typeof localStorage === 'undefined') {
      if (scope === 'demo') {
        const seed = createSeedData();
        this.coursesSignal.set(seed.courses);
        this.assessmentsSignal.set(seed.assessments);
      } else {
        this.coursesSignal.set([]);
        this.assessmentsSignal.set([]);
      }
      return;
    }

    const coursesKey = this.storageKey(scope, 'courses');
    const assessmentsKey = this.storageKey(scope, 'assessments');
    const rawCourses = localStorage.getItem(coursesKey);
    const rawAssessments = localStorage.getItem(assessmentsKey);

    if (rawCourses === null && rawAssessments === null) {
      if (scope === 'demo') {
        const seed = createSeedData();
        this.coursesSignal.set(seed.courses);
        this.assessmentsSignal.set(seed.assessments);
        this.persistCurrentScope();
      } else {
        this.coursesSignal.set([]);
        this.assessmentsSignal.set([]);
      }
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
      this.coursesSignal.set([]);
      this.assessmentsSignal.set([]);
    }
  }

  private persistCurrentScope(): void {
    if (!this.activeScope || typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(
        this.storageKey(this.activeScope, 'courses'),
        JSON.stringify(this.coursesSignal())
      );
      localStorage.setItem(
        this.storageKey(this.activeScope, 'assessments'),
        JSON.stringify(this.assessmentsSignal())
      );
    } catch {
      return;
    }
  }

  private storageKey(scope: string, entity: 'courses' | 'assessments'): string {
    return `kurzusradar_${scope}_${entity}_v1`;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
