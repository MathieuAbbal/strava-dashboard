import {
  Component,
  inject,
  afterNextRender,
  viewChild,
  ElementRef,
  effect
} from '@angular/core';
import { StravaService } from '../../core/services/strava.service';
import { ActivitySummary } from '../../core/models/strava.models';
import { decodePolyline, toGeoJsonCoords } from '../../core/utils/polyline';
import { activityColor } from '../../core/utils/format';
import maplibregl from 'maplibre-gl';

/**
 * Carte globale affichant toutes les activités superposées
 * Chaque tracé est coloré selon le type d'activité
 */
@Component({
  selector: 'app-global-map',
  standalone: true,
  template: `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-6">Carte des activités</h1>

      <!-- Légende des couleurs -->
      <div class="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap gap-4">
        <span class="text-sm text-gray-500 font-medium">Légende :</span>
        <span class="flex items-center gap-1 text-sm">
          <span class="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Course
        </span>
        <span class="flex items-center gap-1 text-sm">
          <span class="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Vélo
        </span>
        <span class="flex items-center gap-1 text-sm">
          <span class="w-3 h-3 rounded-full bg-cyan-500 inline-block"></span> Natation
        </span>
        <span class="flex items-center gap-1 text-sm">
          <span class="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Randonnée
        </span>
        <span class="flex items-center gap-1 text-sm">
          <span class="w-3 h-3 rounded-full bg-gray-500 inline-block"></span> Autre
        </span>
      </div>

      <!-- Chargement -->
      @if (strava.loading()) {
        <div class="text-center py-4">
          <div class="inline-block h-6 w-6 animate-spin rounded-full border-4 border-orange-500 border-r-transparent"></div>
          <span class="ml-2 text-gray-500">Chargement des activités...</span>
        </div>
      }

      <!-- Carte -->
      <div class="bg-white rounded-xl shadow-md overflow-hidden">
        <div #mapContainer class="h-[600px] w-full"></div>
      </div>

      <!-- Nombre d'activités affichées -->
      <p class="text-sm text-gray-400 mt-2 text-right">
        {{ strava.activitiesCount() }} activités affichées
      </p>
    </div>
  `
})
export class GlobalMap {
  protected readonly strava = inject(StravaService);

  /** Référence vers le conteneur de la carte */
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');

  /** Instance MapLibre */
  private map: maplibregl.Map | null = null;

  constructor() {
    // Charger toutes les activités au démarrage
    afterNextRender(() => {
      if (this.strava.activities().length === 0) {
        this.strava.loadActivities(1, 200);
      }
    });

    // Dessiner les tracés quand les données ou la carte sont prêtes
    effect(() => {
      const activities = this.strava.activities();
      const container = this.mapContainer();
      if (container && activities.length > 0) {
        this.initMap(container.nativeElement, activities);
      }
    });
  }

  /**
   * Initialiser la carte et afficher tous les tracés
   */
  private initMap(container: HTMLElement, activities: ActivitySummary[]): void {
    // Nettoyer la carte précédente
    if (this.map) {
      this.map.remove();
    }

    // Trouver le centre initial (première activité avec coordonnées)
    const firstWithCoords = activities.find(a => a.start_latlng);
    const center: [number, number] = firstWithCoords?.start_latlng
      ? [firstWithCoords.start_latlng[1], firstWithCoords.start_latlng[0]]
      : [2.3522, 48.8566]; // Paris par défaut

    this.map = new maplibregl.Map({
      container,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom: 10
    });

    this.map.on('load', () => {
      const bounds = new maplibregl.LngLatBounds();
      let hasCoords = false;

      // Ajouter chaque activité comme une ligne sur la carte
      activities.forEach((activity, index) => {
        const polyline = activity.map?.summary_polyline;
        if (!polyline) return;

        const coords = toGeoJsonCoords(decodePolyline(polyline));
        if (coords.length === 0) return;

        hasCoords = true;
        const sourceId = `activity-${index}`;
        const color = activityColor(activity.type);

        // Étendre les limites de la carte
        coords.forEach(coord => bounds.extend(coord as maplibregl.LngLatLike));

        // Ajouter la source GeoJSON
        this.map!.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {
              name: activity.name,
              type: activity.type
            },
            geometry: {
              type: 'LineString',
              coordinates: coords
            }
          }
        });

        // Dessiner la ligne
        this.map!.addLayer({
          id: `${sourceId}-line`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': color,
            'line-width': 2.5,
            'line-opacity': 0.7
          }
        });
      });

      // Ajuster la vue pour afficher tous les tracés
      if (hasCoords) {
        this.map!.fitBounds(bounds, { padding: 50 });
      }
    });
  }
}
