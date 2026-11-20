import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ASSESSMENT_TYPE_LABELS,
  Assessment,
  CLASS_SLOT_TYPE_LABELS,
  COURSE_COLOR_MAP,
  ConflictCategory,
  Course,
  DAY_LABELS,
} from '../../models/academic.models';
import { AuthService } from '../../services/auth.service';
import { detectAcademicConflicts } from '../../services/conflict-engine';

type PreviewScenarioId = 'overlap' | 'class_collision' | 'resolved';

interface PreviewScenario {
  id: PreviewScenarioId;
  tabLabel: string;
  caption: string;
  assessments: Assessment[];
}

const PREVIEW_COURSES: Course[] = [
  {
    id: 'p-algo',
    code: 'VIAU-A01',
    name: 'Algoritmusok és adatszerkezetek',
    credits: 5,
    semester: '2026/27/1',
    instructor: 'Dr. Kovács Bence',
    colorToken: 'pine',
    slots: [
      {
        id: 'ps-algo-1',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '12:00',
        room: 'IB028',
        type: 'lecture',
      },
    ],
  },
  {
    id: 'p-db',
    code: 'VITM-A04',
    name: 'Adatbázisok',
    credits: 5,
    semester: '2026/27/1',
    instructor: 'Dr. Szabó Eszter',
    colorToken: 'slate',
    slots: [
      {
        id: 'ps-db-1',
        dayOfWeek: 4,
        startTime: '12:00',
        endTime: '14:00',
        room: 'IL206',
        type: 'lab',
      },
    ],
  },
  {
    id: 'p-web',
    code: 'VIEE-009',
    name: 'Kliensoldali webfejlesztés',
    credits: 4,
    semester: '2026/27/1',
    instructor: 'Nagy Ádám',
    colorToken: 'terracotta',
    slots: [
      {
        id: 'ps-web-1',
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '12:00',
        room: 'IB026',
        type: 'lecture',
      },
    ],
  },
];

const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    id: 'overlap',
    tabLabel: 'Időpont-ütközés',
    caption: 'Két nagy ZH átfedésben ugyanazon a kedd délutánon',
    assessments: [
      {
        id: 'pa-1',
        courseId: 'p-algo',
        title: '1. Nagy Zárthelyi (Fák és rendezések)',
        type: 'zh',
        date: '2026-11-24',
        startTime: '14:00',
        endTime: '15:30',
        weightPercent: 30,
        status: 'planned',
        location: 'Q-I',
      },
      {
        id: 'pa-2',
        courseId: 'p-db',
        title: 'SQL és relációs algebra ZH',
        type: 'zh',
        date: '2026-11-24',
        startTime: '14:30',
        endTime: '16:00',
        weightPercent: 25,
        status: 'planned',
        location: 'IB028',
      },
    ],
  },
  {
    id: 'class_collision',
    tabLabel: 'Órarendi átfedés',
    caption: 'Csütörtöki kiszárthelyi egy másik tárgy laborja közben',
    assessments: [
      {
        id: 'pa-3',
        courseId: 'p-web',
        title: 'Angular architektúra kiszárthelyi',
        type: 'zh',
        date: '2026-11-26',
        startTime: '12:30',
        endTime: '13:30',
        weightPercent: 15,
        status: 'planned',
        location: 'IL105',
      },
    ],
  },
  {
    id: 'resolved',
    tabLabel: 'Feloldott ütemterv',
    caption: 'Átütemezett időpontok, ütközés és terhelési csúcs nélkül',
    assessments: [
      {
        id: 'pa-4',
        courseId: 'p-algo',
        title: '1. Nagy Zárthelyi (Fák és rendezések)',
        type: 'zh',
        date: '2026-11-24',
        startTime: '14:00',
        endTime: '15:30',
        weightPercent: 30,
        status: 'planned',
        location: 'Q-I',
      },
      {
        id: 'pa-5',
        courseId: 'p-db',
        title: 'SQL és relációs algebra ZH',
        type: 'zh',
        date: '2026-11-25',
        startTime: '16:00',
        endTime: '17:30',
        weightPercent: 25,
        status: 'planned',
        location: 'IB028',
      },
    ],
  },
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly scenarios = PREVIEW_SCENARIOS;
  protected readonly activeScenarioId = signal<PreviewScenarioId>('overlap');
  protected readonly typeLabels = ASSESSMENT_TYPE_LABELS;
  protected readonly dayLabels = DAY_LABELS;
  protected readonly slotTypeLabels = CLASS_SLOT_TYPE_LABELS;

  private readonly previewCourseMap = new Map<string, Course>(
    PREVIEW_COURSES.map((course) => [course.id, course])
  );

  protected readonly activeScenario = computed(
    () =>
      this.scenarios.find((s) => s.id === this.activeScenarioId()) ??
      this.scenarios[0]
  );

  protected readonly previewConflicts = computed(() =>
    detectAcademicConflicts(PREVIEW_COURSES, this.activeScenario().assessments)
  );

  protected readonly previewStatus = computed<'critical' | 'warning' | 'clear'>(
    () => {
      const list = this.previewConflicts();
      if (list.some((conflict) => conflict.severity === 'critical')) {
        return 'critical';
      }
      if (list.length > 0) {
        return 'warning';
      }
      return 'clear';
    }
  );

  protected readonly relevantSlotNote = computed(() => {
    if (this.activeScenarioId() !== 'class_collision') {
      return null;
    }
    const dbCourse = this.previewCourseMap.get('p-db');
    const slot = dbCourse?.slots[0];
    if (!dbCourse || !slot) {
      return null;
    }
    return `${dbCourse.code} ${this.slotTypeLabels[slot.type].toLowerCase()} · ${this.dayLabels[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime} (${slot.room})`;
  });

  protected selectScenario(id: PreviewScenarioId): void {
    this.activeScenarioId.set(id);
  }

  protected launchDemo(): void {
    this.auth.enterDemoMode();
    this.router.navigateByUrl('/app/dashboard');
  }

  protected openActiveWorkspace(): void {
    this.router.navigateByUrl('/app/dashboard');
  }

  protected getPreviewCourse(courseId: string): Course | undefined {
    return this.previewCourseMap.get(courseId);
  }

  protected getPreviewCourseColor(courseId: string): string {
    const course = this.getPreviewCourse(courseId);
    return course ? COURSE_COLOR_MAP[course.colorToken] : '#52514B';
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
}
