import {
  Component,
  inject,
  signal,
  afterNextRender,
  viewChild,
  ElementRef,
  effect,
  input
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { StravaService } from '../../core/services/strava.service';
import { ActivityDetail as ActivityDetailModel } from '../../core/models/strava.models';
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

/**
 * Page détail d'une activité
 * Affiche les statistiques et la carte du tracé GPS via MapLibre
 */
@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <!-- Chargement -->
      @if (loading()) {
        <div class="text-center py-12">
          <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent"></div>
          <p class="mt-2 text-gray-500">Chargement de l'activité...</p>
        </div>
      }

      @if (activity(); as act) {
        <!-- En-tête -->
        <div class="mb-6">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-3xl">{{ getIcon(act.type) }}</span>
            <h1 class="text-3xl font-bold text-gray-800">{{ act.name }}</h1>
            <span class="text-sm px-3 py-1 rounded-full text-white"
                  [style.background-color]="getColor(act.type)">
              {{ act.type }}
            </span>
          </div>
          <p class="text-gray-500">{{ formatDate(act.start_date) }}</p>
          @if (act.description) {
            <p class="text-gray-600 mt-2">{{ act.description }}</p>
          }
        </div>

        <!-- Statistiques détaillées -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl shadow-md p-4 text-center">
            <p class="text-2xl font-bold text-gray-800">{{ formatDistance(act.distance) }}</p>
            <p class="text-sm text-gray-500">km</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-4 text-center">
            <p class="text-2xl font-bold text-gray-800">{{ formatDuration(act.moving_time) }}</p>
            <p class="text-sm text-gray-500">Durée</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-4 text-center">
            <p class="text-2xl font-bold text-gray-800">{{ act.total_elevation_gain | number:'1.0-0' }} m</p>
            <p class="text-sm text-gray-500">Dénivelé D+</p>
          </div>
          <div class="bg-white rounded-xl shadow-md p-4 text-center">
            <p class="text-2xl font-bold text-gray-800">{{ formatSpeed(act) }}</p>
            <p class="text-sm text-gray-500">{{ act.type === 'Run' || act.type === 'TrailRun' ? 'Allure' : 'Vitesse' }}</p>
          </div>
          @if (act.average_heartrate) {
            <div class="bg-white rounded-xl shadow-md p-4 text-center">
              <p class="text-2xl font-bold text-red-500">{{ act.average_heartrate | number:'1.0-0' }}</p>
              <p class="text-sm text-gray-500">FC moy. (bpm)</p>
            </div>
          }
          @if (act.calories) {
            <div class="bg-white rounded-xl shadow-md p-4 text-center">
              <p class="text-2xl font-bold text-orange-500">{{ act.calories | number:'1.0-0' }}</p>
              <p class="text-sm text-gray-500">Calories</p>
            </div>
          }
        </div>

        <!-- Carte du tracé -->
        <div class="bg-white rounded-xl shadow-md overflow-hidden">
          <h2 class="text-lg font-semibold text-gray-700 p-4 pb-0">Tracé GPS</h2>
          <div #mapContainer class="h-[500px] w-full"></div>
        </div>
      }

      <!-- Bouton retour -->
      <div class="mt-6">
        <a routerLink="/activities"
           class="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium">
          ← Retour aux activités
        </a>
      </div>
    </div>
  `
})
export class ActivityDetailComponent {
  private readonly strava = inject(StravaService);

  /** ID de l'activité depuis le paramètre de route */
  readonly id = input.required<string>();

  /** Signal : données de l'activité */
  protected readonly activity = signal<ActivityDetailModel | null>(null);
  protected readonly loading = signal(false);

  /** Référence vers le conteneur de la carte */
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');

  /** Instance MapLibre */
  private map: maplibregl.Map | null = null;

  constructor() {
    // Charger l'activité au démarrage
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
  }

  /**
   * Charger le détail de l'activité depuis l'API
   */
  private async loadActivity(): Promise<void> {
    this.loading.set(true);
    const detail = await this.strava.getActivityDetail(Number(this.id()));
    this.activity.set(detail);
    this.loading.set(false);
  }

  /**
   * Initialiser la carte MapLibre avec le tracé de l'activité
   */
  private initMap(container: HTMLElement, activity: ActivityDetailModel): void {
    // Nettoyer la carte précédente
    if (this.map) {
      this.map.remove();
    }

    // Décoder le tracé GPS (polyline encodée → coordonnées)
    const polyline = activity.map.polyline || activity.map.summary_polyline;
    if (!polyline) return;

    const coords = toGeoJsonCoords(decodePolyline(polyline));
    if (coords.length === 0) return;

    // Créer la carte centrée sur le premier point
    this.map = new maplibregl.Map({
      container,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: coords[0],
      zoom: 13
    });

    this.map.on('load', () => {
      // Ajouter le tracé comme source GeoJSON
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

      // Dessiner la ligne du tracé
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

      // Ajuster la vue pour contenir tout le tracé
      const bounds = coords.reduce(
        (b, coord) => b.extend(coord as maplibregl.LngLatLike),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      this.map!.fitBounds(bounds, { padding: 50 });
    });
  }

  // Méthodes de formatage
  protected formatDistance(meters: number): string { return metersToKm(meters); }
  protected formatDuration(seconds: number): string { return secondsToHoursMin(seconds); }
  protected formatDate(iso: string): string { return formatDateFr(iso); }
  protected getIcon(type: string): string { return activityIcon(type); }
  protected getColor(type: string): string { return activityColor(type); }

  /** Formater la vitesse selon le type (allure pour course, km/h pour vélo) */
  protected formatSpeed(activity: ActivityDetailModel): string {
    if (activity.type === 'Run' || activity.type === 'TrailRun') {
      return speedToPace(activity.average_speed);
    }
    return speedToKmh(activity.average_speed) + ' km/h';
  }
}
