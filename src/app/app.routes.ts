import { Routes } from '@angular/router';
import {
  guestOnlyAuthGuard,
  workspaceGuard,
} from './guards/workspace.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'KurzusRadar — Egyetemi tárgy- és ZH-tervező',
    loadComponent: () =>
      import('./pages/landing/landing').then((m) => m.LandingPage),
  },
  {
    path: 'auth/login',
    title: 'Bejelentkezés — KurzusRadar',
    canActivate: [guestOnlyAuthGuard],
    data: { mode: 'login' },
    loadComponent: () =>
      import('./pages/auth/auth').then((m) => m.AuthPage),
  },
  {
    path: 'auth/register',
    title: 'Regisztráció — KurzusRadar',
    canActivate: [guestOnlyAuthGuard],
    data: { mode: 'register' },
    loadComponent: () =>
      import('./pages/auth/auth').then((m) => m.AuthPage),
  },
  {
    path: 'app',
    canActivate: [workspaceGuard],
    loadComponent: () =>
      import('./layout/workspace-shell/workspace-shell').then(
        (m) => m.WorkspaceShell
      ),
    children: [
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
          import('./pages/assessments/assessments').then(
            (m) => m.AssessmentsPage
          ),
      },
      {
        path: 'conflicts',
        title: 'Ütközésvizsgálat — KurzusRadar',
        loadComponent: () =>
          import('./pages/conflicts/conflicts').then((m) => m.ConflictsPage),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
