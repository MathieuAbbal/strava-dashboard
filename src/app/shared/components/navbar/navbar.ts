import { Component, inject, afterNextRender, signal, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { StravaService } from '../../../core/services/strava.service';

/**
 * Barre de navigation principale
 * Liens vers Dashboard, Activités et Carte + profil athlète
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bg-navy text-white shadow-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between h-14 sm:h-16">
          <!-- Logo / Titre -->
          <a routerLink="/" class="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold tracking-tight">
            <span class="text-xl sm:text-2xl bg-strava rounded-lg w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shadow-md shrink-0">🏃</span>
            <span class="hidden sm:inline">Strava <span class="font-light opacity-80">Dashboard</span></span>
            <span class="sm:hidden">Strava</span>
          </a>

          <!-- Liens de navigation -->
          <div class="flex gap-0.5 sm:gap-1 bg-navy-light/50 rounded-xl p-1">
            <a routerLink="/dashboard"
               routerLinkActive="!bg-strava !shadow-md"
               class="px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5">
              <svg class="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
              <span class="hidden sm:inline">Dashboard</span>
            </a>
            <a routerLink="/activities"
               routerLinkActive="!bg-strava !shadow-md"
               class="px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5">
              <svg class="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
              <span class="hidden sm:inline">Activités</span>
            </a>
            <a routerLink="/progression"
               routerLinkActive="!bg-strava !shadow-md"
               class="px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5">
              <svg class="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              <span class="hidden sm:inline">Progression</span>
            </a>
            <a routerLink="/map"
               routerLinkActive="!bg-strava !shadow-md"
               class="px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5">
              <svg class="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
              <span class="hidden sm:inline">Carte</span>
            </a>
          </div>

          <!-- Profil athlète -->
          @if (strava.athlete(); as athlete) {
            <div class="relative">
              <button (click)="profileOpen.set(!profileOpen())"
                      class="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                <img [src]="athlete.profile"
                     [alt]="athlete.firstname"
                     class="w-8 h-8 rounded-full ring-2 ring-white/20 object-cover" />
                <span class="hidden sm:inline text-sm font-medium opacity-90">{{ athlete.firstname }}</span>
                <svg class="w-3.5 h-3.5 opacity-60 hidden sm:block transition-transform"
                     [class.rotate-180]="profileOpen()"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              <!-- Dropdown -->
              @if (profileOpen()) {
                <div class="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden z-50"
                     (click)="profileOpen.set(false)">
                  <div class="bg-gradient-to-br from-strava to-orange-600 p-5 text-center text-white">
                    <img [src]="athlete.profile"
                         [alt]="athlete.firstname"
                         class="w-16 h-16 rounded-full ring-3 ring-white/30 mx-auto mb-2 object-cover" />
                    <p class="font-bold text-lg">{{ athlete.firstname }} {{ athlete.lastname }}</p>
                    @if (athlete.city || athlete.country) {
                      <p class="text-sm opacity-80 mt-0.5">{{ athlete.city }}{{ athlete.city && athlete.country ? ', ' : '' }}{{ athlete.country }}</p>
                    }
                  </div>
                  <div class="p-4 space-y-2.5 text-sm text-slate-600">
                    @if (athlete.state || athlete.country) {
                      <div class="flex justify-between">
                        <span class="text-slate-400">Localisation</span>
                        <span class="font-semibold text-slate-700">{{ athlete.state }}{{ athlete.state && athlete.country ? ', ' : '' }}{{ athlete.country }}</span>
                      </div>
                    }
                    <div class="flex justify-between">
                      <span class="text-slate-400">Activités</span>
                      <span class="font-semibold text-slate-700">{{ strava.activitiesCount() }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-400">Distance totale</span>
                      <span class="font-semibold text-slate-700">{{ strava.totalDistanceKm() }} km</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-400">Temps total</span>
                      <span class="font-semibold text-slate-700">{{ strava.totalTimeHours() }} h</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-400">Dénivelé total</span>
                      <span class="font-semibold text-slate-700">{{ strava.totalElevation() }} m</span>
                    </div>
                    <hr class="border-slate-200 !my-3" />
                    <button (click)="logout($event)"
                            class="w-full text-left text-red-500 hover:text-red-600 font-medium cursor-pointer transition-colors">
                      Se déconnecter
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </nav>
  `
})
export class Navbar {
  protected readonly strava = inject(StravaService);
  private readonly router = inject(Router);
  protected readonly profileOpen = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.profileOpen.set(false);
    }
  }

  logout(event: Event): void {
    event.stopPropagation();
    this.profileOpen.set(false);
    this.strava.logout();
    this.router.navigate(['/login']);
  }

  constructor() {
    afterNextRender(() => {
      if (!this.strava.athlete()) {
        this.strava.loadAthlete();
      }
    });
  }
}
