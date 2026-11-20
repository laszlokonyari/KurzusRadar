import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    title: 'Áttekintés — KurzusRadar',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'courses',
    title: 'Tárgyak és órarend — KurzusRadar',
    loadComponent: () =>
      import('./pages/courses/courses').then((m) => m.CoursesPage),
  },
  {
    path: 'assessments',
    title: 'ZH-k és beadandók — KurzusRadar',
    loadComponent: () =>
      import('./pages/assessments/assessments').then((m) => m.AssessmentsPage),
  },
  {
    path: 'conflicts',
    title: 'Ütközésvizsgálat — KurzusRadar',
    loadComponent: () =>
      import('./pages/conflicts/conflicts').then((m) => m.ConflictsPage),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
