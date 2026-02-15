import { Component, inject } from '@angular/core';
import { StravaService } from '../../core/services/strava.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="min-h-[80vh] flex items-center justify-center">
      <div class="text-center max-w-md mx-auto px-6">
        <div class="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-200/60 p-10">
          <!-- Logo -->
          <div class="text-5xl mb-4 bg-strava rounded-2xl w-20 h-20 flex items-center justify-center mx-auto shadow-lg">
            🏃
          </div>
          <h1 class="text-3xl font-bold text-slate-800 tracking-tight mb-2">Strava Dashboard</h1>
          <p class="text-slate-500 mb-8">Connectez-vous avec votre compte Strava pour visualiser vos activités</p>

          <!-- Bouton Strava -->
          <button (click)="strava.login()"
                  class="inline-flex items-center gap-3 bg-strava hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-xl shadow-md hover:shadow-lg transition-all text-lg cursor-pointer">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
            </svg>
            Se connecter avec Strava
          </button>

          <p class="text-xs text-slate-400 mt-6">
            Accès en lecture seule à vos activités et votre profil
          </p>
        </div>
      </div>
    </div>
  `
})
export class Login {
  protected readonly strava = inject(StravaService);
}
