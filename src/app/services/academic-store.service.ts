import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

interface WorkspaceResponse {
  courses: Course[];
  assessments: Assessment[];
}

@Injectable({
  providedIn: 'root',
})
export class AcademicStoreService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly coursesSignal = signal<Course[]>([]);
  private readonly assessmentsSignal = signal<Assessment[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly syncErrorSignal = signal<string | null>(null);
  private activeScope: string | null = null;

  readonly courses = this.coursesSignal.asReadonly();
  readonly assessments = this.assessmentsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly syncError = this.syncErrorSignal.asReadonly();

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
    void this.hydrateForScope(this.auth.workspaceScope());
    this.auth.scopeChanges$.subscribe((scope) => {
      void this.hydrateForScope(scope);
    });
  }

  dismissSyncError(): void {
    this.syncErrorSignal.set(null);
  }

  addCourse(input: Omit<Course, 'id'>): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
      const created: Course = {
        ...input,
        id: this.generateId('course'),
      };
      this.coursesSignal.update((list) => [...list, created]);
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    void this.runRemoteMutation(async () => {
      const response = await firstValueFrom(
        this.http.post<{ course: Course }>('/api/courses', input, {
          withCredentials: true,
        })
      );
      this.coursesSignal.update((list) => [...list, response.course]);
    });
  }

  updateCourse(courseId: string, patch: Partial<Omit<Course, 'id'>>): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
      this.coursesSignal.update((list) =>
        list.map((course) =>
          course.id === courseId ? { ...course, ...patch } : course
        )
      );
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    void this.runRemoteMutation(async () => {
      const response = await firstValueFrom(
        this.http.patch<{ course: Course }>(`/api/courses/${courseId}`, patch, {
          withCredentials: true,
        })
      );
      this.coursesSignal.update((list) =>
        list.map((course) =>
          course.id === courseId ? response.course : course
        )
      );
    });
  }

  deleteCourse(courseId: string): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
      this.coursesSignal.update((list) =>
        list.filter((course) => course.id !== courseId)
      );
      this.assessmentsSignal.update((list) =>
        list.filter((item) => item.courseId !== courseId)
      );
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    void this.runRemoteMutation(async () => {
      await firstValueFrom(
        this.http.delete(`/api/courses/${courseId}`, {
          withCredentials: true,
        })
      );
      this.coursesSignal.update((list) =>
        list.filter((course) => course.id !== courseId)
      );
      this.assessmentsSignal.update((list) =>
        list.filter((item) => item.courseId !== courseId)
      );
    });
  }

  addSlotToCourse(
    courseId: string,
    slot: Omit<CourseScheduleSlot, 'id'>
  ): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
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
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    void this.runRemoteMutation(async () => {
      const response = await firstValueFrom(
        this.http.post<{ slot: CourseScheduleSlot }>(
          `/api/courses/${courseId}/slots`,
          slot,
          { withCredentials: true }
        )
      );
      this.coursesSignal.update((list) =>
        list.map((course) =>
          course.id === courseId
            ? { ...course, slots: [...course.slots, response.slot] }
            : course
        )
      );
    });
  }

  removeSlotFromCourse(courseId: string, slotId: string): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
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
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    void this.runRemoteMutation(async () => {
      await firstValueFrom(
        this.http.delete(`/api/courses/${courseId}/slots/${slotId}`, {
          withCredentials: true,
        })
      );
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
    });
  }

  addAssessment(input: Omit<Assessment, 'id'>): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
      const created: Assessment = {
        ...input,
        id: this.generateId('assess'),
      };
      this.assessmentsSignal.update((list) => [...list, created]);
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    const body = {
      ...input,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
    };

    void this.runRemoteMutation(async () => {
      const response = await firstValueFrom(
        this.http.post<{ assessment: Assessment }>('/api/assessments', body, {
          withCredentials: true,
        })
      );
      this.assessmentsSignal.update((list) => [...list, response.assessment]);
    });
  }

  updateAssessment(
    assessmentId: string,
    patch: Partial<Omit<Assessment, 'id'>>
  ): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
      this.assessmentsSignal.update((list) =>
        list.map((item) =>
          item.id === assessmentId ? { ...item, ...patch } : item
        )
      );
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    const body: Record<string, unknown> = { ...patch };
    if ('startTime' in patch) {
      body['startTime'] = patch.startTime ?? null;
    }
    if ('endTime' in patch) {
      body['endTime'] = patch.endTime ?? null;
    }
    if ('location' in patch) {
      body['location'] = patch.location ?? null;
    }
    if ('notes' in patch) {
      body['notes'] = patch.notes ?? null;
    }

    void this.runRemoteMutation(async () => {
      const response = await firstValueFrom(
        this.http.patch<{ assessment: Assessment }>(
          `/api/assessments/${assessmentId}`,
          body,
          { withCredentials: true }
        )
      );
      this.assessmentsSignal.update((list) =>
        list.map((item) =>
          item.id === assessmentId ? response.assessment : item
        )
      );
    });
  }

  updateAssessmentStatus(
    assessmentId: string,
    status: AssessmentStatus
  ): void {
    this.updateAssessment(assessmentId, { status });
  }

  deleteAssessment(assessmentId: string): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
      this.assessmentsSignal.update((list) =>
        list.filter((item) => item.id !== assessmentId)
      );
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    void this.runRemoteMutation(async () => {
      await firstValueFrom(
        this.http.delete(`/api/assessments/${assessmentId}`, {
          withCredentials: true,
        })
      );
      this.assessmentsSignal.update((list) =>
        list.filter((item) => item.id !== assessmentId)
      );
    });
  }

  resetToDemoData(): void {
    if (!this.isDemoScope()) {
      return;
    }
    const seed = createSeedData();
    this.coursesSignal.set(seed.courses);
    this.assessmentsSignal.set(seed.assessments);
    this.persistDemoScope();
  }

  clearAllData(): void {
    this.syncErrorSignal.set(null);

    if (this.isDemoScope()) {
      this.coursesSignal.set([]);
      this.assessmentsSignal.set([]);
      this.persistDemoScope();
      return;
    }

    if (!this.isAuthenticatedScope()) {
      return;
    }

    void this.runRemoteMutation(async () => {
      await firstValueFrom(
        this.http.delete('/api/workspace', { withCredentials: true })
      );
      this.coursesSignal.set([]);
      this.assessmentsSignal.set([]);
    });
  }

  private async hydrateForScope(scope: string | null): Promise<void> {
    this.activeScope = scope;
    this.syncErrorSignal.set(null);

    if (!scope) {
      this.coursesSignal.set([]);
      this.assessmentsSignal.set([]);
      this.loadingSignal.set(false);
      return;
    }

    if (scope === 'demo') {
      this.hydrateDemoScope();
      this.loadingSignal.set(false);
      return;
    }

    this.loadingSignal.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<WorkspaceResponse>('/api/workspace', {
          withCredentials: true,
        })
      );
      if (this.activeScope === scope) {
        this.coursesSignal.set(response.courses);
        this.assessmentsSignal.set(response.assessments);
      }
    } catch (err) {
      if (this.activeScope === scope) {
        this.coursesSignal.set([]);
        this.assessmentsSignal.set([]);
        this.syncErrorSignal.set(
          this.extractErrorMessage(err, 'Nem sikerült betölteni a munkaterületet.')
        );
      }
    } finally {
      if (this.activeScope === scope) {
        this.loadingSignal.set(false);
      }
    }
  }

  private async runRemoteMutation(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (err) {
      this.syncErrorSignal.set(
        this.extractErrorMessage(err, 'A módosítás mentése sikertelen.')
      );
    }
  }

  private hydrateDemoScope(): void {
    if (typeof localStorage === 'undefined') {
      const seed = createSeedData();
      this.coursesSignal.set(seed.courses);
      this.assessmentsSignal.set(seed.assessments);
      return;
    }

    const rawCourses = localStorage.getItem(this.demoStorageKey('courses'));
    const rawAssessments = localStorage.getItem(
      this.demoStorageKey('assessments')
    );

    if (rawCourses === null && rawAssessments === null) {
      const seed = createSeedData();
      this.coursesSignal.set(seed.courses);
      this.assessmentsSignal.set(seed.assessments);
      this.persistDemoScope();
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
      const seed = createSeedData();
      this.coursesSignal.set(seed.courses);
      this.assessmentsSignal.set(seed.assessments);
    }
  }

  private persistDemoScope(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(
        this.demoStorageKey('courses'),
        JSON.stringify(this.coursesSignal())
      );
      localStorage.setItem(
        this.demoStorageKey('assessments'),
        JSON.stringify(this.assessmentsSignal())
      );
    } catch {
      return;
    }
  }

  private demoStorageKey(entity: 'courses' | 'assessments'): string {
    return `kurzusradar_demo_${entity}_v1`;
  }

  private isDemoScope(): boolean {
    return this.activeScope === 'demo';
  }

  private isAuthenticatedScope(): boolean {
    return this.activeScope !== null && this.activeScope.startsWith('user_');
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'Megszakadt a kapcsolat a szerverrel.';
      }
      const apiError = err.error?.error;
      if (typeof apiError === 'string' && apiError.length > 0) {
        return apiError;
      }
    }
    return fallback;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
