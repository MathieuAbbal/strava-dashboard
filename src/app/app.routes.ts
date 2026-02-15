import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Routes de l'application
 * Chaque page est chargée en lazy loading pour optimiser le bundle
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then(m => m.Login)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
  },
  {
    path: 'activities',
    canActivate: [authGuard],
    loadComponent: () => import('./features/activities/activity-list').then(m => m.ActivityList)
  },
  {
    path: 'activities/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/activities/activity-detail').then(m => m.ActivityDetailComponent)
  },
  {
    path: 'progression',
    canActivate: [authGuard],
    loadComponent: () => import('./features/progression/progression').then(m => m.Progression)
  },
  {
    path: 'map',
    canActivate: [authGuard],
    loadComponent: () => import('./features/maps/global-map').then(m => m.GlobalMap)
  }
];
