import {
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  ElementRef,
  afterNextRender
} from '@angular/core';
import { StravaService } from '../../core/services/strava.service';
import { ActivitySummary } from '../../core/models/strava.models';
import { activityColor, activityTypeFr, metersToKm, secondsToHoursMin } from '../../core/utils/format';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

/** Périodes d'analyse disponibles */
type Period = 'week' | 'month' | 'year' | 'all';

/** Noms français des jours (lundi = index 0) */
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
/** Noms français des mois */
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Page Dashboard avancée
 * Analyse fine par semaine, mois, année ou toutes les activités
 * Navigation entre périodes (précédent / suivant)
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="max-w-7xl mx-auto px-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 class="text-3xl font-bold text-slate-800 tracking-tight">Tableau de bord</h1>

        <!-- Sélecteur de période -->
        <div class="flex bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60 p-1 gap-1">
          @for (p of periods; track p.key) {
            <button (click)="selectPeriod(p.key)"
                    [class]="selectedPeriod() === p.key
                      ? 'bg-strava text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-md'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200'">
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <!-- Navigation période (flèches + label) -->
      @if (selectedPeriod() !== 'all') {
        <div class="flex items-center gap-3 mb-6">
          <button (click)="offset.set(offset() - 1)"
                  class="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-700 transition-all duration-200">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button (click)="offset.set(0)"
                  class="text-sm font-semibold px-4 py-1.5 rounded-xl transition-all duration-200"
                  [class]="offset() === 0
                    ? 'text-strava bg-strava/10'
                    : 'text-slate-600 hover:bg-white hover:shadow-sm cursor-pointer'">
            {{ periodLabel() }}
          </button>

          <button (click)="offset.set(offset() + 1)"
                  [disabled]="offset() >= 0"
                  class="p-2 rounded-xl transition-all duration-200"
                  [class]="offset() >= 0
                    ? 'text-slate-200 cursor-not-allowed'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-white hover:shadow-sm'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          @if (offset() !== 0) {
            <button (click)="offset.set(0)"
                    class="text-xs font-semibold text-strava hover:text-strava-dark ml-1 transition-colors">
              Aujourd'hui
            </button>
          }
        </div>
      } @else {
        <p class="text-sm text-slate-400 mb-6 font-medium">{{ periodLabel() }}</p>
      }

      <!-- Chargement -->
      @if (strava.loading()) {
        <div class="text-center py-16">
          <div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
          <p class="mt-3 text-slate-400 font-medium">Chargement des données...</p>
        </div>
      }

      <!-- Erreur -->
      @if (strava.error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-6 font-medium">
          {{ strava.error() }}
        </div>
      }

      @if (!strava.loading()) {
        <!-- Cards statistiques -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div class="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg shadow-orange-500/20 p-5 text-white">
            <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Activités</p>
            <p class="text-3xl font-extrabold mt-2">{{ stats().count }}</p>
          </div>
          <div class="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20 p-5 text-white">
            <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Distance</p>
            <p class="text-3xl font-extrabold mt-2">{{ stats().distanceKm }} <span class="text-base font-medium opacity-80">km</span></p>
          </div>
          <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20 p-5 text-white">
            <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Dénivelé</p>
            <p class="text-3xl font-extrabold mt-2">{{ stats().elevation }} <span class="text-base font-medium opacity-80">m</span></p>
          </div>
          <div class="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/20 p-5 text-white">
            <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Durée</p>
            <p class="text-3xl font-extrabold mt-2">{{ stats().duration }}</p>
          </div>
          <div class="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl shadow-lg shadow-cyan-500/20 p-5 text-white">
            <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Moy. / sortie</p>
            <p class="text-3xl font-extrabold mt-2">{{ stats().avgDistanceKm }} <span class="text-base font-medium opacity-80">km</span></p>
          </div>
          <div class="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl shadow-lg shadow-rose-500/20 p-5 text-white">
            <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Fréquence</p>
            <p class="text-3xl font-extrabold mt-2">{{ stats().frequency }}</p>
          </div>
        </div>

        <!-- Comparaison vs période précédente -->
        @if (selectedPeriod() !== 'all' && comparison()) {
          <div class="mb-8 -mt-4">
            <div class="flex items-center gap-2 mb-2 px-1">
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ comparisonLabel() }}</span>
              @if (isCurrentPeriod()) {
                <span class="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">période en cours</span>
              }
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              @for (item of comparison()!; track item.label) {
                <div class="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/40 px-4 py-3 flex items-center justify-between">
                  <span class="text-xs font-medium text-slate-500">{{ item.label }}</span>
                  <span class="text-sm font-bold px-2 py-0.5 rounded-lg"
                        [class]="item.pct >= 0
                          ? 'text-emerald-700 bg-emerald-100'
                          : 'text-red-700 bg-red-100'">
                    {{ item.pct >= 0 ? '+' : '' }}{{ item.pct }}%
                  </span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Résumé hebdomadaire -->
        @if (weeklyStats().length > 0) {
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 overflow-auto">
            <h2 class="text-base font-semibold text-slate-700 mb-4">Résumé hebdomadaire</h2>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-200">
                  <th class="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Semaine</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">L</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">M</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">M</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">J</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">V</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">S</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">D</th>
                  <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dist.</th>
                  <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Durée</th>
                  <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">D+</th>
                </tr>
              </thead>
              <tbody>
                @for (week of weeklyStats(); track week.label) {
                  <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      [class]="week.isCurrent ? 'bg-strava/5' : ''">
                    <td class="py-3 px-2 font-semibold text-slate-700 whitespace-nowrap">
                      {{ week.label }}
                      @if (week.isCurrent) {
                        <span class="text-[10px] font-medium text-strava ml-1">en cours</span>
                      }
                    </td>
                    @for (day of week.days; track $index) {
                      <td class="py-3 px-1 text-center">
                        @if (day.hasActivity) {
                          <div class="mx-auto rounded-full transition-all"
                               [style.width.px]="12 + day.pct * 0.16"
                               [style.height.px]="12 + day.pct * 0.16"
                               [style.background-color]="day.color"
                               [style.opacity]="0.6 + day.pct * 0.004"
                               [title]="day.tooltip">
                          </div>
                        } @else {
                          <div class="mx-auto w-2 h-2 rounded-full bg-slate-200" [title]="day.tooltip"></div>
                        }
                      </td>
                    }
                    <td class="py-3 px-2 text-right font-semibold text-slate-700">{{ week.distanceKm }} km</td>
                    <td class="py-3 px-2 text-right text-slate-600">{{ week.duration }}</td>
                    <td class="py-3 px-2 text-right text-slate-600">{{ week.elevation }} m</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- Graphiques ligne 1 : barres + camembert -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 lg:col-span-2 hover:shadow-md transition-shadow duration-300">
            <h2 class="text-base font-semibold text-slate-700 mb-4">{{ barChartTitle() }}</h2>
            <canvas #barChart></canvas>
          </div>
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow duration-300">
            <h2 class="text-base font-semibold text-slate-700 mb-4">Répartition par type</h2>
            <canvas #typeChart></canvas>
          </div>
        </div>

        <!-- Graphiques ligne 2 : dénivelé + durée -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow duration-300">
            <h2 class="text-base font-semibold text-slate-700 mb-4">{{ elevChartTitle() }}</h2>
            <canvas #elevChart></canvas>
          </div>
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow duration-300">
            <h2 class="text-base font-semibold text-slate-700 mb-4">{{ durationChartTitle() }}</h2>
            <canvas #durationChart></canvas>
          </div>
        </div>

      }
    </div>
  `
})
export class Dashboard {
  protected readonly strava = inject(StravaService);

  /** Période sélectionnée */
  protected readonly selectedPeriod = signal<Period>('month');

  /** Offset de navigation (0 = courant, -1 = précédent, etc.) */
  protected readonly offset = signal(0);

  /** Options du sélecteur */
  protected readonly periods = [
    { key: 'week' as Period, label: 'Semaine' },
    { key: 'month' as Period, label: 'Mois' },
    { key: 'year' as Period, label: 'Année' },
    { key: 'all' as Period, label: 'Tout' },
  ];

  /** Références canvas */
  private readonly barCanvas = viewChild<ElementRef<HTMLCanvasElement>>('barChart');
  private readonly typeCanvas = viewChild<ElementRef<HTMLCanvasElement>>('typeChart');
  private readonly elevCanvas = viewChild<ElementRef<HTMLCanvasElement>>('elevChart');
  private readonly durationCanvas = viewChild<ElementRef<HTMLCanvasElement>>('durationChart');

  /** Instances Chart.js */
  private barChart: Chart | null = null;
  private typeChart: Chart | null = null;
  private elevChart: Chart | null = null;
  private durationChart: Chart | null = null;

  /** Changer de type de période et remettre l'offset à 0 */
  protected selectPeriod(period: Period): void {
    this.selectedPeriod.set(period);
    this.offset.set(0);
  }

  // ── Computed : plage de dates selon période + offset ──

  /** Début et fin de la période sélectionnée (avec offset) */
  private readonly periodRange = computed(() => {
    return this.computePeriodRange(this.selectedPeriod(), this.offset());
  });

  /** Calculer la plage de dates pour une période et un offset donnés */
  private computePeriodRange(period: Period, off: number): { start: Date | null; end: Date | null } {
    const now = new Date();
    if (period === 'all') return { start: null, end: null };

    let start: Date;
    let end: Date;

    if (period === 'week') {
      start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1) + off * 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth() + off, 1);
      end = new Date(now.getFullYear(), now.getMonth() + off + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear() + off, 0, 1);
      end = new Date(now.getFullYear() + off, 11, 31, 23, 59, 59, 999);
    }

    return { start, end };
  }

  /** Activités filtrées selon la période + offset */
  protected readonly filtered = computed(() => {
    const all = this.strava.activities();
    const { start, end } = this.periodRange();

    if (!start || !end) return all;

    return all.filter(a => {
      const d = new Date(a.start_date);
      return d >= start && d <= end;
    });
  });

  /** Statistiques calculées pour la période */
  protected readonly stats = computed(() => {
    const acts = this.filtered();
    const count = acts.length;
    const totalDist = acts.reduce((s, a) => s + a.distance, 0);
    const totalElev = acts.reduce((s, a) => s + a.total_elevation_gain, 0);
    const totalTime = acts.reduce((s, a) => s + a.moving_time, 0);

    const period = this.selectedPeriod();
    let freqLabel: string;
    if (count === 0) {
      freqLabel = '-';
    } else if (period === 'week') {
      freqLabel = `${count}/sem`;
    } else if (period === 'all') {
      const firstDate = new Date(acts[acts.length - 1].start_date);
      const weeks = Math.max(1, Math.ceil((Date.now() - firstDate.getTime()) / (7 * 86400000)));
      freqLabel = `${(Math.round(count / weeks * 10) / 10)}/sem`;
    } else {
      // Mois ou année : calculer sur la durée de la période
      const range = this.periodRange();
      const rangeEnd = range.end && range.end < new Date() ? range.end : new Date();
      const weeks = Math.max(1, Math.ceil((rangeEnd.getTime() - range.start!.getTime()) / (7 * 86400000)));
      freqLabel = `${(Math.round(count / weeks * 10) / 10)}/sem`;
    }

    return {
      count,
      distanceKm: Math.round(totalDist / 1000),
      elevation: Math.round(totalElev),
      duration: secondsToHoursMin(totalTime),
      avgDistanceKm: count > 0 ? (totalDist / count / 1000).toFixed(1) : '0',
      frequency: freqLabel
    };
  });

  /** Activités de la période précédente (pour comparaison) */
  private readonly previousFiltered = computed(() => {
    const period = this.selectedPeriod();
    if (period === 'all') return [];
    const all = this.strava.activities();
    const { start, end } = this.computePeriodRange(period, this.offset() - 1);
    if (!start || !end) return [];
    return all.filter(a => {
      const d = new Date(a.start_date);
      return d >= start && d <= end;
    });
  });

  /** Label descriptif de la comparaison */
  protected readonly comparisonLabel = computed(() => {
    const period = this.selectedPeriod();
    if (period === 'all') return '';
    const prev = this.computePeriodRange(period, this.offset() - 1);
    if (!prev.start) return '';

    const start = prev.start;
    if (period === 'week') {
      const end = prev.end!;
      const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return `vs semaine du ${fmt(start)} au ${fmt(end)}`;
    }
    if (period === 'month') {
      return `vs ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
    }
    return `vs ${start.getFullYear()}`;
  });

  /** Indique si la période actuelle est en cours (données partielles) */
  protected readonly isCurrentPeriod = computed(() => {
    return this.offset() === 0 && this.selectedPeriod() !== 'all';
  });

  /** Comparaison en % vs période précédente */
  protected readonly comparison = computed(() => {
    if (this.selectedPeriod() === 'all') return null;
    const curr = this.filtered();
    const prev = this.previousFiltered();
    if (prev.length === 0) return null;

    const pct = (c: number, p: number) => p === 0 ? 0 : Math.round((c - p) / p * 100);

    const currDist = curr.reduce((s, a) => s + a.distance, 0);
    const prevDist = prev.reduce((s, a) => s + a.distance, 0);
    const currElev = curr.reduce((s, a) => s + a.total_elevation_gain, 0);
    const prevElev = prev.reduce((s, a) => s + a.total_elevation_gain, 0);
    const currTime = curr.reduce((s, a) => s + a.moving_time, 0);
    const prevTime = prev.reduce((s, a) => s + a.moving_time, 0);
    const currAvg = curr.length > 0 ? currDist / curr.length : 0;
    const prevAvg = prev.length > 0 ? prevDist / prev.length : 0;

    return [
      { label: 'Activités', pct: pct(curr.length, prev.length) },
      { label: 'Distance', pct: pct(currDist, prevDist) },
      { label: 'Dénivelé', pct: pct(currElev, prevElev) },
      { label: 'Durée', pct: pct(currTime, prevTime) },
      { label: 'Moy/sortie', pct: pct(currAvg, prevAvg) }
    ];
  });

  /** Label décrivant la période en cours */
  protected readonly periodLabel = computed(() => {
    const range = this.periodRange();
    const period = this.selectedPeriod();

    if (period === 'all') return 'Toutes les activités';

    const start = range.start!;

    if (period === 'week') {
      const end = range.end!;
      const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return `Semaine du ${fmt(start)} au ${fmt(end)}`;
    }
    if (period === 'month') {
      return start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    // year
    return `Année ${start.getFullYear()}`;
  });

  /** Titre du graphique en barres selon la période */
  protected readonly barChartTitle = computed(() => {
    switch (this.selectedPeriod()) {
      case 'week': return 'Kilomètres par jour';
      case 'month': return 'Kilomètres par jour';
      case 'year': return 'Kilomètres par mois';
      case 'all': return 'Kilomètres par année';
    }
  });

  protected readonly elevChartTitle = computed(() => {
    switch (this.selectedPeriod()) {
      case 'week': return 'Dénivelé par jour (m)';
      case 'month': return 'Dénivelé par jour (m)';
      case 'year': return 'Dénivelé par mois (m)';
      case 'all': return 'Dénivelé par année (m)';
    }
  });

  protected readonly durationChartTitle = computed(() => {
    switch (this.selectedPeriod()) {
      case 'week': return 'Durée par jour (min)';
      case 'month': return 'Durée par jour (min)';
      case 'year': return 'Durée par mois (h)';
      case 'all': return 'Durée par année (h)';
    }
  });

  // ── Computed : données des graphiques ──

  private readonly barData = computed(() => {
    return this.computeBarData(this.filtered(), this.selectedPeriod(), 'distance');
  });

  private readonly elevData = computed(() => {
    return this.computeBarData(this.filtered(), this.selectedPeriod(), 'elevation');
  });

  private readonly durationData = computed(() => {
    return this.computeBarData(this.filtered(), this.selectedPeriod(), 'duration');
  });

  private readonly typeData = computed(() => {
    return this.computeTypeDistribution(this.filtered());
  });

  /** Résumé hebdomadaire : dernières semaines avec stats et mini-barres par jour */
  protected readonly weeklyStats = computed(() => {
    const activities = this.filtered();
    if (activities.length === 0) return [];

    const period = this.selectedPeriod();
    const range = this.periodRange();

    // Calculer le nombre de semaines à couvrir selon la période
    let numWeeks: number;
    if (period === 'week') {
      numWeeks = 1;
    } else if (period === 'month') {
      numWeeks = 5;
    } else if (period === 'year') {
      // Couvrir toute l'année (~53 semaines)
      numWeeks = 53;
    } else {
      // "all" : de l'activité la plus ancienne à aujourd'hui
      const oldest = activities[activities.length - 1];
      const oldestDate = new Date(oldest.start_date);
      const diffMs = Date.now() - oldestDate.getTime();
      numWeeks = Math.ceil(diffMs / (7 * 86400000)) + 1;
    }

    // Trouver le lundi de la semaine courante (ou de la fin de la période)
    const refDate = range.end && range.end < new Date() ? range.end : new Date();
    const refDay = refDate.getDay();
    const monday = new Date(refDate);
    monday.setDate(monday.getDate() - (refDay === 0 ? 6 : refDay - 1));
    monday.setHours(0, 0, 0, 0);

    const now = new Date();
    const todayStr = this.toLocalDateStr(now);

    // Indexer les activités par date (YYYY-MM-DD) en date locale
    const byDate = new Map<string, ActivitySummary[]>();
    for (const act of activities) {
      const d = new Date(act.start_date);
      const key = this.toLocalDateStr(d);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(act);
    }

    // Max distance en un jour (pour les barres proportionnelles)
    let maxDayDist = 0;
    for (const acts of byDate.values()) {
      const dist = acts.reduce((s, a) => s + a.distance, 0);
      if (dist > maxDayDist) maxDayDist = dist;
    }

    const weeks: {
      label: string;
      count: number;
      distanceKm: string;
      duration: string;
      elevation: number;
      isCurrent: boolean;
      days: { pct: number; hasActivity: boolean; color: string; tooltip: string }[];
    }[] = [];

    for (let w = 0; w < numWeeks; w++) {
      const weekStart = new Date(monday);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const label = `${fmt(weekStart)} - ${fmt(weekEnd)}`;
      const isCurrent = todayStr >= this.toLocalDateStr(weekStart) && todayStr <= this.toLocalDateStr(weekEnd);

      let count = 0, dist = 0, elev = 0, time = 0;
      const days: { pct: number; hasActivity: boolean; color: string; tooltip: string }[] = [];

      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + d);
        const key = this.toLocalDateStr(day);
        const dayActs = byDate.get(key) ?? [];
        const dayDist = dayActs.reduce((s, a) => s + a.distance, 0);
        const dayElev = dayActs.reduce((s, a) => s + a.total_elevation_gain, 0);
        const dayTime = dayActs.reduce((s, a) => s + a.moving_time, 0);

        count += dayActs.length;
        dist += dayDist;
        elev += dayElev;
        time += dayTime;

        const pct = maxDayDist > 0 ? Math.round(dayDist / maxDayDist * 100) : 0;
        const color = dayActs.length > 0 ? activityColor(dayActs[0].type) : '#e2e8f0';
        const dayLabel = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
        const tooltip = dayActs.length > 0
          ? dayActs.map(a => `${a.name} — ${metersToKm(a.distance)} km, ${secondsToHoursMin(a.moving_time)}`).join('\n') + `\n${dayLabel}`
          : dayLabel;

        days.push({ pct, hasActivity: dayActs.length > 0, color, tooltip });
      }

      if (count > 0 || isCurrent) {
        weeks.push({
          label,
          count,
          distanceKm: metersToKm(dist),
          duration: secondsToHoursMin(time),
          elevation: Math.round(elev),
          isCurrent,
          days
        });
      }
    }

    return weeks;
  });

  constructor() {
    afterNextRender(() => {
      this.strava.loadAllActivities();
    });

    // Mise à jour des 4 graphiques quand les données ou la période changent
    effect(() => { this.renderBar(this.barCanvas(), this.barData(), 'bar', '#3b82f6', 'km'); });
    effect(() => { this.renderBar(this.elevCanvas(), this.elevData(), 'elev', '#22c55e', 'm'); });
    effect(() => {
      const p = this.selectedPeriod();
      const unit = (p === 'week' || p === 'month') ? 'min' : 'h';
      this.renderBar(this.durationCanvas(), this.durationData(), 'duration', '#8b5cf6', unit);
    });
    effect(() => { this.renderTypeChart(this.typeCanvas(), this.typeData()); });
  }

  // ── Calcul des données pour les barres ──

  /**
   * Calculer les données d'un graphique en barres selon la période
   * Utilise periodRange pour les buckets (tient compte de l'offset)
   */
  private computeBarData(
    activities: ActivitySummary[],
    period: Period,
    metric: 'distance' | 'elevation' | 'duration'
  ): { labels: string[]; data: number[] } {
    const buckets = new Map<string, number>();
    const range = this.periodRange();

    if (period === 'week') {
      // 7 jours (lundi → dimanche) de la semaine ciblée
      const start = range.start!;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const label = `${JOURS[i]} ${d.getDate()}`;
        buckets.set(label, 0);
      }
    } else if (period === 'month') {
      // 1 bucket par jour du mois (format dd/mm)
      const start = range.start!;
      const end = range.end!;
      const mm = (start.getMonth() + 1).toString().padStart(2, '0');
      const d = new Date(start);
      while (d <= end) {
        buckets.set(`${d.getDate().toString().padStart(2, '0')}/${mm}`, 0);
        d.setDate(d.getDate() + 1);
      }
    } else if (period === 'year') {
      // 12 mois de l'année ciblée
      const year = range.start!.getFullYear();
      for (let m = 0; m < 12; m++) {
        buckets.set(MOIS[m], 0);
      }
    } else {
      // Tout : 1 bucket par année (de la plus ancienne activité à maintenant)
      const currentYear = new Date().getFullYear();
      const oldestYear = activities.length > 0
        ? new Date(activities[activities.length - 1].start_date).getFullYear()
        : currentYear;
      for (let y = oldestYear; y <= currentYear; y++) {
        buckets.set(`${y}`, 0);
      }
    }

    // Remplir les buckets
    for (const act of activities) {
      const date = new Date(act.start_date);
      let key: string;

      if (period === 'week') {
        let dayIdx = date.getDay() - 1;
        if (dayIdx < 0) dayIdx = 6;
        const d = new Date(range.start!);
        d.setDate(d.getDate() + dayIdx);
        key = `${JOURS[dayIdx]} ${d.getDate()}`;
      } else if (period === 'month') {
        key = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (period === 'year') {
        key = MOIS[date.getMonth()];
      } else {
        key = `${date.getFullYear()}`;
      }

      if (!buckets.has(key)) continue;

      let value: number;
      if (metric === 'distance') {
        value = act.distance / 1000;
      } else if (metric === 'elevation') {
        value = act.total_elevation_gain;
      } else {
        value = (period === 'week' || period === 'month') ? act.moving_time / 60 : act.moving_time / 3600;
      }

      buckets.set(key, (buckets.get(key) ?? 0) + value);
    }

    return {
      labels: [...buckets.keys()],
      data: [...buckets.values()].map(v => Math.round(v * 10) / 10)
    };
  }

  /** Calculer la répartition par type d'activité */
  private computeTypeDistribution(activities: ActivitySummary[]): { labels: string[]; data: number[]; colors: string[] } {
    const typeMap = new Map<string, number>();
    for (const act of activities) {
      typeMap.set(act.type, (typeMap.get(act.type) ?? 0) + 1);
    }
    const sorted = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(([type]) => activityTypeFr(type)),
      data: sorted.map(([, count]) => count),
      colors: sorted.map(([type]) => activityColor(type))
    };
  }

  // ── Rendu des graphiques ──

  private renderBar(
    canvasRef: ElementRef<HTMLCanvasElement> | undefined,
    data: { labels: string[]; data: number[] },
    chartId: 'bar' | 'elev' | 'duration',
    color: string,
    unit: string
  ): void {
    if (!canvasRef) return;

    const existing = chartId === 'bar' ? this.barChart
      : chartId === 'elev' ? this.elevChart
      : this.durationChart;
    if (existing) existing.destroy();

    const chart = new Chart(canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: unit,
          data: data.data,
          backgroundColor: color + '99',
          hoverBackgroundColor: color,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1B1F3B',
            titleFont: { weight: 'bold' },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` ${item.parsed.y} ${unit}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: unit, color: '#94a3b8' },
            grid: { color: '#f1f5f9' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', maxRotation: 45 }
          }
        }
      }
    });

    if (chartId === 'bar') this.barChart = chart;
    else if (chartId === 'elev') this.elevChart = chart;
    else this.durationChart = chart;
  }

  private renderTypeChart(
    canvasRef: ElementRef<HTMLCanvasElement> | undefined,
    data: { labels: string[]; data: number[]; colors: string[] }
  ): void {
    if (!canvasRef) return;
    if (this.typeChart) this.typeChart.destroy();

    this.typeChart = new Chart(canvasRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.data,
          backgroundColor: data.colors,
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverBorderColor: '#ffffff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              boxWidth: 8, boxHeight: 8,
              color: '#64748b',
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#1B1F3B',
            titleFont: { weight: 'bold' },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const total = item.dataset.data.reduce((s: number, v) => s + (v as number), 0);
                const pct = Math.round((item.parsed as number) / total * 100);
                return ` ${item.label} : ${item.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /** Formater une date en YYYY-MM-DD en heure locale (évite le décalage UTC de toISOString) */
  private toLocalDateStr(d: Date): string {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }
}
