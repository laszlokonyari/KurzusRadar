export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ClassSlotType = 'lecture' | 'practice' | 'lab';

export type CourseColorToken =
  | 'pine'
  | 'slate'
  | 'terracotta'
  | 'ochre'
  | 'indigo'
  | 'plum';

export interface CourseScheduleSlot {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string;
  type: ClassSlotType;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: string;
  instructor: string;
  colorToken: CourseColorToken;
  slots: CourseScheduleSlot[];
}

export type AssessmentType = 'zh' | 'assignment' | 'exam' | 'project';

export type AssessmentStatus = 'planned' | 'in_progress' | 'submitted' | 'graded';

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  type: AssessmentType;
  date: string;
  startTime?: string;
  endTime?: string;
  weightPercent: number;
  status: AssessmentStatus;
  location?: string;
  notes?: string;
}

export type ConflictSeverity = 'critical' | 'warning';

export type ConflictCategory =
  | 'time_overlap'
  | 'class_collision'
  | 'daily_overload';

export interface ConflictRecord {
  id: string;
  severity: ConflictSeverity;
  category: ConflictCategory;
  date: string;
  title: string;
  description: string;
  involvedAssessmentIds: string[];
  involvedCourseIds: string[];
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  1: 'Hétfő',
  2: 'Kedd',
  3: 'Szerda',
  4: 'Csütörtök',
  5: 'Péntek',
  6: 'Szombat',
  7: 'Vasárnap',
};

export const CLASS_SLOT_TYPE_LABELS: Record<ClassSlotType, string> = {
  lecture: 'Előadás',
  practice: 'Gyakorlat',
  lab: 'Labor',
};

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  zh: 'Zárthelyi',
  assignment: 'Beadandó',
  exam: 'Vizsga',
  project: 'Projekt',
};

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  planned: 'Tervezett',
  in_progress: 'Folyamatban',
  submitted: 'Leadva',
  graded: 'Értékelve',
};

export const COURSE_COLOR_MAP: Record<CourseColorToken, string> = {
  pine: '#1C4532',
  slate: '#334155',
  terracotta: '#9A3412',
  ochre: '#854D0E',
  indigo: '#3730A3',
  plum: '#6B21A8',
};
