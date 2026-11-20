import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ASSESSMENT_STATUS_LABELS,
  ASSESSMENT_TYPE_LABELS,
  Assessment,
  CLASS_SLOT_TYPE_LABELS,
  COURSE_COLOR_MAP,
  ConflictCategory,
  ConflictRecord,
  Course,
  CourseScheduleSlot,
  DAY_LABELS,
} from '../../models/academic.models';
import { AcademicStoreService } from '../../services/academic-store.service';
import {
  getIsoDayOfWeek,
  parseTimeToMinutes,
} from '../../services/conflict-engine';

interface TimelineClassSlot {
  course: Course;
  slot: CourseScheduleSlot;
  color: string;
}

interface TimelineDayGroup {
  date: string;
  formattedDate: string;
  dayName: string;
  relativeLabel: string;
  assessments: Assessment[];
  classSlots: TimelineClassSlot[];
  conflicts: ConflictRecord[];
  totalWeight: number;
  highestSeverity: 'critical' | 'warning' | 'none';
}

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
  selector: 'app-conflicts',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './conflicts.html',
  styleUrl: './conflicts.css',
})
export class ConflictsPage {
  protected readonly store = inject(AcademicStoreService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly typeLabels = ASSESSMENT_TYPE_LABELS;
  protected readonly statusLabels = ASSESSMENT_STATUS_LABELS;
  protected readonly slotTypeLabels = CLASS_SLOT_TYPE_LABELS;

  protected readonly categoryFilter = signal<'all' | ConflictCategory>('all');
  protected readonly reschedulingKey = signal<string | null>(null);
  protected readonly reschedulingAssessmentId = signal<string | null>(null);
  protected readonly rescheduleError = signal<string | null>(null);

  protected readonly rescheduleForm = this.fb.group({
    date: ['', Validators.required],
    startTime: [''],
    endTime: [''],
  });

  protected readonly assessmentMap = computed(() => {
    const map = new Map<string, Assessment>();
    for (const item of this.store.assessments()) {
      map.set(item.id, item);
    }
    return map;
  });

  protected readonly timeOverlapCount = computed(
    () =>
      this.store
        .conflicts()
        .filter((conflict) => conflict.category === 'time_overlap').length
  );

  protected readonly classCollisionCount = computed(
    () =>
      this.store
        .conflicts()
        .filter((conflict) => conflict.category === 'class_collision').length
  );

  protected readonly dailyOverloadCount = computed(
    () =>
      this.store
        .conflicts()
        .filter((conflict) => conflict.category === 'daily_overload').length
  );

  protected readonly filteredConflicts = computed(() => {
    const filter = this.categoryFilter();
    const list = this.store.conflicts();
    if (filter === 'all') {
      return list;
    }
    return list.filter((conflict) => conflict.category === filter);
  });

  protected readonly timelineDays = computed<TimelineDayGroup[]>(() => {
    const upcoming = this.store.upcomingAssessments();
    const courses = this.store.courses();
    const conflicts = this.store.conflicts();

    const byDate = new Map<string, Assessment[]>();
    for (const item of upcoming) {
      const existing = byDate.get(item.date) ?? [];
      existing.push(item);
      byDate.set(item.date, existing);
    }

    const sortedDates = Array.from(byDate.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    return sortedDates.map((date) => {
      const items = byDate.get(date) ?? [];
      const dayOfWeek = getIsoDayOfWeek(date);
      const dayConflicts = conflicts.filter(
        (conflict) => conflict.date === date
      );

      const classSlots: TimelineClassSlot[] = [];
      for (const course of courses) {
        for (const slot of course.slots) {
          if (slot.dayOfWeek === dayOfWeek) {
            classSlots.push({
              course,
              slot,
              color: COURSE_COLOR_MAP[course.colorToken],
            });
          }
        }
      }
      classSlots.sort((a, b) =>
        a.slot.startTime.localeCompare(b.slot.startTime)
      );

      let highestSeverity: TimelineDayGroup['highestSeverity'] = 'none';
      if (dayConflicts.some((conflict) => conflict.severity === 'critical')) {
        highestSeverity = 'critical';
      } else if (dayConflicts.length > 0) {
        highestSeverity = 'warning';
      }

      return {
        date,
        formattedDate: this.formatDateLabel(date),
        dayName: DAY_LABELS[dayOfWeek],
        relativeLabel: this.formatRelativeDay(date),
        assessments: items,
        classSlots,
        conflicts: dayConflicts,
        totalWeight: items.reduce((sum, item) => sum + item.weightPercent, 0),
        highestSeverity,
      };
    });
  });

  protected setCategoryFilter(filter: 'all' | ConflictCategory): void {
    this.categoryFilter.set(filter);
  }

  protected openReschedule(contextKey: string, item: Assessment): void {
    if (this.reschedulingKey() === contextKey) {
      this.closeReschedule();
      return;
    }

    this.reschedulingKey.set(contextKey);
    this.reschedulingAssessmentId.set(item.id);
    this.rescheduleError.set(null);
    this.rescheduleForm.setValue({
      date: item.date,
      startTime: item.startTime ?? '',
      endTime: item.endTime ?? '',
    });
  }

  protected closeReschedule(): void {
    this.reschedulingKey.set(null);
    this.reschedulingAssessmentId.set(null);
    this.rescheduleError.set(null);
  }

  protected submitReschedule(): void {
    const assessmentId = this.reschedulingAssessmentId();
    if (!assessmentId) {
      return;
    }

    if (this.rescheduleForm.invalid) {
      this.rescheduleError.set('Adj meg egy érvényes dátumot.');
      return;
    }

    const raw = this.rescheduleForm.getRawValue();
    const startTrim = raw.startTime.trim();
    const endTrim = raw.endTime.trim();

    if ((startTrim && !endTrim) || (!startTrim && endTrim)) {
      this.rescheduleError.set(
        'A kezdési és befejezési időpontot együtt add meg, vagy hagyd üresen mindkettőt.'
      );
      return;
    }

    if (startTrim && endTrim) {
      const startMin = parseTimeToMinutes(startTrim);
      const endMin = parseTimeToMinutes(endTrim);
      if (startMin === null || endMin === null || startMin >= endMin) {
        this.rescheduleError.set(
          'A befejezési időpontnak a kezdés után kell lennie.'
        );
        return;
      }
    }

    this.store.updateAssessment(assessmentId, {
      date: raw.date,
      startTime: startTrim || undefined,
      endTime: endTrim || undefined,
    });

    this.closeReschedule();
  }

  protected markSubmitted(assessmentId: string): void {
    this.store.updateAssessmentStatus(assessmentId, 'submitted');
    if (this.reschedulingAssessmentId() === assessmentId) {
      this.closeReschedule();
    }
  }

  protected getInvolvedAssessments(conflict: ConflictRecord): Assessment[] {
    const map = this.assessmentMap();
    return conflict.involvedAssessmentIds
      .map((id) => map.get(id))
      .filter((item): item is Assessment => item !== undefined);
  }

  protected getCourse(courseId: string): Course | undefined {
    return this.store.courseMap().get(courseId);
  }

  protected getCourseColor(courseId: string): string {
    const course = this.getCourse(courseId);
    return course ? COURSE_COLOR_MAP[course.colorToken] : '#52514B';
  }

  protected hasConflictOnAssessment(assessmentId: string): boolean {
    return (this.store.conflictsByAssessmentId()[assessmentId]?.length ?? 0) > 0;
  }

  protected hasCriticalOnAssessment(assessmentId: string): boolean {
    return (
      this.store
        .conflictsByAssessmentId()
        [assessmentId]?.some((conflict) => conflict.severity === 'critical') ??
      false
    );
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

  protected formatDateLabel(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${year}. ${SHORT_MONTHS_HU[date.getMonth()]} ${day}.`;
  }

  protected formatDayName(dateStr: string): string {
    return DAY_LABELS[getIsoDayOfWeek(dateStr)];
  }

  private formatRelativeDay(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const target = new Date(year, month - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

    if (diffDays === 0) {
      return 'Ma';
    }
    if (diffDays === 1) {
      return 'Holnap';
    }
    if (diffDays > 1) {
      return `${diffDays} nap múlva`;
    }
    if (diffDays === -1) {
      return 'Tegnap';
    }
    return `${Math.abs(diffDays)} napja`;
  }
}
