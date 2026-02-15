import { Routes } from '@angular/router';

/**
 * Routes de l'application
 * Chaque page est chargée en lazy loading pour optimiser le bundle
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
  },
  {
    path: 'activities',
    loadComponent: () => import('./features/activities/activity-list').then(m => m.ActivityList)
  },
  {
    path: 'activities/:id',
    loadComponent: () => import('./features/activities/activity-detail').then(m => m.ActivityDetailComponent)
  },
  {
    path: 'map',
    loadComponent: () => import('./features/maps/global-map').then(m => m.GlobalMap)
  }
];
