import {
  Component,
  computed,
  effect,
  inject,
  viewChild,
  ElementRef,
  afterNextRender
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { StravaService } from '../../core/services/strava.service';
import { PersonalRecord } from '../../core/models/strava.models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

/** Noms français des mois */
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Page Progression
 * Courbe de progression depuis les débuts + records personnels
 */
@Component({
  selector: 'app-progression',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-7xl mx-auto px-6 py-8">
      <h1 class="text-3xl font-bold text-slate-800 tracking-tight mb-8">Progression</h1>

      <!-- Chargement -->
      @if (strava.loading()) {
        <div class="text-center py-16">
          <div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
          <p class="mt-3 text-slate-400 font-medium">Chargement des données...</p>
        </div>
      }

      @if (!strava.loading()) {
        <!-- Courbe de progression -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow duration-300">
          <h2 class="text-base font-semibold text-slate-700 mb-4">Progression depuis mes débuts</h2>
          <canvas #progressionChart></canvas>
        </div>

        <!-- Records personnels -->
        @if (records().length > 0) {
          <div class="mt-8">
            <h2 class="text-xl font-bold text-slate-800 tracking-tight mb-4">Records personnels</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (rec of records(); track rec.label) {
                <a [routerLink]="['/activities', rec.activityId]" [queryParams]="{ from: 'progression' }"
                   class="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5 hover:shadow-md hover:border-strava/30 transition-all duration-300">
                  <div class="flex items-start gap-4">
                    <span class="text-2xl">{{ rec.icon }}</span>
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ rec.label }}</p>
                      <p class="text-2xl font-extrabold text-slate-800 mt-1">{{ rec.value }}</p>
                      <p class="text-sm text-slate-500 mt-1 truncate group-hover:text-strava transition-colors">
                        {{ rec.activityName }}
                      </p>
                      <p class="text-xs text-slate-400 mt-0.5">{{ rec.date }}</p>
                    </div>
                  </div>
                </a>
              }
            </div>
          </div>
        }
      }
    </div>
  `
})
export class Progression {
  protected readonly strava = inject(StravaService);

  /** Référence canvas */
  private readonly progressionCanvas = viewChild<ElementRef<HTMLCanvasElement>>('progressionChart');

  /** Instance Chart.js */
  private progressionChartInstance: Chart | null = null;

  constructor() {
    afterNextRender(() => {
      if (this.strava.activities().length === 0) {
        this.strava.loadAllActivities();
      }
    });

    effect(() => { this.renderProgressionChart(this.progressionCanvas(), this.progressionData()); });
  }

  /** Données de progression depuis la première activité */
  protected readonly progressionData = computed(() => {
    const all = this.strava.activities();
    if (all.length === 0) return [];

    const now = new Date();
    const oldest = new Date(all[all.length - 1].start_date);
    const months: { label: string; distance: number; count: number; runTime: number; runDist: number }[] = [];

    const totalMonths = (now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth());

    for (let i = totalMonths; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = `${MOIS[start.getMonth()]} ${start.getFullYear().toString().slice(2)}`;

      const monthActs = all.filter(a => {
        const ad = new Date(a.start_date);
        return ad >= start && ad <= end;
      });

      const distance = monthActs.reduce((s, a) => s + a.distance, 0) / 1000;
      const count = monthActs.length;
      const runs = monthActs.filter(a => a.type === 'Run' || a.type === 'TrailRun');
      const runTime = runs.reduce((s, a) => s + a.moving_time, 0);
      const runDist = runs.reduce((s, a) => s + a.distance, 0);

      months.push({ label, distance: Math.round(distance), count, runTime, runDist });
    }

    return months;
  });

  /** Records personnels (all-time) */
  protected readonly records = computed((): PersonalRecord[] => {
    const all = this.strava.activities();
    if (all.length === 0) return [];

    const records: PersonalRecord[] = [];
    const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Plus longue course
    const runs = all.filter(a => a.type === 'Run' || a.type === 'TrailRun');
    if (runs.length > 0) {
      const best = runs.reduce((prev, curr) => curr.distance > prev.distance ? curr : prev);
      records.push({
        label: 'Plus longue course',
        value: `${(best.distance / 1000).toFixed(1)} km`,
        activityName: best.name,
        activityId: best.id,
        date: fmt(best.start_date),
        icon: '🏃'
      });

      // Meilleur 5 km (estimé)
      const runs5k = runs.filter(a => a.distance >= 5000);
      if (runs5k.length > 0) {
        const best5k = runs5k.reduce((prev, curr) => curr.average_speed > prev.average_speed ? curr : prev);
        const pace = Math.round(1000 / best5k.average_speed);
        records.push({
          label: 'Meilleur 5 km (estimé)',
          value: `${Math.floor(pace / 60)}:${(pace % 60).toString().padStart(2, '0')} /km`,
          activityName: best5k.name,
          activityId: best5k.id,
          date: fmt(best5k.start_date),
          icon: '⚡'
        });
      }

      // Meilleur 10 km (estimé)
      const runs10k = runs.filter(a => a.distance >= 10000);
      if (runs10k.length > 0) {
        const best10k = runs10k.reduce((prev, curr) => curr.average_speed > prev.average_speed ? curr : prev);
        const pace = Math.round(1000 / best10k.average_speed);
        records.push({
          label: 'Meilleur 10 km (estimé)',
          value: `${Math.floor(pace / 60)}:${(pace % 60).toString().padStart(2, '0')} /km`,
          activityName: best10k.name,
          activityId: best10k.id,
          date: fmt(best10k.start_date),
          icon: '🔥'
        });
      }
    }

    // Plus longue sortie vélo
    const rides = all.filter(a => a.type === 'Ride' || a.type === 'VirtualRide');
    if (rides.length > 0) {
      const best = rides.reduce((prev, curr) => curr.distance > prev.distance ? curr : prev);
      records.push({
        label: 'Plus longue sortie vélo',
        value: `${(best.distance / 1000).toFixed(1)} km`,
        activityName: best.name,
        activityId: best.id,
        date: fmt(best.start_date),
        icon: '🚴'
      });
    }

    // Plus gros dénivelé
    const bestElev = all.reduce((prev, curr) => curr.total_elevation_gain > prev.total_elevation_gain ? curr : prev);
    if (bestElev.total_elevation_gain > 0) {
      records.push({
        label: 'Plus gros dénivelé',
        value: `${Math.round(bestElev.total_elevation_gain)} m`,
        activityName: bestElev.name,
        activityId: bestElev.id,
        date: fmt(bestElev.start_date),
        icon: '⛰️'
      });
    }

    // Plus longue activité (durée)
    const bestDur = all.reduce((prev, curr) => curr.moving_time > prev.moving_time ? curr : prev);
    const hours = Math.floor(bestDur.moving_time / 3600);
    const mins = Math.floor((bestDur.moving_time % 3600) / 60);
    records.push({
      label: 'Plus longue activité',
      value: `${hours}h${mins.toString().padStart(2, '0')}`,
      activityName: bestDur.name,
      activityId: bestDur.id,
      date: fmt(bestDur.start_date),
      icon: '⏱️'
    });

    return records;
  });

  /** Rendre le graphique de progression */
  private renderProgressionChart(
    canvasRef: ElementRef<HTMLCanvasElement> | undefined,
    data: { label: string; distance: number; count: number; runTime: number; runDist: number }[]
  ): void {
    if (!canvasRef) return;
    if (this.progressionChartInstance) this.progressionChartInstance.destroy();

    const paces = data.map(m => {
      if (m.runDist === 0) return null;
      return Math.round(m.runTime / (m.runDist / 1000) * 10) / 10 / 60;
    });

    const ptRadius = data.length > 24 ? 2 : 4;
    const ptHover = data.length > 24 ? 4 : 6;

    this.progressionChartInstance = new Chart(canvasRef.nativeElement, {
      type: 'line',
      data: {
        labels: data.map(m => m.label),
        datasets: [
          {
            label: 'Distance (km)',
            data: data.map(m => m.distance),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f640',
            fill: true,
            tension: 0.3,
            yAxisID: 'y',
            pointRadius: ptRadius,
            pointHoverRadius: ptHover,
            pointStyle: 'line'
          },
          {
            label: 'Nb activités',
            data: data.map(m => m.count),
            borderColor: '#f97316',
            backgroundColor: '#f9731600',
            tension: 0.3,
            yAxisID: 'y1',
            pointRadius: ptRadius,
            pointHoverRadius: ptHover,
            pointStyle: 'line'
          },
          {
            label: 'Allure moyenne',
            data: paces,
            borderColor: '#ef4444',
            backgroundColor: '#ef444400',
            borderDash: [5, 5],
            tension: 0.3,
            yAxisID: 'y2',
            pointRadius: ptRadius > 2 ? ptRadius - 1 : 1,
            pointHoverRadius: ptHover - 1,
            spanGaps: true,
            pointStyle: 'line'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 30,
              color: '#64748b',
              font: { size: 12 },
              generateLabels: (chart) => {
                return chart.data.datasets.map((ds, i) => ({
                  text: ds.label ?? '',
                  strokeStyle: ds.borderColor as string,
                  fillStyle: 'transparent',
                  lineDash: (ds as any).borderDash ?? [],
                  lineWidth: 2,
                  pointStyle: 'line',
                  hidden: !chart.isDatasetVisible(i),
                  datasetIndex: i
                }));
              }
            }
          },
          tooltip: {
            backgroundColor: '#1B1F3B',
            titleFont: { weight: 'bold' },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const val = item.parsed.y ?? 0;
                if (item.datasetIndex === 2) {
                  const mins = Math.floor(val);
                  const secs = Math.round((val - mins) * 60);
                  return ` Allure : ${mins}:${secs.toString().padStart(2, '0')} /km`;
                }
                if (item.datasetIndex === 1) return ` ${val} activités`;
                return ` ${val} km`;
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'km', color: '#3b82f6' },
            grid: { color: '#f1f5f9' },
            ticks: { color: '#3b82f6' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            title: { display: true, text: 'Activités', color: '#f97316' },
            grid: { drawOnChartArea: false },
            ticks: { color: '#f97316' }
          },
          y2: {
            type: 'linear',
            position: 'right',
            reverse: true,
            title: { display: false },
            grid: { drawOnChartArea: false },
            ticks: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  }
}
