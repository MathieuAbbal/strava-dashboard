import { Component, computed, inject, signal, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { StravaService } from '../../core/services/strava.service';
import { ActivitySummary } from '../../core/models/strava.models';
import {
  metersToKm,
  secondsToHoursMin,
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
    <div class="max-w-7xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-8">Activités</h1>

      <!-- Filtres -->
      <div class="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap gap-4 items-center">
        <!-- Filtre par type -->
        <div>
          <label class="text-sm text-gray-500 block mb-1">Type d'activité</label>
          <select
            [ngModel]="selectedType()"
            (ngModelChange)="selectedType.set($event)"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">Tous les types</option>
            @for (type of availableTypes(); track type) {
              <option [value]="type">{{ type }}</option>
            }
          </select>
        </div>

        <!-- Filtre par date (depuis) -->
        <div>
          <label class="text-sm text-gray-500 block mb-1">Depuis</label>
          <input type="date"
            [ngModel]="dateFrom()"
            (ngModelChange)="dateFrom.set($event)"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>

        <!-- Filtre par date (jusqu'à) -->
        <div>
          <label class="text-sm text-gray-500 block mb-1">Jusqu'à</label>
          <input type="date"
            [ngModel]="dateTo()"
            (ngModelChange)="dateTo.set($event)"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>

        <!-- Compteur résultats -->
        <div class="ml-auto text-sm text-gray-500">
          {{ filteredActivities().length }} activité(s)
        </div>
      </div>

      <!-- Message de chargement -->
      @if (strava.loading()) {
        <div class="text-center py-12">
          <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent"></div>
          <p class="mt-2 text-gray-500">Chargement...</p>
        </div>
      }

      <!-- Liste des activités -->
      <div class="space-y-3">
        @for (activity of filteredActivities(); track activity.id) {
          <a [routerLink]="['/activities', activity.id]"
             class="block bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4">
            <div class="flex items-center gap-4">
              <!-- Icône type -->
              <div class="text-3xl">{{ getIcon(activity.type) }}</div>

              <!-- Infos principales -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-800 truncate">{{ activity.name }}</h3>
                  <span class="text-xs px-2 py-0.5 rounded-full text-white"
                        [style.background-color]="getColor(activity.type)">
                    {{ activity.type }}
                  </span>
                </div>
                <p class="text-sm text-gray-500">{{ formatDate(activity.start_date) }}</p>
              </div>

              <!-- Statistiques -->
              <div class="flex gap-6 text-sm text-gray-600">
                <div class="text-center">
                  <p class="font-semibold text-gray-800">{{ formatDistance(activity.distance) }}</p>
                  <p class="text-xs text-gray-400">km</p>
                </div>
                <div class="text-center">
                  <p class="font-semibold text-gray-800">{{ formatDuration(activity.moving_time) }}</p>
                  <p class="text-xs text-gray-400">durée</p>
                </div>
                <div class="text-center">
                  <p class="font-semibold text-gray-800">{{ activity.total_elevation_gain | number:'1.0-0' }} m</p>
                  <p class="text-xs text-gray-400">D+</p>
                </div>
              </div>
            </div>
          </a>
        }
      </div>

      <!-- Aucun résultat -->
      @if (!strava.loading() && filteredActivities().length === 0) {
        <div class="text-center py-12 text-gray-400">
          <p class="text-lg">Aucune activité trouvée</p>
          <p class="text-sm mt-1">Modifiez vos filtres ou vérifiez votre token Strava</p>
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
}
