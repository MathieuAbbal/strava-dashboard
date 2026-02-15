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
import { activityColor, activityTypeFr, secondsToHoursMin } from '../../core/utils/format';
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
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 class="text-3xl font-bold text-gray-800">Tableau de bord</h1>

        <!-- Sélecteur de période -->
        <div class="flex bg-white rounded-xl shadow-md p-1 gap-1">
          @for (p of periods; track p.key) {
            <button (click)="selectPeriod(p.key)"
                    [class]="selectedPeriod() === p.key
                      ? 'bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-medium'
                      : 'text-gray-600 hover:bg-gray-100 rounded-lg px-4 py-2 text-sm font-medium'">
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <!-- Navigation période (flèches + label) -->
      @if (selectedPeriod() !== 'all') {
        <div class="flex items-center gap-3 mb-6">
          <button (click)="offset.set(offset() - 1)"
                  class="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button (click)="offset.set(0)"
                  class="text-sm font-medium px-3 py-1 rounded-lg transition-colors"
                  [class]="offset() === 0
                    ? 'text-orange-600 bg-orange-50'
                    : 'text-gray-700 hover:bg-gray-100 cursor-pointer'">
            {{ periodLabel() }}
          </button>

          <button (click)="offset.set(offset() + 1)"
                  [disabled]="offset() >= 0"
                  class="p-2 rounded-lg transition-colors"
                  [class]="offset() >= 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-200'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          @if (offset() !== 0) {
            <button (click)="offset.set(0)"
                    class="text-xs text-orange-500 hover:text-orange-700 ml-1">
              Aujourd'hui
            </button>
          }
        </div>
      } @else {
        <p class="text-sm text-gray-500 mb-6">{{ periodLabel() }}</p>
      }

      <!-- Chargement -->
      @if (strava.loading()) {
        <div class="text-center py-12">
          <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent"></div>
          <p class="mt-2 text-gray-500">Chargement des données...</p>
        </div>
      }

      <!-- Erreur -->
      @if (strava.error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {{ strava.error() }}
        </div>
      }

      @if (!strava.loading()) {
        <!-- Cards statistiques -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div class="bg-white rounded-xl shadow-md p-5 border-l-4 border-orange-500">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Activités</p>
            <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats().count }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Distance</p>
            <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats().distanceKm }} km</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Dénivelé</p>
            <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats().elevation }} m</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-5 border-l-4 border-purple-500">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Durée</p>
            <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats().duration }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-5 border-l-4 border-cyan-500">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Moy. / sortie</p>
            <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats().avgDistanceKm }} km</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500">
            <p class="text-xs text-gray-500 uppercase tracking-wide">Fréquence</p>
            <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats().frequency }}</p>
          </div>
        </div>

        <!-- Graphiques ligne 1 : barres + camembert -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
            <h2 class="text-lg font-semibold text-gray-700 mb-4">{{ barChartTitle() }}</h2>
            <canvas #barChart></canvas>
          </div>
          <div class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-lg font-semibold text-gray-700 mb-4">Répartition par type</h2>
            <canvas #typeChart></canvas>
          </div>
        </div>

        <!-- Graphiques ligne 2 : dénivelé + durée -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-lg font-semibold text-gray-700 mb-4">{{ elevChartTitle() }}</h2>
            <canvas #elevChart></canvas>
          </div>
          <div class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-lg font-semibold text-gray-700 mb-4">{{ durationChartTitle() }}</h2>
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
    const period = this.selectedPeriod();
    const off = this.offset();
    const now = new Date();

    if (period === 'all') return { start: null, end: null };

    let start: Date;
    let end: Date;

    if (period === 'week') {
      // Lundi de la semaine courante + offset
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
      // year
      start = new Date(now.getFullYear() + off, 0, 1);
      end = new Date(now.getFullYear() + off, 11, 31, 23, 59, 59, 999);
    }

    return { start, end };
  });

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

  constructor() {
    afterNextRender(() => {
      this.strava.loadAllActivities();
    });

    // Mise à jour des 4 graphiques quand les données ou la période changent
    effect(() => { this.renderBar(this.barCanvas(), this.barData(), 'bar', '#f97316', 'km'); });
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
          backgroundColor: color,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.parsed.y} ${unit}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: unit }
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
          backgroundColor: data.colors
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
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
}
