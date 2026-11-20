import { Assessment, Course, DayOfWeek } from '../models/academic.models';

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function upcomingDateForDay(targetDay: DayOfWeek, minDaysAhead: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + minDaysAhead);
  const currentIsoDay = date.getDay() === 0 ? 7 : date.getDay();
  const delta = (targetDay - currentIsoDay + 7) % 7;
  date.setDate(date.getDate() + delta);
  return formatIsoDate(date);
}

function relativeDate(daysOffset: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysOffset);
  return formatIsoDate(date);
}

export interface SeedPayload {
  courses: Course[];
  assessments: Assessment[];
}

export function createSeedData(): SeedPayload {
  const tuesdaySoon = upcomingDateForDay(2, 2);
  const thursdaySoon = upcomingDateForDay(4, 2);
  const fridaySoon = upcomingDateForDay(5, 3);
  const mondayNext = upcomingDateForDay(1, 9);
  const wednesdayNext = upcomingDateForDay(3, 10);
  const completedDate = relativeDate(-5);

  const courses: Course[] = [
    {
      id: 'c-algo',
      code: 'VIAU-A01',
      name: 'Algoritmusok és adatszerkezetek',
      credits: 5,
      semester: '2026/27/1',
      instructor: 'Dr. Kovács Bence',
      colorToken: 'pine',
      slots: [
        {
          id: 's-algo-1',
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '12:00',
          room: 'IB028',
          type: 'lecture',
        },
        {
          id: 's-algo-2',
          dayOfWeek: 3,
          startTime: '14:00',
          endTime: '16:00',
          room: 'IE224',
          type: 'practice',
        },
      ],
    },
    {
      id: 'c-db',
      code: 'VITM-A04',
      name: 'Adatbázisok',
      credits: 5,
      semester: '2026/27/1',
      instructor: 'Dr. Szabó Eszter',
      colorToken: 'slate',
      slots: [
        {
          id: 's-db-1',
          dayOfWeek: 2,
          startTime: '08:00',
          endTime: '10:00',
          room: 'Q-I',
          type: 'lecture',
        },
        {
          id: 's-db-2',
          dayOfWeek: 4,
          startTime: '12:00',
          endTime: '14:00',
          room: 'IL206',
          type: 'lab',
        },
      ],
    },
    {
      id: 'c-web',
      code: 'VIEE-009',
      name: 'Kliensoldali webfejlesztés',
      credits: 4,
      semester: '2026/27/1',
      instructor: 'Nagy Ádám',
      colorToken: 'terracotta',
      slots: [
        {
          id: 's-web-1',
          dayOfWeek: 2,
          startTime: '14:00',
          endTime: '16:00',
          room: 'IB026',
          type: 'lecture',
        },
        {
          id: 's-web-2',
          dayOfWeek: 5,
          startTime: '10:00',
          endTime: '12:00',
          room: 'IL105',
          type: 'lab',
        },
      ],
    },
    {
      id: 'c-os',
      code: 'VIMI-A12',
      name: 'Operációs rendszerek',
      credits: 5,
      semester: '2026/27/1',
      instructor: 'Dr. Tóth Gábor',
      colorToken: 'indigo',
      slots: [
        {
          id: 's-os-1',
          dayOfWeek: 3,
          startTime: '10:00',
          endTime: '12:00',
          room: 'Q-II',
          type: 'lecture',
        },
        {
          id: 's-os-2',
          dayOfWeek: 4,
          startTime: '16:00',
          endTime: '18:00',
          room: 'IE312',
          type: 'practice',
        },
      ],
    },
  ];

  const assessments: Assessment[] = [
    {
      id: 'a-1',
      courseId: 'c-algo',
      title: '1. Nagy Zárthelyi (Fák és rendezések)',
      type: 'zh',
      date: tuesdaySoon,
      startTime: '14:00',
      endTime: '15:30',
      weightPercent: 30,
      status: 'planned',
      location: 'Q-I előadó',
      notes: 'Írásbeli, saját kézzel írt egyoldalas segédlet engedélyezett.',
    },
    {
      id: 'a-2',
      courseId: 'c-db',
      title: 'SQL és relációs algebra ZH',
      type: 'zh',
      date: tuesdaySoon,
      startTime: '14:30',
      endTime: '16:00',
      weightPercent: 25,
      status: 'in_progress',
      location: 'IB028',
      notes: 'Pótírási igényt legalább 48 órával előtte jelezni kell.',
    },
    {
      id: 'a-3',
      courseId: 'c-web',
      title: 'Angular architektúra kiszárthelyi',
      type: 'zh',
      date: thursdaySoon,
      startTime: '12:30',
      endTime: '13:30',
      weightPercent: 15,
      status: 'planned',
      location: 'IL105 labor',
    },
    {
      id: 'a-4',
      courseId: 'c-os',
      title: 'Szálkezelés és szinkronizáció beadandó',
      type: 'assignment',
      date: fridaySoon,
      weightPercent: 20,
      status: 'in_progress',
      notes: 'Git repó + rövid mérési jegyzőkönyv PDF-ben.',
    },
    {
      id: 'a-5',
      courseId: 'c-web',
      title: 'Féléves SPA projekt 1. mérföldkő',
      type: 'project',
      date: mondayNext,
      weightPercent: 35,
      status: 'planned',
      notes: 'Állapotkezelés és alap nézetek bemutatása.',
    },
    {
      id: 'a-6',
      courseId: 'c-algo',
      title: 'Gráfalgoritmusok 2. Zárthelyi',
      type: 'zh',
      date: wednesdayNext,
      startTime: '14:00',
      endTime: '15:30',
      weightPercent: 30,
      status: 'planned',
      location: 'IE224',
    },
    {
      id: 'a-7',
      courseId: 'c-db',
      title: 'ER-modell tervezési házi feladat',
      type: 'assignment',
      date: completedDate,
      weightPercent: 10,
      status: 'graded',
      notes: 'Elfogadva, maximális pontszám.',
    },
  ];

  return { courses, assessments };
}
