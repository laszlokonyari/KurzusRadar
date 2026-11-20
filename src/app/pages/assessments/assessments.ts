import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ASSESSMENT_STATUS_LABELS,
  ASSESSMENT_TYPE_LABELS,
  Assessment,
  AssessmentStatus,
  AssessmentType,
  COURSE_COLOR_MAP,
  ConflictCategory,
  ConflictRecord,
  Course,
} from '../../models/academic.models';
import { AcademicStoreService } from '../../services/academic-store.service';
import {
  detectAcademicConflicts,
  parseTimeToMinutes,
} from '../../services/conflict-engine';

type StatusFilter = 'all' | 'open' | AssessmentStatus;
type SortMode = 'date_asc' | 'date_desc' | 'weight_desc';

const SHORT_MONTHS_HU = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.',
];

@Component({
  selector: 'app-assessments',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './assessments.html',
  styleUrl: './assessments.css',
})
export class AssessmentsPage {
  protected readonly store = inject(AcademicStoreService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly typeLabels = ASSESSMENT_TYPE_LABELS;
  protected readonly statusLabels = ASSESSMENT_STATUS_LABELS;

  protected readonly typeOptions: AssessmentType[] = [
    'zh',
    'assignment',
    'exam',
    'project',
  ];
  protected readonly statusOptions: AssessmentStatus[] = [
    'planned',
    'in_progress',
    'submitted',
    'graded',
  ];

  protected readonly formOpen = signal(false);
  protected readonly editingAssessmentId = signal<string | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly searchQuery = signal('');
  protected readonly courseFilter = signal('all');
  protected readonly typeFilter = signal<'all' | AssessmentType>('all');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly onlyConflicting = signal(false);
  protected readonly sortMode = signal<SortMode>('date_asc');

  protected readonly assessmentForm = this.fb.group({
    courseId: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['zh' as AssessmentType, Validators.required],
    date: [this.todayIso(), Validators.required],
    startTime: [''],
    endTime: [''],
    weightPercent: [
      20,
      [Validators.required, Validators.min(0), Validators.max(100)],
    ],
    status: ['planned' as AssessmentStatus, Validators.required],
    location: ['', Validators.maxLength(60)],
    notes: ['', Validators.maxLength(300)],
  });

  private readonly formValue = toSignal(this.assessmentForm.valueChanges, {
    initialValue: this.assessmentForm.getRawValue(),
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().trim().length > 0 ||
      this.courseFilter() !== 'all' ||
      this.typeFilter() !== 'all' ||
      this.statusFilter() !== 'all' ||
      this.onlyConflicting()
  );

  protected readonly conflictingAssessmentCount = computed(
    () => Object.keys(this.store.conflictsByAssessmentId()).length
  );

  protected readonly filteredAssessments = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const courseId = this.courseFilter();
    const type = this.typeFilter();
    const status = this.statusFilter();
    const onlyConflicts = this.onlyConflicting();
    const sort = this.sortMode();
    const courseMap = this.store.courseMap();
    const conflictIndex = this.store.conflictsByAssessmentId();

    const filtered = this.store.assessments().filter((item) => {
      if (courseId !== 'all' && item.courseId !== courseId) {
        return false;
      }
      if (type !== 'all' && item.type !== type) {
        return false;
      }
      if (status === 'open') {
        if (item.status === 'submitted' || item.status === 'graded') {
          return false;
        }
      } else if (status !== 'all' && item.status !== status) {
        return false;
      }
      if (onlyConflicts && !(conflictIndex[item.id]?.length > 0)) {
        return false;
      }
      if (query.length > 0) {
        const course = courseMap.get(item.courseId);
        const haystack = [
          item.title,
          item.location ?? '',
          item.notes ?? '',
          course?.code ?? '',
          course?.name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });

    return filtered.slice().sort((a, b) => {
      if (sort === 'weight_desc') {
        if (b.weightPercent !== a.weightPercent) {
          return b.weightPercent - a.weightPercent;
        }
        return a.date.localeCompare(b.date);
      }

      const direction = sort === 'date_asc' ? 1 : -1;
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) {
        return dateCmp * direction;
      }
      return (
        (a.startTime ?? '23:59').localeCompare(b.startTime ?? '23:59') *
        direction
      );
    });
  });

  protected readonly previewConflicts = computed<ConflictRecord[]>(() => {
    if (!this.formOpen()) {
      return [];
    }

    const raw = this.formValue();
    const courseId = raw.courseId ?? '';
    const date = raw.date ?? '';
    const status = raw.status ?? 'planned';

    if (
      !courseId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      status === 'submitted' ||
      status === 'graded'
    ) {
      return [];
    }

    const startMin = parseTimeToMinutes(raw.startTime || undefined);
    const endMin = parseTimeToMinutes(raw.endTime || undefined);
    const hasValidWindow =
      startMin !== null && endMin !== null && startMin < endMin;

    const draftId = this.editingAssessmentId() ?? '__draft__';
    const draftItem: Assessment = {
      id: draftId,
      courseId,
      title: (raw.title ?? '').trim() || 'Tervezett esemény',
      type: raw.type ?? 'zh',
      date,
      startTime: hasValidWindow ? raw.startTime : undefined,
      endTime: hasValidWindow ? raw.endTime : undefined,
      weightPercent: Number(raw.weightPercent ?? 0),
      status,
      location: (raw.location ?? '').trim() || undefined,
      notes: (raw.notes ?? '').trim() || undefined,
    };

    const existing = this.store.assessments();
    const simulated = this.editingAssessmentId()
      ? existing.map((item) => (item.id === draftId ? draftItem : item))
      : [...existing, draftItem];

    return detectAcademicConflicts(this.store.courses(), simulated).filter(
      (conflict) => conflict.involvedAssessmentIds.includes(draftId)
    );
  });

  protected openCreateForm(): void {
    const firstCourseId = this.store.courses()[0]?.id ?? '';
    this.editingAssessmentId.set(null);
    this.formError.set(null);
    this.assessmentForm.reset({
      courseId: firstCourseId,
      title: '',
      type: 'zh',
      date: this.todayIso(),
      startTime: '14:00',
      endTime: '15:30',
      weightPercent: 20,
      status: 'planned',
      location: '',
      notes: '',
    });
    this.formOpen.set(true);
  }

  protected openEditForm(item: Assessment): void {
    this.editingAssessmentId.set(item.id);
    this.formError.set(null);
    this.assessmentForm.setValue({
      courseId: item.courseId,
      title: item.title,
      type: item.type,
      date: item.date,
      startTime: item.startTime ?? '',
      endTime: item.endTime ?? '',
      weightPercent: item.weightPercent,
      status: item.status,
      location: item.location ?? '',
      notes: item.notes ?? '',
    });
    this.formOpen.set(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editingAssessmentId.set(null);
    this.formError.set(null);
  }

  protected submitForm(): void {
    if (this.assessmentForm.invalid) {
      this.assessmentForm.markAllAsTouched();
      this.formError.set('Kérlek töltsd ki a kötelező mezőket.');
      return;
    }

    const raw = this.assessmentForm.getRawValue();
    const startTrim = raw.startTime.trim();
    const endTrim = raw.endTime.trim();

    if ((startTrim && !endTrim) || (!startTrim && endTrim)) {
      this.formError.set(
        'Időponthoz kötött eseménynél a kezdést és a befejezést is add meg, vagy hagyd üresen mindkettőt.'
      );
      return;
    }

    if (startTrim && endTrim) {
      const startMin = parseTimeToMinutes(startTrim);
      const endMin = parseTimeToMinutes(endTrim);
      if (startMin === null || endMin === null || startMin >= endMin) {
        this.formError.set(
          'A befejezési időpontnak a kezdés után kell lennie.'
        );
        return;
      }
    }

    const payload: Omit<Assessment, 'id'> = {
      courseId: raw.courseId,
      title: raw.title.trim(),
      type: raw.type,
      date: raw.date,
      startTime: startTrim || undefined,
      endTime: endTrim || undefined,
      weightPercent: Number(raw.weightPercent),
      status: raw.status,
      location: raw.location.trim() || undefined,
      notes: raw.notes.trim() || undefined,
    };

    const editingId = this.editingAssessmentId();
    if (editingId) {
      this.store.updateAssessment(editingId, payload);
    } else {
      this.store.addAssessment(payload);
    }

    this.closeForm();
  }

  protected handleSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected handleCourseFilter(event: Event): void {
    this.courseFilter.set((event.target as HTMLSelectElement).value);
  }

  protected handleTypeFilter(event: Event): void {
    this.typeFilter.set(
      (event.target as HTMLSelectElement).value as 'all' | AssessmentType
    );
  }

  protected handleStatusFilter(event: Event): void {
    this.statusFilter.set(
      (event.target as HTMLSelectElement).value as StatusFilter
    );
  }

  protected handleSortChange(event: Event): void {
    this.sortMode.set((event.target as HTMLSelectElement).value as SortMode);
  }

  protected toggleOnlyConflicting(): void {
    this.onlyConflicting.update((value) => !value);
  }

  protected resetFilters(): void {
    this.searchQuery.set('');
    this.courseFilter.set('all');
    this.typeFilter.set('all');
    this.statusFilter.set('all');
    this.onlyConflicting.set(false);
  }

  protected handleInlineStatusChange(assessmentId: string, event: Event): void {
    const status = (event.target as HTMLSelectElement)
      .value as AssessmentStatus;
    this.store.updateAssessmentStatus(assessmentId, status);
  }

  protected requestDelete(assessmentId: string): void {
    this.confirmDeleteId.set(assessmentId);
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  protected confirmDelete(assessmentId: string): void {
    this.store.deleteAssessment(assessmentId);
    this.confirmDeleteId.set(null);
    if (this.editingAssessmentId() === assessmentId) {
      this.closeForm();
    }
  }

  protected getCourse(courseId: string): Course | undefined {
    return this.store.courseMap().get(courseId);
  }

  protected getCourseColor(courseId: string): string {
    const course = this.getCourse(courseId);
    return course ? COURSE_COLOR_MAP[course.colorToken] : '#52514B';
  }

  protected getConflicts(assessmentId: string): ConflictRecord[] {
    return this.store.conflictsByAssessmentId()[assessmentId] ?? [];
  }

  protected hasCriticalConflict(assessmentId: string): boolean {
    return this.getConflicts(assessmentId).some(
      (conflict) => conflict.severity === 'critical'
    );
  }

  protected isCompleted(status: AssessmentStatus): boolean {
    return status === 'submitted' || status === 'graded';
  }

  protected formatDateLabel(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${year}. ${SHORT_MONTHS_HU[date.getMonth()]} ${day}.`;
  }

  protected formatCategory(category: ConflictCategory): string {
    switch (category) {
      case 'time_overlap':
        return 'Időpont-ütközés';
      case 'class_collision':
        return 'Órarendi átfedés';
      case 'daily_overload':
        return 'Terhelési csúcs';
    }
  }

  private todayIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
