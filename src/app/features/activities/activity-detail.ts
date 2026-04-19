import {
  Component,
  inject,
  signal,
  computed,
  afterNextRender,
  viewChild,
  ElementRef,
  effect,
  input
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { StravaService } from '../../core/services/strava.service';
import { ActivityDetail as ActivityDetailModel, Lap, ActivityStream, BestEffort, Kudoer, ActivityPhoto } from '../../core/models/strava.models';
import {
  metersToKm,
  secondsToHoursMin,
  formatDateFr,
  speedToPace,
  speedToKmh,
  activityIcon,
  activityColor
} from '../../core/utils/format';
import { decodePolyline, toGeoJsonCoords } from '../../core/utils/polyline';
import maplibregl from 'maplibre-gl';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

/**
 * Page détail d'une activité
 * Affiche les statistiques, la carte du tracé GPS et les splits
 */
@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- Chargement -->
      @if (loading()) {
        <div class="text-center py-16">
          <div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
          <p class="mt-3 text-slate-400 font-medium">Chargement de l'activité...</p>
        </div>
      }

      @if (activity(); as act) {
        <!-- En-tête -->
        <div class="mb-8">
          <div class="flex items-center gap-4 mb-3">
            <span class="text-3xl w-14 h-14 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200/60">{{ getIcon(act.type) }}</span>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-3xl font-bold text-slate-800 tracking-tight">{{ act.name }}</h1>
                <span class="text-sm font-semibold px-3 py-1 rounded-full text-white shadow-sm"
                      [style.background-color]="getColor(act.type)">
                  {{ act.type }}
                </span>
              </div>
              <div class="flex items-center gap-3 mt-1">
                <p class="text-slate-400">{{ formatDate(act.start_date) }}</p>
                @if (act.kudos_count) {
                  <span class="flex items-center gap-1 text-orange-500 font-semibold text-sm">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    {{ act.kudos_count }}
                  </span>
                }
                @if (act.comment_count) {
                  <span class="flex items-center gap-1 text-slate-400 font-semibold text-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    {{ act.comment_count }}
                  </span>
                }
              </div>
            </div>
          </div>
          <!-- Kudoers -->
          @if (kudoers().length > 0) {
            <div class="flex items-center gap-2 mt-3 pl-18 flex-wrap">
              <span class="inline-flex items-center bg-orange-50 text-orange-500 rounded-full px-2.5 py-1 text-xs font-bold border border-orange-200/60">
                {{ kudoers().length }} kudos
              </span>
              @for (k of kudoers(); track $index) {
                <span class="inline-flex items-center bg-orange-50 text-orange-600 rounded-full px-2.5 py-1 text-xs font-semibold border border-orange-200/60">
                  {{ k.firstname }} {{ k.lastname }}
                </span>
              }
            </div>
          }
          @if (act.description) {
            <p class="text-slate-500 mt-2 pl-18">{{ act.description }}</p>
          }
        </div>

        <!-- Photos -->
        @if (photos().length > 0) {
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
            <h2 class="text-base font-semibold text-slate-700 mb-4">Photos ({{ photos().length }})</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              @for (p of photos(); track p.unique_id; let i = $index) {
                <button
                  (click)="openLightbox(i)"
                  class="aspect-square rounded-xl overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <img [src]="getPhotoUrl(p)" [alt]="p.caption || 'Photo activité'" class="w-full h-full object-cover" loading="lazy" />
                </button>
              }
            </div>
          </div>
        }

        <!-- Lightbox -->
        @if (lightboxIndex() !== null) {
          <div
            (click)="closeLightbox()"
            class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <button
              (click)="closeLightbox(); $event.stopPropagation()"
              class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
              ×
            </button>
            @if (photos().length > 1) {
              <button
                (click)="lightboxNav(-1); $event.stopPropagation()"
                class="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
                ‹
              </button>
              <button
                (click)="lightboxNav(1); $event.stopPropagation()"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
                ›
              </button>
            }
            <img
              [src]="getPhotoUrl(photos()[lightboxIndex()!])"
              [alt]="photos()[lightboxIndex()!].caption || ''"
              (click)="$event.stopPropagation()"
              class="max-w-full max-h-full object-contain rounded-lg" />
            @if (photos()[lightboxIndex()!].caption) {
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-lg max-w-2xl text-center">
                {{ photos()[lightboxIndex()!].caption }}
              </div>
            }
          </div>
        }

        <!-- Statistiques principales -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5 text-center hover:shadow-md transition-shadow">
            <p class="text-3xl font-extrabold text-slate-800">{{ formatDistance(act.distance) }}</p>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Distance</p>
          </div>
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5 text-center hover:shadow-md transition-shadow">
            <p class="text-3xl font-extrabold text-slate-800">{{ formatDuration(act.moving_time) }}</p>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Durée</p>
          </div>
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5 text-center hover:shadow-md transition-shadow">
            <p class="text-3xl font-extrabold text-slate-800">{{ formatSpeed(act) }}</p>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{{ isRunning() ? 'Allure moy.' : 'Vitesse moy.' }}</p>
          </div>
          <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5 text-center hover:shadow-md transition-shadow">
            <p class="text-3xl font-extrabold text-slate-800">{{ formatMaxSpeed(act) }}</p>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{{ isRunning() ? 'Allure max.' : 'Vitesse max.' }}</p>
          </div>
        </div>

        <!-- Statistiques secondaires -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          @if (act.average_heartrate) {
            <div class="bg-gradient-to-br from-rose-500 to-red-500 rounded-2xl shadow-lg shadow-rose-500/20 p-5 text-center text-white">
              <p class="text-3xl font-extrabold">{{ act.average_heartrate | number:'1.0-0' }}</p>
              <p class="text-xs font-semibold uppercase tracking-wider mt-1 opacity-80">FC moy.</p>
              @if (act.max_heartrate) {
                <p class="text-sm font-bold mt-1 opacity-70">max {{ act.max_heartrate | number:'1.0-0' }}</p>
              }
            </div>
          }
          @if (act.average_cadence) {
            <div class="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/20 p-5 text-center text-white">
              <p class="text-3xl font-extrabold">{{ isRunning() ? (act.average_cadence * 2 | number:'1.0-0') : (act.average_cadence | number:'1.0-0') }}</p>
              <p class="text-xs font-semibold uppercase tracking-wider mt-1 opacity-80">{{ isRunning() ? 'Cadence (ppm)' : 'Cadence (rpm)' }}</p>
            </div>
          }
          <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20 p-5 text-center text-white">
            <p class="text-3xl font-extrabold">{{ act.total_elevation_gain | number:'1.0-0' }} m</p>
            <p class="text-xs font-semibold uppercase tracking-wider mt-1 opacity-80">Dénivelé D+</p>
            @if (act.elev_high != null && act.elev_low != null) {
              <p class="text-sm font-bold mt-1 opacity-70">{{ act.elev_low | number:'1.0-0' }} - {{ act.elev_high | number:'1.0-0' }} m</p>
            }
          </div>
          @if (act.calories) {
            <div class="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl shadow-lg shadow-orange-500/20 p-5 text-center text-white">
              <p class="text-3xl font-extrabold">{{ act.calories | number:'1.0-0' }}</p>
              <p class="text-xs font-semibold uppercase tracking-wider mt-1 opacity-80">Calories</p>
            </div>
          }
        </div>

        <!-- Carte du tracé -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <h2 class="text-base font-semibold text-slate-700 p-5 pb-0">Tracé GPS</h2>
          <div #mapContainer class="h-[500px] w-full mt-3"></div>
        </div>

        <!-- Graphique d'analyse (altitude + overlays) -->
        @if (streamsLoading()) {
          <div class="mt-6 text-center py-8">
            <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
            <p class="mt-2 text-slate-400 text-sm font-medium">Chargement de l'analyse...</p>
          </div>
        }

        @if (streams().length > 0) {
          <div class="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 class="text-base font-semibold text-slate-700">Analyse</h2>
              <div class="flex gap-2">
                @if (hasStream('heartrate')) {
                  <button (click)="showHeartrate.set(!showHeartrate())"
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          [class]="showHeartrate()
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">
                    FC
                  </button>
                }
                <button (click)="showPace.set(!showPace())"
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        [class]="showPace()
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">
                  {{ isRunning() ? 'Allure' : 'Vitesse' }}
                </button>
                @if (hasStream('cadence')) {
                  <button (click)="showCadence.set(!showCadence())"
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          [class]="showCadence()
                            ? 'bg-violet-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">
                    Cadence
                  </button>
                }
              </div>
            </div>
            <canvas #analysisChart></canvas>
          </div>
        }

        <!-- Zones de fréquence cardiaque -->
        @if (hrZones(); as zones) {
          <div class="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h2 class="text-base font-semibold text-slate-700 mb-4">Zones de fréquence cardiaque</h2>
            <div class="flex justify-center mb-6">
              <div class="w-64 h-64">
                <canvas #hrZonesChart></canvas>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              @for (zone of zones; track zone.name) {
                <div class="rounded-xl border border-slate-200/60 p-3 text-center"
                     [style.border-left]="'4px solid ' + zone.color">
                  <p class="text-xs font-semibold uppercase tracking-wider" [style.color]="zone.color">{{ zone.name }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">{{ zone.label }}</p>
                  <p class="text-xs text-slate-500 mt-0.5">{{ zone.minHr }} - {{ zone.maxHr }} bpm</p>
                  <p class="text-lg font-extrabold text-slate-800 mt-1">{{ zone.percentage }}%</p>
                  <p class="text-xs text-slate-400">{{ zone.timeFormatted }}</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- Splits / Laps -->
        @if (lapsLoading()) {
          <div class="mt-6 text-center py-8">
            <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
            <p class="mt-2 text-slate-400 text-sm font-medium">Chargement des splits...</p>
          </div>
        }

        @if (laps().length > 1) {
          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Graphique splits -->
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h2 class="text-base font-semibold text-slate-700 mb-4">
                {{ isRunning() ? 'Allure par split' : 'Vitesse par split' }}
              </h2>
              <canvas #splitsChart></canvas>
            </div>

            <!-- Tableau splits -->
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 overflow-auto">
              <h2 class="text-base font-semibold text-slate-700 mb-4">Détails des splits</h2>
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-slate-200">
                    <th class="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Split</th>
                    <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dist.</th>
                    <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {{ isRunning() ? 'Allure' : 'Vitesse' }}
                    </th>
                    <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">D+</th>
                    <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Durée</th>
                    @if (laps()[0].average_heartrate) {
                      <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">FC</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (lap of laps(); track lap.lap_index; let i = $index) {
                    <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td class="py-2.5 px-2 font-semibold text-slate-700">{{ i + 1 }}</td>
                      <td class="py-2.5 px-2 text-right text-slate-600">{{ formatLapDistance(lap.distance) }} km</td>
                      <td class="py-2.5 px-2 text-right font-semibold text-slate-800">
                        {{ formatLapPace(lap) }}
                      </td>
                      <td class="py-2.5 px-2 text-right text-slate-600">{{ lap.total_elevation_gain | number:'1.0-0' }} m</td>
                      <td class="py-2.5 px-2 text-right text-slate-600">{{ formatDuration(lap.moving_time) }}</td>
                      @if (laps()[0].average_heartrate) {
                        <td class="py-2.5 px-2 text-right text-slate-600">{{ lap.average_heartrate | number:'1.0-0' }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Best Efforts -->
        @if (act.best_efforts && metricEfforts(act.best_efforts).length > 0) {
          <div class="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h2 class="text-base font-semibold text-slate-700 mb-4">Meilleurs efforts</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              @for (effort of metricEfforts(act.best_efforts); track effort.id) {
                <div class="relative rounded-xl border border-slate-200/60 p-4 text-center"
                     [class]="effort.pr_rank === 1 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50'">
                  @if (effort.pr_rank === 1) {
                    <span class="absolute top-2 right-2 text-amber-500 text-xs font-bold">PR</span>
                  }
                  @if (effort.pr_rank === 2) {
                    <span class="absolute top-2 right-2 text-slate-400 text-xs font-bold">2e</span>
                  }
                  @if (effort.pr_rank === 3) {
                    <span class="absolute top-2 right-2 text-amber-700 text-xs font-bold">3e</span>
                  }
                  <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ effort.name }}</p>
                  <p class="text-xl font-extrabold mt-1" [class]="effort.pr_rank === 1 ? 'text-amber-600' : 'text-slate-800'">
                    {{ formatEffortTime(effort.moving_time) }}
                  </p>
                </div>
              }
            </div>
          </div>
        }

        <!-- Segments -->
        @if (act.segment_efforts && act.segment_efforts.length > 0) {
          <div class="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 overflow-auto">
            <h2 class="text-base font-semibold text-slate-700 mb-4">Segments ({{ act.segment_efforts.length }})</h2>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-200">
                  <th class="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Segment</th>
                  <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dist.</th>
                  <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Temps</th>
                  <th class="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Pente</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cat.</th>
                  <th class="text-center py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">PR</th>
                </tr>
              </thead>
              <tbody>
                @for (seg of act.segment_efforts; track seg.id) {
                  <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td class="py-2.5 px-2 font-semibold text-slate-700 max-w-[200px] truncate">{{ seg.name }}</td>
                    <td class="py-2.5 px-2 text-right text-slate-600">{{ formatLapDistance(seg.distance) }} km</td>
                    <td class="py-2.5 px-2 text-right font-semibold text-slate-800">{{ formatEffortTime(seg.moving_time) }}</td>
                    <td class="py-2.5 px-2 text-right text-slate-600">{{ seg.segment.average_grade | number:'1.1-1' }}%</td>
                    <td class="py-2.5 px-2 text-center">
                      @if (seg.segment.climb_category > 0) {
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                              [class]="seg.segment.climb_category >= 4 ? 'bg-red-100 text-red-600' : seg.segment.climb_category >= 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'">
                          {{ seg.segment.climb_category === 5 ? 'HC' : 'Cat ' + seg.segment.climb_category }}
                        </span>
                      }
                    </td>
                    <td class="py-2.5 px-2 text-center">
                      @if (seg.pr_rank === 1) {
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">PR</span>
                      }
                      @if (seg.pr_rank === 2) {
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">2e</span>
                      }
                      @if (seg.pr_rank === 3) {
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">3e</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- Bouton retour -->
      <div class="mt-8">
        <a [routerLink]="backRoute()"
           class="inline-flex items-center gap-2 text-strava hover:text-strava-dark font-semibold transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          {{ backLabel() }}
        </a>
      </div>
    </div>
  `
})
export class ActivityDetailComponent {
  private readonly strava = inject(StravaService);
  private readonly route = inject(ActivatedRoute);

  /** ID de l'activité depuis le paramètre de route */
  readonly id = input.required<string>();

  /** D'où vient l'utilisateur (pour le bouton retour) */
  protected readonly fromPage = signal<string | null>(null);

  protected readonly backRoute = computed(() => {
    const from = this.fromPage();
    if (from === 'map') return '/map';
    if (from === 'progression') return '/progression';
    return '/activities';
  });

  protected readonly backLabel = computed(() => {
    const from = this.fromPage();
    if (from === 'map') return 'Retour à la carte';
    if (from === 'progression') return 'Retour à la progression';
    return 'Retour aux activités';
  });

  /** Signal : données de l'activité */
  protected readonly activity = signal<ActivityDetailModel | null>(null);
  protected readonly loading = signal(false);

  /** Signal : laps de l'activité */
  protected readonly laps = signal<Lap[]>([]);
  protected readonly lapsLoading = signal(false);

  /** Signal : streams de l'activité */
  protected readonly streams = signal<ActivityStream[]>([]);
  protected readonly streamsLoading = signal(false);

  /** Signal : kudoers de l'activité */
  protected readonly kudoers = signal<Kudoer[]>([]);

  /** Signal : photos de l'activité */
  protected readonly photos = signal<ActivityPhoto[]>([]);

  /** Signal : index de la photo affichée en lightbox (null = fermée) */
  protected readonly lightboxIndex = signal<number | null>(null);

  /** Toggles pour les courbes d'analyse */
  protected readonly showHeartrate = signal(false);
  protected readonly showPace = signal(false);
  protected readonly showCadence = signal(false);

  /** Est-ce une activité de course ? */
  protected readonly isRunning = computed(() => {
    const type = this.activity()?.type;
    return type === 'Run' || type === 'TrailRun';
  });

  /** Référence vers le conteneur de la carte */
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');

  /** Référence canvas pour le graphique des splits */
  private readonly splitsCanvas = viewChild<ElementRef<HTMLCanvasElement>>('splitsChart');

  /** Référence canvas pour le graphique d'analyse */
  private readonly analysisCanvas = viewChild<ElementRef<HTMLCanvasElement>>('analysisChart');

  /** Référence canvas pour le graphique des zones FC */
  private readonly hrZonesCanvas = viewChild<ElementRef<HTMLCanvasElement>>('hrZonesChart');

  /** Instances */
  private map: maplibregl.Map | null = null;
  private splitsChart: Chart | null = null;
  private analysisChart: Chart | null = null;
  private hrZonesChart: Chart | null = null;

  /** Données pour le graphique des splits */
  private readonly splitsData = computed(() => {
    const lapsList = this.laps();
    const running = this.isRunning();
    if (lapsList.length <= 1) return null;

    const labels = lapsList.map((_, i) => `${i + 1}`);
    const paces = lapsList.map(lap => {
      if (running) {
        return lap.average_speed > 0 ? (1000 / lap.average_speed / 60) : 0;
      }
      return lap.average_speed * 3.6;
    });

    const avgPace = paces.reduce((s, v) => s + v, 0) / paces.length;

    const colors = paces.map(p => {
      if (running) {
        return p <= avgPace ? '#22c55e99' : '#ef444499';
      }
      return p >= avgPace ? '#22c55e99' : '#ef444499';
    });

    return { labels, paces, colors, avgPace, isRunning: running };
  });

  /** Zones de fréquence cardiaque calculées depuis le stream heartrate */
  protected readonly hrZones = computed(() => {
    const act = this.activity();
    const streamData = this.streams();
    if (!act || streamData.length === 0) return null;

    const hrStream = streamData.find(s => s.type === 'heartrate');
    if (!hrStream || hrStream.data.length === 0) return null;

    const maxHr = act.max_heartrate ?? 190;
    const timeStream = streamData.find(s => s.type === 'time');

    const zoneDefs = [
      { name: 'Zone 1', label: 'Récupération', pctMin: 0.50, pctMax: 0.60, color: '#3b82f6' },
      { name: 'Zone 2', label: 'Endurance', pctMin: 0.60, pctMax: 0.70, color: '#22c55e' },
      { name: 'Zone 3', label: 'Tempo', pctMin: 0.70, pctMax: 0.80, color: '#eab308' },
      { name: 'Zone 4', label: 'Threshold', pctMin: 0.80, pctMax: 0.90, color: '#f97316' },
      { name: 'Zone 5', label: 'VO2max', pctMin: 0.90, pctMax: 1.00, color: '#ef4444' },
    ];

    const zoneSeconds = [0, 0, 0, 0, 0];
    const hrData = hrStream.data;
    const timeData = timeStream?.data;

    for (let i = 0; i < hrData.length; i++) {
      const hr = hrData[i];
      const pct = hr / maxHr;
      let zoneIdx = 0;
      if (pct >= 0.90) zoneIdx = 4;
      else if (pct >= 0.80) zoneIdx = 3;
      else if (pct >= 0.70) zoneIdx = 2;
      else if (pct >= 0.60) zoneIdx = 1;
      else zoneIdx = 0;

      // Temps écoulé depuis le point précédent
      let dt: number;
      if (timeData && i > 0) {
        dt = timeData[i] - timeData[i - 1];
      } else if (timeData && i === 0) {
        dt = 0;
      } else {
        dt = 1; // estimation : 1 seconde par échantillon
      }
      zoneSeconds[zoneIdx] += dt;
    }

    const totalSeconds = zoneSeconds.reduce((a, b) => a + b, 0);
    if (totalSeconds === 0) return null;

    return zoneDefs.map((def, i) => {
      const secs = zoneSeconds[i];
      const percentage = Math.round((secs / totalSeconds) * 100);
      return {
        name: def.name,
        label: def.label,
        color: def.color,
        minHr: Math.round(maxHr * def.pctMin),
        maxHr: Math.round(maxHr * def.pctMax),
        seconds: secs,
        percentage,
        timeFormatted: this.formatZoneTime(secs),
      };
    });
  });

  constructor() {
    this.fromPage.set(this.route.snapshot.queryParamMap.get('from'));

    afterNextRender(() => {
      this.loadActivity();
    });

    // Initialiser la carte quand les données et le conteneur sont prêts
    effect(() => {
      const act = this.activity();
      const container = this.mapContainer();
      if (act && container) {
        this.initMap(container.nativeElement, act);
      }
    });

    // Rendre le graphique des splits
    effect(() => {
      const canvas = this.splitsCanvas();
      const data = this.splitsData();
      if (canvas && data) {
        this.renderSplitsChart(canvas, data);
      }
    });

    // Rendre le graphique des zones FC (doughnut)
    effect(() => {
      const canvas = this.hrZonesCanvas();
      const zones = this.hrZones();
      if (canvas && zones) {
        this.renderHrZonesChart(canvas, zones);
      }
    });

    // Rendre le graphique d'analyse (altitude + overlays)
    effect(() => {
      const canvas = this.analysisCanvas();
      const streamData = this.streams();
      // Lire les toggles pour que l'effect se re-déclenche
      const hr = this.showHeartrate();
      const pace = this.showPace();
      const cadence = this.showCadence();
      const running = this.isRunning();
      if (canvas && streamData.length > 0) {
        this.renderAnalysisChart(canvas, streamData, { hr, pace, cadence, running });
      }
    });
  }

  /**
   * Charger le détail de l'activité et ses laps
   */
  private async loadActivity(): Promise<void> {
    this.loading.set(true);
    const detail = await this.strava.getActivityDetail(Number(this.id()));
    this.activity.set(detail);
    this.loading.set(false);

    if (detail) {
      this.lapsLoading.set(true);
      this.streamsLoading.set(true);

      const [laps, streams, kudoers, photos] = await Promise.all([
        this.strava.getActivityLaps(detail.id),
        this.strava.getActivityStreams(detail.id),
        detail.kudos_count ? this.strava.getActivityKudos(detail.id) : Promise.resolve([]),
        this.strava.getActivityPhotos(detail.id)
      ]);

      this.laps.set(laps);
      this.lapsLoading.set(false);
      this.streams.set(streams);
      this.streamsLoading.set(false);
      this.kudoers.set(kudoers);
      this.photos.set(photos);
    }
  }

  /** Retourne l'URL de la plus grande taille disponible pour une photo */
  protected getPhotoUrl(photo: ActivityPhoto): string {
    const urls = photo.urls ?? {};
    const sizes = Object.keys(urls).map(Number).filter(n => !isNaN(n));
    if (sizes.length === 0) return '';
    const largest = Math.max(...sizes);
    return urls[String(largest)];
  }

  /** Ouvre la lightbox sur une photo donnée */
  protected openLightbox(index: number): void {
    this.lightboxIndex.set(index);
  }

  /** Ferme la lightbox */
  protected closeLightbox(): void {
    this.lightboxIndex.set(null);
  }

  /** Navigation photo suivante/précédente dans la lightbox */
  protected lightboxNav(delta: number): void {
    const current = this.lightboxIndex();
    if (current === null) return;
    const count = this.photos().length;
    this.lightboxIndex.set((current + delta + count) % count);
  }

  /**
   * Initialiser la carte MapLibre avec le tracé de l'activité
   */
  private initMap(container: HTMLElement, activity: ActivityDetailModel): void {
    if (this.map) {
      this.map.remove();
    }

    const polyline = activity.map.polyline || activity.map.summary_polyline;
    if (!polyline) return;

    const coords = toGeoJsonCoords(decodePolyline(polyline));
    if (coords.length === 0) return;

    this.map = new maplibregl.Map({
      container,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: coords[0],
      zoom: 13
    });

    this.map.on('load', () => {
      this.map!.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        }
      });

      this.map!.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': activityColor(activity.type),
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      const bounds = coords.reduce(
        (b, coord) => b.extend(coord as maplibregl.LngLatLike),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      this.map!.fitBounds(bounds, { padding: 50 });
    });
  }

  /**
   * Rendre le graphique en barres des splits
   */
  private renderSplitsChart(
    canvasRef: ElementRef<HTMLCanvasElement>,
    data: { labels: string[]; paces: number[]; colors: string[]; avgPace: number; isRunning: boolean }
  ): void {
    if (this.splitsChart) this.splitsChart.destroy();

    const unit = data.isRunning ? 'min/km' : 'km/h';

    this.splitsChart = new Chart(canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: unit,
          data: data.paces.map(v => Math.round(v * 100) / 100),
          backgroundColor: data.colors,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#1e293b',
            bodyColor: '#334155',
            borderColor: '#000000',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const val = item.parsed.y ?? 0;
                if (data.isRunning) {
                  const min = Math.floor(val);
                  const sec = Math.round((val - min) * 60);
                  return ` ${min}'${sec.toString().padStart(2, '0')}" /km`;
                }
                return ` ${val.toFixed(1)} km/h`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            reverse: data.isRunning,
            title: { display: true, text: unit, color: '#94a3b8' },
            grid: { color: '#f1f5f9' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            title: { display: true, text: 'Split', color: '#94a3b8' },
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  }

  // Méthodes de formatage
  protected formatDistance(meters: number): string { return metersToKm(meters); }
  protected formatDuration(seconds: number): string { return secondsToHoursMin(seconds); }
  protected formatDate(iso: string): string { return formatDateFr(iso); }
  protected getIcon(type: string): string { return activityIcon(type); }
  protected getColor(type: string): string { return activityColor(type); }
  protected formatLapDistance(meters: number): string { return (meters / 1000).toFixed(2); }
  protected metricEfforts(efforts: BestEffort[]): BestEffort[] {
    return efforts.filter(e => !e.name.toLowerCase().includes('mile'));
  }

  protected formatEffortTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  protected formatLapPace(lap: Lap): string {
    if (this.isRunning()) {
      return speedToPace(lap.average_speed);
    }
    return speedToKmh(lap.average_speed) + ' km/h';
  }

  protected formatSpeed(activity: ActivityDetailModel): string {
    if (activity.type === 'Run' || activity.type === 'TrailRun') {
      return speedToPace(activity.average_speed);
    }
    return speedToKmh(activity.average_speed) + ' km/h';
  }

  protected formatMaxSpeed(activity: ActivityDetailModel): string {
    if (activity.type === 'Run' || activity.type === 'TrailRun') {
      return speedToPace(activity.max_speed);
    }
    return speedToKmh(activity.max_speed) + ' km/h';
  }

  /** Vérifie si un stream est disponible */
  protected hasStream(type: string): boolean {
    return this.streams().some(s => s.type === type);
  }

  /** Helper pour extraire les données d'un stream */
  private getStreamData(type: string): number[] {
    return this.streams().find(s => s.type === type)?.data ?? [];
  }

  /** Moyenne glissante pour lisser les courbes (ignore les NaN) */
  private smooth(arr: number[], window = 10): number[] {
    const half = Math.floor(window / 2);
    return arr.map((_, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(arr.length, i + half + 1);
      let sum = 0, count = 0;
      for (let j = start; j < end; j++) {
        if (!isNaN(arr[j])) { sum += arr[j]; count++; }
      }
      return count > 0 ? sum / count : NaN;
    });
  }

  /** Calcule min/max d'un tableau en ignorant les NaN */
  private dataRange(arr: number[]): { min: number; max: number; range: number } {
    let min = Infinity, max = -Infinity;
    for (const v of arr) {
      if (!isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min || 1;
    return { min, max, range };
  }

  /** Rendre le graphique d'analyse (altitude + overlays FC/allure/cadence) */
  private renderAnalysisChart(
    canvasRef: ElementRef<HTMLCanvasElement>,
    _streams: ActivityStream[],
    opts: { hr: boolean; pace: boolean; cadence: boolean; running: boolean }
  ): void {
    if (this.analysisChart) this.analysisChart.destroy();

    const distRaw = this.getStreamData('distance');
    const altRaw = this.getStreamData('altitude');
    if (distRaw.length === 0 || altRaw.length === 0) return;

    // Sous-échantillonnage (cible ~500 points)
    const step = Math.max(1, Math.floor(distRaw.length / 500));
    const sample = <T>(arr: T[]): T[] => arr.filter((_, i) => i % step === 0);

    const distKm = sample(distRaw).map(d => d / 1000);
    const altitudeData = sample(altRaw);

    // Plage altitude
    const altMin = Math.min(...altitudeData);
    const altMax = Math.max(...altitudeData);
    const altRange = altMax - altMin || 1;

    const datasets: any[] = [];

    // Altitude (area remplie en fond)
    datasets.push({
      label: 'Altitude (m)',
      data: distKm.map((x, i) => ({ x, y: altitudeData[i] })),
      borderColor: 'rgba(148, 163, 184, 0.6)',
      backgroundColor: 'rgba(148, 163, 184, 0.3)',
      fill: 'origin',
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 1.5,
      yAxisID: 'yAlt',
      order: 10
    });

    // Scales (altitude à gauche, overlays cachés avec bandes)
    const scales: any = {
      x: {
        type: 'linear',
        display: true,
        title: { display: false },
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          maxTicksLimit: 15,
          callback: (value: any) => `${value} km`
        }
      },
      yAlt: {
        type: 'linear',
        position: 'left',
        suggestedMin: Math.floor(altMin - altRange * 0.1),
        suggestedMax: Math.ceil(altMax + altRange * 0.05),
        title: { display: false },
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#94a3b8',
          callback: (value: any) => `${Math.round(value)} m`
        }
      }
    };

    // FC — bande haute (60-100% du chart)
    if (opts.hr) {
      const hrRaw = sample(this.getStreamData('heartrate'));
      if (hrRaw.length > 0) {
        const hrSmoothed = this.smooth(hrRaw);
        const hr = this.dataRange(hrSmoothed);
        datasets.push({
          label: 'FC (bpm)',
          data: distKm.map((x, i) => ({ x, y: hrSmoothed[i] })),
          borderColor: '#ef4444',
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          yAxisID: 'yHr',
          order: 1
        });
        scales['yHr'] = {
          type: 'linear',
          display: false,
          min: hr.min - hr.range * 1.5,
          max: hr.max + hr.range * 0.1
        };
      }
    }

    // Allure / Vitesse — bande basse (0-40% du chart)
    if (opts.pace) {
      const velRaw = sample(this.getStreamData('velocity_smooth'));
      if (velRaw.length > 0) {
        // Filtrer les arrêts (< 1 m/s) puis convertir
        const paceRaw = velRaw.map(v => {
          if (v <= 1.0) return NaN;
          return opts.running ? Math.min(1000 / v / 60, 15) : v * 3.6;
        });
        const paceSmoothed = this.smooth(paceRaw);
        const pace = this.dataRange(paceSmoothed);
        datasets.push({
          label: opts.running ? 'Allure (min/km)' : 'Vitesse (km/h)',
          data: distKm.map((x, i) => ({ x, y: paceSmoothed[i] })),
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          yAxisID: 'yPace',
          spanGaps: true,
          order: 2
        });
        scales['yPace'] = {
          type: 'linear',
          display: false,
          reverse: opts.running,
          min: pace.min - pace.range * 0.1,
          max: pace.max + pace.range * 1.5
        };
      }
    }

    // Cadence — bande milieu (30-70% du chart)
    if (opts.cadence) {
      const cadRaw = sample(this.getStreamData('cadence'));
      if (cadRaw.length > 0) {
        // Filtrer cadence = 0 (pas de pédalage/pas), multiplier x2 pour course
        const cadFiltered = cadRaw.map(c => {
          if (c === 0) return NaN;
          return opts.running ? c * 2 : c;
        });
        const cadSmoothed = this.smooth(cadFiltered);
        const cad = this.dataRange(cadSmoothed);
        datasets.push({
          label: opts.running ? 'Cadence (ppm)' : 'Cadence (rpm)',
          data: distKm.map((x, i) => ({ x, y: cadSmoothed[i] })),
          borderColor: '#8b5cf6',
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          yAxisID: 'yCad',
          spanGaps: true,
          order: 3
        });
        scales['yCad'] = {
          type: 'linear',
          display: false,
          min: cad.min - cad.range * 0.8,
          max: cad.max + cad.range * 0.8
        };
      }
    }

    this.analysisChart = new Chart(canvasRef.nativeElement, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: false,
              boxWidth: 30,
              boxHeight: 2,
              color: '#64748b',
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#1e293b',
            bodyColor: '#334155',
            borderColor: '#000000',
            borderWidth: 1,
            titleFont: { weight: 'bold' },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title: (items) => {
                const x = items[0]?.parsed?.x;
                return x != null ? `${x.toFixed(1)} km` : '';
              },
              label: (item) => {
                const val = item.parsed.y;
                if (val == null || isNaN(val)) return '';
                if (item.dataset.yAxisID === 'yPace' && opts.running) {
                  const mins = Math.floor(val);
                  const secs = Math.round((val - mins) * 60);
                  return ` Allure : ${mins}:${secs.toString().padStart(2, '0')} /km`;
                }
                return ` ${item.dataset.label} : ${Math.round(val)}`;
              }
            }
          }
        },
        scales
      }
    });
  }

  /** Rendre le doughnut chart des zones FC */
  private renderHrZonesChart(
    canvasRef: ElementRef<HTMLCanvasElement>,
    zones: { name: string; label: string; color: string; seconds: number; percentage: number; timeFormatted: string }[]
  ): void {
    if (this.hrZonesChart) this.hrZonesChart.destroy();

    this.hrZonesChart = new Chart(canvasRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: zones.map(z => `${z.name} - ${z.label}`),
        datasets: [{
          data: zones.map(z => z.seconds),
          backgroundColor: zones.map(z => z.color),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '55%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#1e293b',
            bodyColor: '#334155',
            borderColor: '#000000',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const zone = zones[item.dataIndex];
                return ` ${zone.name} : ${zone.timeFormatted} (${zone.percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  /** Formate une durée en secondes en texte lisible */
  private formatZoneTime(seconds: number): string {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}min`;
    }
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m} min ${s} sec`;
  }
}
