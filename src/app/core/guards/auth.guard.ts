import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { StravaService } from '../services/strava.service';

export function authGuard() {
  const strava = inject(StravaService);
  const router = inject(Router);

  if (strava.authenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
}
