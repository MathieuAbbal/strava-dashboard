import { Component, computed, inject, signal, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StravaService } from '../../core/services/strava.service';
import { ActivitySummary } from '../../core/models/strava.models';
import {
  activityColor,
  activityIcon,
  metersToKm,
  secondsToHoursMin,
  formatDateFr
} from '../../core/utils/format';

/** Noms français des mois */
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

/** Jours de la semaine (lundi-dimanche) */
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Représente un jour dans la grille du calendrier */
interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  activities: ActivitySummary[];
}

/**
 * Page Calendrier d'entraînement
 * Affiche une grille mensuelle avec les activités colorées par type
 */
@Component({
  selector: 'app-training-calendar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-7xl mx-auto px-6 py-8">
      <h1 class="text-3xl font-bold text-slate-800 tracking-tight mb-8">Calendrier</h1>

      <!-- Chargement -->
      @if (strava.loading()) {
        <div class="text-center py-16">
          <div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
          <p class="mt-3 text-slate-400 font-medium">Chargement des activités...</p>
        </div>
      }

      @if (!strava.loading()) {
        <!-- Navigation mois -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow duration-300">
          <div class="flex items-center justify-between mb-6">
            <button (click)="prevMonth()"
                    class="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
              <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <h2 class="text-lg font-semibold text-slate-700 capitalize">
              {{ monthLabel() }}
            </h2>
            <button (click)="nextMonth()"
                    class="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
              <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          <!-- En-tête jours -->
          <div class="grid grid-cols-7 gap-1 mb-1">
            @for (jour of weekDays; track jour) {
              <div class="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider py-2">
                {{ jour }}
              </div>
            }
          </div>

          <!-- Grille calendrier -->
          <div class="grid grid-cols-7 gap-1">
            @for (day of calendarDays(); track day.date.toISOString()) {
              <div class="relative group min-h-[70px] sm:min-h-[90px] rounded-xl border transition-all duration-200"
                   [class]="getDayClasses(day)">
                <!-- Numéro du jour -->
                <div class="p-1.5 sm:p-2">
                  <span class="text-xs sm:text-sm font-medium"
                        [class]="day.isToday ? 'bg-strava text-white w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center' : (day.isCurrentMonth ? 'text-slate-700' : 'text-slate-300')">
                    {{ day.day }}
                  </span>
                </div>

                <!-- Indicateurs d'activités -->
                @if (day.activities.length > 0) {
                  <div class="px-1.5 sm:px-2 pb-1.5 flex flex-wrap gap-1">
                    @for (act of day.activities; track act.id) {
                      <a [routerLink]="['/activities', act.id]"
                         class="block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full hover:scale-150 transition-transform cursor-pointer"
                         [style.backgroundColor]="getActivityColor(act.type)"
                         [title]="getTooltip(act)">
                      </a>
                    }
                  </div>
                }

                <!-- Tooltip au survol -->
                @if (day.activities.length > 0) {
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div class="bg-navy text-white text-xs rounded-xl shadow-xl p-3 whitespace-nowrap max-w-[250px]">
                      @for (act of day.activities; track act.id) {
                        <div class="flex items-center gap-2" [class.mt-1.5]="!$first">
                          <span class="text-sm">{{ getActivityIcon(act.type) }}</span>
                          <div class="min-w-0">
                            <p class="font-semibold truncate">{{ act.name }}</p>
                            <p class="text-[10px] opacity-70">
                              {{ formatDistance(act.distance) }} km
                              · {{ formatDuration(act.moving_time) }}
                            </p>
                          </div>
                        </div>
                      }
                      <div class="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-navy rotate-45 -mt-1"></div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Totaux du mois -->
        @if (monthTotals(); as totals) {
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Distance</p>
              <p class="text-2xl font-extrabold text-slate-800 mt-1">{{ totals.distance }} <span class="text-sm font-medium text-slate-400">km</span></p>
            </div>
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Durée</p>
              <p class="text-2xl font-extrabold text-slate-800 mt-1">{{ totals.duration }}</p>
            </div>
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dénivelé</p>
              <p class="text-2xl font-extrabold text-slate-800 mt-1">{{ totals.elevation }} <span class="text-sm font-medium text-slate-400">m</span></p>
            </div>
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Activités</p>
              <p class="text-2xl font-extrabold text-slate-800 mt-1">{{ totals.count }}</p>
            </div>
          </div>
        }

        <!-- Légende des types -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-4 mt-6">
          <div class="flex flex-wrap gap-4 justify-center">
            @for (type of activeTypes(); track type) {
              <div class="flex items-center gap-1.5 text-xs text-slate-600">
                <span class="w-3 h-3 rounded-full" [style.backgroundColor]="getActivityColor(type)"></span>
                {{ getActivityIcon(type) }} {{ type }}
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class TrainingCalendar {
  protected readonly strava = inject(StravaService);

  /** Jours de la semaine pour le template */
  protected readonly weekDays = JOURS;

  /** Année et mois courant affiché */
  protected readonly currentYear = signal(new Date().getFullYear());
  protected readonly currentMonth = signal(new Date().getMonth());

  constructor() {
    afterNextRender(() => {
      if (this.strava.activities().length === 0) {
        this.strava.loadAllActivities();
      }
    });
  }

  /** Label du mois affiché : "mars 2025" */
  protected readonly monthLabel = computed(() => {
    return `${MOIS[this.currentMonth()]} ${this.currentYear()}`;
  });

  /** Map des activités par date (clé = "YYYY-MM-DD") */
  private readonly activitiesByDate = computed(() => {
    const map = new Map<string, ActivitySummary[]>();
    for (const act of this.strava.activities()) {
      const d = new Date(act.start_date);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const list = map.get(key) ?? [];
      list.push(act);
      map.set(key, list);
    }
    return map;
  });

  /** Grille du calendrier pour le mois courant */
  protected readonly calendarDays = computed((): CalendarDay[] => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const actMap = this.activitiesByDate();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    // Premier jour du mois
    const firstDay = new Date(year, month, 1);
    // Dernier jour du mois
    const lastDay = new Date(year, month + 1, 0);

    // Trouver le lundi de la semaine contenant le 1er du mois
    // getDay(): 0=dimanche, 1=lundi ... 6=samedi
    let dayOfWeek = firstDay.getDay();
    // Convertir en lundi=0 ... dimanche=6
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - dayOfWeek);

    // Trouver le dimanche de la semaine contenant le dernier jour du mois
    let lastDayOfWeek = lastDay.getDay();
    lastDayOfWeek = lastDayOfWeek === 0 ? 6 : lastDayOfWeek - 1;
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDayOfWeek));

    const days: CalendarDay[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dateKey = `${cursor.getFullYear()}-${(cursor.getMonth() + 1).toString().padStart(2, '0')}-${cursor.getDate().toString().padStart(2, '0')}`;

      days.push({
        date: new Date(cursor),
        day: cursor.getDate(),
        isCurrentMonth: cursor.getMonth() === month,
        isToday: dateKey === todayKey,
        activities: actMap.get(dateKey) ?? []
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  });

  /** Totaux du mois affiché */
  protected readonly monthTotals = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const acts = this.strava.activities().filter(a => {
      const d = new Date(a.start_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    if (acts.length === 0) return null;

    const totalDist = acts.reduce((s, a) => s + a.distance, 0);
    const totalTime = acts.reduce((s, a) => s + a.moving_time, 0);
    const totalElev = acts.reduce((s, a) => s + a.total_elevation_gain, 0);

    return {
      distance: metersToKm(totalDist),
      duration: secondsToHoursMin(totalTime),
      elevation: Math.round(totalElev).toLocaleString('fr-FR'),
      count: acts.length
    };
  });

  /** Types d'activités présents dans le mois courant */
  protected readonly activeTypes = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const types = new Set<string>();
    for (const act of this.strava.activities()) {
      const d = new Date(act.start_date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        types.add(act.type);
      }
    }
    return [...types];
  });

  /** Naviguer au mois précédent */
  prevMonth(): void {
    const m = this.currentMonth();
    if (m === 0) {
      this.currentMonth.set(11);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.update(v => v - 1);
    }
  }

  /** Naviguer au mois suivant */
  nextMonth(): void {
    const m = this.currentMonth();
    if (m === 11) {
      this.currentMonth.set(0);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.update(v => v + 1);
    }
  }

  /** Classes CSS pour une cellule jour */
  protected getDayClasses(day: CalendarDay): string {
    const base = 'border';
    if (day.isToday) {
      return `${base} border-strava/30 bg-orange-50/50`;
    }
    if (!day.isCurrentMonth) {
      return `${base} border-transparent bg-slate-50/30`;
    }
    if (day.activities.length > 0) {
      return `${base} border-slate-200/60 bg-white hover:border-strava/20 hover:shadow-sm`;
    }
    return `${base} border-slate-100/40 bg-white/40`;
  }

  /** Couleur d'un type d'activité */
  protected getActivityColor(type: string): string {
    return activityColor(type);
  }

  /** Icône d'un type d'activité */
  protected getActivityIcon(type: string): string {
    return activityIcon(type);
  }

  /** Texte du tooltip pour une activité */
  protected getTooltip(act: ActivitySummary): string {
    return `${act.name} — ${metersToKm(act.distance)} km · ${secondsToHoursMin(act.moving_time)}`;
  }

  /** Formater la distance pour le template */
  protected formatDistance(meters: number): string {
    return metersToKm(meters);
  }

  /** Formater la durée pour le template */
  protected formatDuration(seconds: number): string {
    return secondsToHoursMin(seconds);
  }
}
