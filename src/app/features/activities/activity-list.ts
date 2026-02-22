import { Component, computed, inject, signal, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { StravaService } from '../../core/services/strava.service';
import { ActivitySummary } from '../../core/models/strava.models';
import {
  metersToKm,
  secondsToHoursMin,
  speedToPace,
  speedToKmh,
  formatDateFr,
  activityIcon,
  activityColor
} from '../../core/utils/format';

/**
 * Liste des activités avec filtres par type et date
 */
@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  template: `
    <div class="max-w-7xl mx-auto px-6 py-8">
      <h1 class="text-3xl font-bold text-slate-800 tracking-tight mb-8">Activités</h1>

      <!-- Filtres -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5 mb-6 flex flex-wrap gap-5 items-end">
        <!-- Filtre par type -->
        <div>
          <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Type</label>
          <select
            [ngModel]="selectedType()"
            (ngModelChange)="selectedType.set($event)"
            class="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-strava/30 focus:border-strava transition-all">
            <option value="">Tous les types</option>
            @for (type of availableTypes(); track type) {
              <option [value]="type">{{ type }}</option>
            }
          </select>
        </div>

        <!-- Filtre par date (depuis) -->
        <div>
          <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Depuis</label>
          <input type="date"
            [ngModel]="dateFrom()"
            (ngModelChange)="dateFrom.set($event)"
            class="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-strava/30 focus:border-strava transition-all" />
        </div>

        <!-- Filtre par date (jusqu'à) -->
        <div>
          <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Jusqu'à</label>
          <input type="date"
            [ngModel]="dateTo()"
            (ngModelChange)="dateTo.set($event)"
            class="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-strava/30 focus:border-strava transition-all" />
        </div>

        <!-- Compteur résultats -->
        <div class="ml-auto">
          <span class="text-sm font-semibold text-strava bg-strava/10 px-3 py-2 rounded-xl">
            {{ filteredActivities().length }} activité(s)
          </span>
        </div>
      </div>

      <!-- Message de chargement -->
      @if (strava.loading()) {
        <div class="text-center py-16">
          <div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
          <p class="mt-3 text-slate-400 font-medium">Chargement...</p>
        </div>
      }

      <!-- Liste des activités -->
      <div class="space-y-3">
        @for (activity of filteredActivities(); track activity.id; let i = $index) {
          @if (isNewMonth(activity, i)) {
            <div class="flex items-center gap-3 pt-4 first:pt-0">
              <div class="h-px flex-1 bg-slate-200/80"></div>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{{ getMonthLabel(activity.start_date) }}</span>
              <div class="h-px flex-1 bg-slate-200/80"></div>
            </div>
          }
          <a [routerLink]="['/activities', activity.id]"
             class="group block bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-lg hover:border-slate-300/80 transition-all duration-300 p-5 relative overflow-hidden">
            <!-- Bande de couleur à gauche -->
            <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300 group-hover:w-1.5"
                 [style.background-color]="getColor(activity.type)"></div>

            <div class="flex items-center gap-4 pl-3">
              <!-- Icône type -->
              <div class="text-3xl w-12 h-12 flex items-center justify-center rounded-xl bg-slate-50 group-hover:scale-110 transition-transform duration-300">{{ getIcon(activity.type) }}</div>

              <!-- Infos principales -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-slate-800 truncate group-hover:text-strava transition-colors hidden sm:inline">{{ activity.name }}</h3>
                  <span class="text-xs font-medium px-2.5 py-0.5 rounded-full text-white shadow-sm"
                        [style.background-color]="getColor(activity.type)">
                    {{ activity.type }}
                  </span>
                </div>
                <p class="text-sm text-slate-400 mt-0.5">{{ formatDate(activity.start_date) }}</p>
              </div>

              <!-- Statistiques -->
              <div class="flex gap-6 text-sm">
                <div class="text-center">
                  <p class="font-bold text-slate-700 text-base">{{ formatDistance(activity.distance) }}</p>
                  <p class="text-xs text-slate-400 font-medium">km</p>
                </div>
                <div class="text-center">
                  <p class="font-bold text-slate-700 text-base">{{ formatDuration(activity.moving_time) }}</p>
                  <p class="text-xs text-slate-400 font-medium">durée</p>
                </div>
                <div class="text-center hidden sm:block">
                  <p class="font-bold text-slate-700 text-base">{{ activity.total_elevation_gain | number:'1.0-0' }} m</p>
                  <p class="text-xs text-slate-400 font-medium">D+</p>
                </div>
                <div class="text-center">
                  <p class="font-bold text-slate-700 text-base">{{ formatSpeed(activity) }}</p>
                  <p class="text-xs text-slate-400 font-medium">{{ isRunType(activity.type) ? 'allure' : 'vitesse' }}</p>
                </div>
                @if (activity.average_heartrate) {
                  <div class="text-center hidden sm:block">
                    <p class="font-bold text-red-500 text-base">{{ activity.average_heartrate | number:'1.0-0' }}</p>
                    <p class="text-xs text-slate-400 font-medium">bpm</p>
                  </div>
                }
                @if (activity.average_watts) {
                  <div class="text-center">
                    <p class="font-bold text-amber-500 text-base">{{ activity.average_watts | number:'1.0-0' }}</p>
                    <p class="text-xs text-slate-400 font-medium">watts</p>
                  </div>
                }
              </div>
            </div>
          </a>
        }
      </div>

      <!-- Aucun résultat -->
      @if (!strava.loading() && filteredActivities().length === 0) {
        <div class="text-center py-16 text-slate-300">
          <p class="text-xl font-semibold">Aucune activité trouvée</p>
          <p class="text-sm mt-2 text-slate-400">Modifiez vos filtres ou vérifiez votre token Strava</p>
        </div>
      }
    </div>
  `
})
export class ActivityList {
  protected readonly strava = inject(StravaService);

