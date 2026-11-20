import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ASSESSMENT_STATUS_LABELS,
  ASSESSMENT_TYPE_LABELS,
  AssessmentStatus,
  COURSE_COLOR_MAP,
  ConflictCategory,
  ConflictRecord,
  Course,
} from '../../models/academic.models';
import { AcademicStoreService } from '../../services/academic-store.service';

interface LoadStripDay {
  iso: string;
  dayShort: string;
  dayNumber: number;
  monthShort: string;
  count: number;
  totalWeight: number;
  severity: 'critical' | 'warning' | 'normal' | 'empty';
  isToday: boolean;
  isWeekend: boolean;
}

interface CourseLoadSummary {
  course: Course;
  color: string;
  openCount: number;
  openWeight: number;
  nextDate: string | null;
}

const SHORT_DAYS_HU = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
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
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardPage {
  protected readonly store = inject(AcademicStoreService);
  protected readonly typeLabels = ASSESSMENT_TYPE_LABELS;
  protected readonly statusLabels = ASSESSMENT_STATUS_LABELS;
  protected readonly statusOptions: AssessmentStatus[] = [
    'planned',
    'in_progress',
    'submitted',
    'graded',
  ];

  protected readonly todayLabel = computed(() => {
    return new Intl.DateTimeFormat('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(new Date());
  });

  protected readonly totalAssessmentsCount = computed(
    () => this.store.assessments().length
  );

  protected readonly completedAssessmentsCount = computed(
    () =>
      this.store
        .assessments()
        .filter(
          (item) => item.status === 'submitted' || item.status === 'graded'
        ).length
  );

  protected readonly completionPercent = computed(() => {
    const total = this.totalAssessmentsCount();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.completedAssessmentsCount() / total) * 100);
  });

  protected readonly nextFourteenDaysCount = computed(() => {
    const start = this.startOfToday();
    const end = new Date(start);
    end.setDate(end.getDate() + 13);

    return this.store.upcomingAssessments().filter((item) => {
      const date = this.parseIsoDate(item.date);
      return date >= start && date <= end;
    }).length;
  });

  protected readonly upcomingPreview = computed(() =>
    this.store.upcomingAssessments().slice(0, 6)
  );

  protected readonly topConflicts = computed(() =>
    this.store.conflicts().slice(0, 4)
  );

  protected readonly loadStripDays = computed<LoadStripDay[]>(() => {
    const start = this.startOfToday();
    const assessments = this.store.upcomingAssessments();
    const conflicts = this.store.conflicts();

    const days: LoadStripDay[] = [];
    for (let offset = 0; offset < 14; offset++) {
      const current = new Date(start);
      current.setDate(start.getDate() + offset);
      const iso = this.toIsoDate(current);
      const jsDay = current.getDay();

      const dayAssessments = assessments.filter((item) => item.date === iso);
      const dayConflicts = conflicts.filter((conflict) => conflict.date === iso);

      let severity: LoadStripDay['severity'] = 'empty';
      if (dayConflicts.some((conflict) => conflict.severity === 'critical')) {
        severity = 'critical';
      } else if (
        dayConflicts.some((conflict) => conflict.severity === 'warning')
      ) {
        severity = 'warning';
      } else if (dayAssessments.length > 0) {
        severity = 'normal';
      }

      days.push({
        iso,
        dayShort: SHORT_DAYS_HU[jsDay],
        dayNumber: current.getDate(),
        monthShort: SHORT_MONTHS_HU[current.getMonth()],
        count: dayAssessments.length,
        totalWeight: dayAssessments.reduce(
          (sum, item) => sum + item.weightPercent,
          0
        ),
        severity,
        isToday: offset === 0,
        isWeekend: jsDay === 0 || jsDay === 6,
      });
    }

    return days;
  });

  protected readonly courseSummaries = computed<CourseLoadSummary[]>(() => {
    const upcoming = this.store.upcomingAssessments();
    return this.store.courses().map((course) => {
      const items = upcoming.filter((item) => item.courseId === course.id);
      return {
        course,
        color: COURSE_COLOR_MAP[course.colorToken],
        openCount: items.length,
        openWeight: items.reduce((sum, item) => sum + item.weightPercent, 0),
        nextDate: items.length > 0 ? items[0].date : null,
      };
    });
  });

  protected getCourse(courseId: string): Course | undefined {
    return this.store.courseMap().get(courseId);
  }

  protected getCourseColor(courseId: string): string {
    const course = this.getCourse(courseId);
    return course ? COURSE_COLOR_MAP[course.colorToken] : '#52514B';
  }

  protected getConflictsForAssessment(assessmentId: string): ConflictRecord[] {
    return this.store.conflictsByAssessmentId()[assessmentId] ?? [];
  }

  protected getHighestSeverity(
    assessmentId: string
  ): 'critical' | 'warning' | null {
    const list = this.getConflictsForAssessment(assessmentId);
    if (list.some((conflict) => conflict.severity === 'critical')) {
      return 'critical';
    }
    if (list.length > 0) {
      return 'warning';
    }
    return null;
  }

  protected formatShortDate(dateStr: string): string {
    const date = this.parseIsoDate(dateStr);
    return `${SHORT_MONTHS_HU[date.getMonth()]} ${date.getDate()}.`;
  }

  protected formatRelativeDay(dateStr: string): string {
    const target = this.parseIsoDate(dateStr);
    const today = this.startOfToday();
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / 86400000);

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
      return 'Tegnap lejárt';
    }
    return `${Math.abs(diffDays)} napja lejárt`;
  }

  protected isOverdue(dateStr: string): boolean {
    return this.parseIsoDate(dateStr) < this.startOfToday();
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

  protected handleStatusChange(assessmentId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.store.updateAssessmentStatus(
      assessmentId,
      select.value as AssessmentStatus
    );
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private parseIsoDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
