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
import { secondsToHoursMin } from '../../core/utils/format';
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

        <!-- Totaux carrière -->
        @if (careerTotals(); as totals) {
          <div class="mt-8">
            <h2 class="text-xl font-bold text-slate-800 tracking-tight mb-4">Totaux carrière</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20 p-5 text-white">
                <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Distance totale</p>
                <p class="text-3xl font-extrabold mt-2">{{ totals.distanceKm }} <span class="text-base font-medium opacity-80">km</span></p>
              </div>
              <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20 p-5 text-white">
                <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Dénivelé total</p>
                <p class="text-3xl font-extrabold mt-2">{{ totals.elevation }} <span class="text-base font-medium opacity-80">m</span></p>
              </div>
              <div class="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/20 p-5 text-white">
                <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Temps total</p>
                <p class="text-3xl font-extrabold mt-2">{{ totals.duration }}</p>
              </div>
              <div class="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg shadow-orange-500/20 p-5 text-white">
                <p class="text-xs uppercase tracking-wider opacity-80 font-semibold">Activités</p>
                <p class="text-3xl font-extrabold mt-2">{{ totals.count }}</p>
                <p class="text-xs opacity-70 mt-1">depuis {{ totals.since }}</p>
              </div>
            </div>
          </div>
        }

        <!-- Records personnels -->
        @if (records().length > 0) {
          <div class="mt-8">
            <h2 class="text-xl font-bold text-slate-800 tracking-tight mb-4">Records personnels</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (rec of records(); track rec.label) {
                <a [routerLink]="['/activities', rec.activityId]" [queryParams]="{ from: 'progression' }"
                   [title]="rec.tooltip ?? ''"
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

  /** Totaux carrière */
  protected readonly careerTotals = computed(() => {
    const all = this.strava.activities();
    if (all.length === 0) return null;

    const totalDist = all.reduce((s, a) => s + a.distance, 0);
    const totalElev = all.reduce((s, a) => s + a.total_elevation_gain, 0);
    const totalTime = all.reduce((s, a) => s + a.moving_time, 0);
    const oldest = all[all.length - 1];
    const since = new Date(oldest.start_date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    return {
      distanceKm: Math.round(totalDist / 1000).toLocaleString('fr-FR'),
      elevation: Math.round(totalElev).toLocaleString('fr-FR'),
      duration: secondsToHoursMin(totalTime),
      count: all.length,
      since
    };
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
        icon: '🏃',
        tooltip: 'Course ou trail avec la plus grande distance parcourue'
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
          icon: '⚡',
          tooltip: 'Meilleure allure moyenne sur une course de 5 km ou plus (estimation basée sur la vitesse moyenne)'
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
          icon: '🔥',
          tooltip: 'Meilleure allure moyenne sur une course de 10 km ou plus (estimation basée sur la vitesse moyenne)'
        });
      }

      // Meilleur semi-marathon (estimé)
      const runsSemi = runs.filter(a => a.distance >= 21097);
      if (runsSemi.length > 0) {
        const bestSemi = runsSemi.reduce((prev, curr) => curr.average_speed > prev.average_speed ? curr : prev);
        const pace = Math.round(1000 / bestSemi.average_speed);
        records.push({
          label: 'Meilleur semi (estimé)',
          value: `${Math.floor(pace / 60)}:${(pace % 60).toString().padStart(2, '0')} /km`,
          activityName: bestSemi.name,
          activityId: bestSemi.id,
          date: fmt(bestSemi.start_date),
          icon: '🏅',
          tooltip: 'Meilleure allure moyenne sur une course de 21.1 km ou plus (estimation basée sur la vitesse moyenne)'
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
        icon: '🚴',
        tooltip: 'Sortie vélo (route ou virtuel) avec la plus grande distance'
      });

      // Vitesse max vélo
      const fastestRide = rides.reduce((prev, curr) => curr.max_speed > prev.max_speed ? curr : prev);
      if (fastestRide.max_speed > 0) {
        records.push({
          label: 'Vitesse max vélo',
          value: `${(fastestRide.max_speed * 3.6).toFixed(1)} km/h`,
          activityName: fastestRide.name,
          activityId: fastestRide.id,
          date: fmt(fastestRide.start_date),
          icon: '💨',
          tooltip: 'Vitesse maximale instantanée atteinte lors d\'une sortie vélo'
        });
      }
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
        icon: '⛰️',
        tooltip: 'Activité avec le plus grand dénivelé positif cumulé (tous types confondus)'
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
      icon: '⏱️',
      tooltip: 'Activité avec le plus long temps en mouvement (tous types confondus)'
    });

    // FC max atteinte
    const withHr = all.filter(a => a.max_heartrate && a.max_heartrate > 0);
    if (withHr.length > 0) {
      const bestHr = withHr.reduce((prev, curr) => (curr.max_heartrate ?? 0) > (prev.max_heartrate ?? 0) ? curr : prev);
      records.push({
        label: 'FC max atteinte',
        value: `${bestHr.max_heartrate} bpm`,
        activityName: bestHr.name,
        activityId: bestHr.id,
        date: fmt(bestHr.start_date),
        icon: '❤️',
        tooltip: 'Fréquence cardiaque maximale enregistrée sur une activité (nécessite un capteur cardio)'
      });
    }

    // Plus gros volume hebdo
    const weekMap = new Map<string, { dist: number; act: typeof all[0] }>();
    for (const act of all) {
      const d = new Date(act.start_date);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
      const key = `${monday.getFullYear()}-${(monday.getMonth() + 1).toString().padStart(2, '0')}-${monday.getDate().toString().padStart(2, '0')}`;
      const curr = weekMap.get(key);
      const newDist = (curr?.dist ?? 0) + act.distance;
      weekMap.set(key, { dist: newDist, act: curr && curr.dist >= newDist ? curr.act : act });
    }
    let bestWeekKey = '';
    let bestWeekDist = 0;
    for (const [key, val] of weekMap) {
      if (val.dist > bestWeekDist) { bestWeekDist = val.dist; bestWeekKey = key; }
    }
    if (bestWeekDist > 0) {
      const bw = weekMap.get(bestWeekKey)!;
      const mondayDate = new Date(bestWeekKey);
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(sundayDate.getDate() + 6);
      const fmtShort = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      records.push({
        label: 'Meilleur volume hebdo',
        value: `${(bestWeekDist / 1000).toFixed(1)} km`,
        activityName: `Semaine du ${fmtShort(mondayDate)}`,
        activityId: bw.act.id,
        date: `${fmtShort(mondayDate)} - ${fmtShort(sundayDate)}`,
        icon: '📊',
        tooltip: 'Semaine (lundi-dimanche) avec le plus de kilomètres cumulés toutes activités confondues'
      });
    }

    // Streak le plus long (jours consécutifs)
    const dateSet = new Set<string>();
    for (const act of all) {
      const d = new Date(act.start_date);
      dateSet.add(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    }
    const sortedDates = [...dateSet].sort();
    let maxStreak = 1, currentStreak = 1, streakEndIdx = 0;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          streakEndIdx = i;
        }
      } else {
        currentStreak = 1;
      }
    }
    if (maxStreak >= 2) {
      const streakEnd = sortedDates[streakEndIdx];
      const streakStart = sortedDates[streakEndIdx - maxStreak + 1];
      const startAct = all.find(a => {
        const d = new Date(a.start_date);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}` === streakStart;
      });
      records.push({
        label: 'Plus long streak',
        value: `${maxStreak} jours`,
        activityName: `${new Date(streakStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${new Date(streakEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
        activityId: startAct?.id ?? all[0].id,
        date: `${maxStreak} jours consécutifs`,
        icon: '🔥',
        tooltip: 'Plus grand nombre de jours consécutifs avec au moins une activité enregistrée'
      });
    }

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