  /** Filtres */
  protected readonly selectedType = signal('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');

  /** Types d'activités disponibles (calculés depuis les données) */
  protected readonly availableTypes = computed(() => {
    const types = new Set(this.strava.activities().map(a => a.type));
    return [...types].sort();
  });

  /** Activités filtrées selon les critères sélectionnés */
  protected readonly filteredActivities = computed(() => {
    let activities = this.strava.activities();

    // Filtre par type
    const type = this.selectedType();
    if (type) {
      activities = activities.filter(a => a.type === type);
    }

    // Filtre par date de début
    const from = this.dateFrom();
    if (from) {
      const fromDate = new Date(from);
      activities = activities.filter(a => new Date(a.start_date) >= fromDate);
    }

    // Filtre par date de fin
    const to = this.dateTo();
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59);
      activities = activities.filter(a => new Date(a.start_date) <= toDate);
    }

    return activities;
  });

  constructor() {
    // Charger les activités si pas encore fait
    afterNextRender(() => {
      if (this.strava.activities().length === 0) {
        this.strava.loadActivities(1, 200);
      }
    });
  }

  // Méthodes de formatage exposées au template
  protected formatDistance(meters: number): string { return metersToKm(meters); }
  protected formatDuration(seconds: number): string { return secondsToHoursMin(seconds); }
  protected formatDate(iso: string): string { return formatDateFr(iso); }
  protected getIcon(type: string): string { return activityIcon(type); }
  protected getColor(type: string): string { return activityColor(type); }
  protected isRunType(type: string): boolean { return ['Run', 'TrailRun', 'Walk', 'Hike'].includes(type); }
  protected formatSpeed(activity: ActivitySummary): string {
    return this.isRunType(activity.type) ? speedToPace(activity.average_speed) : speedToKmh(activity.average_speed) + ' km/h';
  }

  protected isNewMonth(activity: ActivitySummary, index: number): boolean {
    if (index === 0) return true;
    const prev = this.filteredActivities()[index - 1];
    const cur = new Date(activity.start_date);
    const pre = new Date(prev.start_date);
    return cur.getMonth() !== pre.getMonth() || cur.getFullYear() !== pre.getFullYear();
  }

  protected getMonthLabel(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

}
