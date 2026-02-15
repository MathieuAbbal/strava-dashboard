import {
  Component,
  inject,
  afterNextRender,
  viewChild,
  ElementRef,
  effect,
  signal,
  computed
} from '@angular/core';
import { Router } from '@angular/router';
import { StravaService } from '../../core/services/strava.service';
import { ActivitySummary } from '../../core/models/strava.models';
import { decodePolyline, toGeoJsonCoords } from '../../core/utils/polyline';
import { activityColor, activityTypeFr, metersToKm, secondsToHoursMin, formatDateFr } from '../../core/utils/format';
import maplibregl from 'maplibre-gl';

/**
 * Carte globale affichant toutes les activités superposées
 * Chaque tracé est coloré selon le type d'activité
 */
@Component({
  selector: 'app-global-map',
  standalone: true,
  template: `
    <div class="max-w-7xl mx-auto px-6 py-8">
      <h1 class="text-3xl font-bold text-slate-800 tracking-tight mb-6">Carte des activités</h1>

      <!-- Filtres + Légende -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-4 mb-6 flex flex-wrap gap-4 items-center">
        <!-- Filtre par type -->
        <div class="flex gap-1.5 flex-wrap">
          @for (t of activityTypes; track t.key) {
            <button (click)="toggleType(t.key)"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    [class]="selectedTypes().has(t.key)
                      ? 'bg-white shadow-sm border border-slate-200 text-slate-700'
                      : 'bg-slate-100 text-slate-400 line-through'">
              <span class="w-2.5 h-2.5 rounded-full inline-block" [style.background-color]="t.color"></span>
              {{ t.label }}
            </button>
          }
        </div>

        <span class="w-px h-6 bg-slate-200 hidden sm:block"></span>

        <!-- Filtre par période -->
        <div class="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          @for (p of periods; track p.key) {
            <button (click)="selectedPeriod.set(p.key)"
                    class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                    [class]="selectedPeriod() === p.key
                      ? 'bg-white shadow-sm text-slate-700'
                      : 'text-slate-400 hover:text-slate-600'">
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <!-- Chargement -->
      @if (strava.loading()) {
        <div class="text-center py-6">
          <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-strava border-r-transparent"></div>
          <span class="ml-3 text-slate-400 font-medium">Chargement des activités...</span>
        </div>
      }

      <!-- Carte -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div #mapContainer class="h-[600px] w-full"></div>
      </div>

      <!-- Nombre d'activités affichées -->
      <p class="text-sm text-slate-400 mt-3 text-right font-medium">
        {{ filteredActivities().length }} / {{ strava.activitiesCount() }} activités affichées
      </p>
    </div>
  `
})
export class GlobalMap {
  protected readonly strava = inject(StravaService);
  private readonly router = inject(Router);

  /** Référence vers le conteneur de la carte */
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');

  /** Instance MapLibre */
  private map: maplibregl.Map | null = null;

  /** Popup partagée pour le survol */
  private popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '280px' });

  /** ID de la feature actuellement survolée */
  private hoveredId: number | null = null;

  /** Types d'activités pour le filtre */
  readonly activityTypes = [
    { key: 'Run', label: 'Course', color: '#ef4444' },
    { key: 'TrailRun', label: 'Trail', color: '#dc2626' },
    { key: 'Ride', label: 'Vélo', color: '#3b82f6' },
    { key: 'VirtualRide', label: 'Vélo virtuel', color: '#60a5fa' },
    { key: 'Hike', label: 'Randonnée', color: '#22c55e' },
    { key: 'Walk', label: 'Marche', color: '#84cc16' },
    { key: 'Swim', label: 'Natation', color: '#06b6d4' },
    { key: 'Workout', label: 'Entraînement', color: '#f59e0b' },
  ];

  /** Types actuellement sélectionnés */
  readonly selectedTypes = signal<Set<string>>(new Set(this.activityTypes.map(t => t.key)));

  /** Périodes disponibles */
  readonly periods = [
    { key: 'all', label: 'Tout' },
    { key: '12m', label: '12 mois' },
    { key: '6m', label: '6 mois' },
    { key: '3m', label: '3 mois' },
  ];

  /** Période sélectionnée */
  readonly selectedPeriod = signal('all');

  /** Activités filtrées par type et période */
  readonly filteredActivities = computed(() => {
    const types = this.selectedTypes();
    const period = this.selectedPeriod();
    let activities = this.strava.activities().filter(a => types.has(a.type));

    if (period !== 'all') {
      const months = parseInt(period);
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      activities = activities.filter(a => new Date(a.start_date) >= cutoff);
    }

    return activities;
  });

  /** Activer/désactiver un type d'activité */
  toggleType(key: string): void {
    const current = new Set(this.selectedTypes());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.selectedTypes.set(current);
  }

  constructor() {
    // Charger toutes les activités au démarrage
    afterNextRender(() => {
      if (this.strava.activities().length === 0) {
        this.strava.loadActivities(1, 200);
      }
    });

    // Dessiner les tracés quand les données ou les filtres changent
    effect(() => {
      const activities = this.filteredActivities();
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
      const features: GeoJSON.Feature[] = [];

      // Construire une FeatureCollection unique
      activities.forEach((activity, index) => {
        const polyline = activity.map?.summary_polyline;
        if (!polyline) return;

        const coords = toGeoJsonCoords(decodePolyline(polyline));
        if (coords.length === 0) return;

        coords.forEach(coord => bounds.extend(coord as maplibregl.LngLatLike));

        features.push({
          type: 'Feature',
          id: index,
          properties: {
            name: activity.name,
            type: activity.type,
            color: activityColor(activity.type),
            distance: activity.distance,
            moving_time: activity.moving_time,
            total_elevation_gain: activity.total_elevation_gain,
            start_date: activity.start_date,
            activityId: activity.id
          },
          geometry: { type: 'LineString', coordinates: coords }
        });
      });

      if (features.length === 0) return;

      // Source unique avec toutes les activités
      this.map!.addSource('activities', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features }
      });

      // Layer unique avec couleur data-driven et hover via feature-state
      this.map!.addLayer({
        id: 'activities-line',
        type: 'line',
        source: 'activities',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 5, 2.5],
          'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.2]
        }
      });

      // Survol : popup + highlight
      this.map!.on('mousemove', 'activities-line', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        this.map!.getCanvas().style.cursor = 'pointer';
        const id = feature.id as number;

        // Changer le feature-state uniquement si on change de feature
        if (this.hoveredId !== null && this.hoveredId !== id) {
          this.map!.setFeatureState({ source: 'activities', id: this.hoveredId }, { hover: false });
        }
        if (this.hoveredId !== id) {
          this.hoveredId = id;
          this.map!.setFeatureState({ source: 'activities', id }, { hover: true });
        }

        const props = feature.properties;
        const html = `
          <div style="font-family: system-ui, sans-serif; line-height: 1.4;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${props['name']}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${activityTypeFr(props['type'])} · ${formatDateFr(props['start_date'])}</div>
            <div style="display: flex; gap: 12px; font-size: 12px;">
              <span><strong>${metersToKm(props['distance'])}</strong> km</span>
              <span><strong>${secondsToHoursMin(props['moving_time'])}</strong></span>
              <span><strong>${Math.round(props['total_elevation_gain'])}</strong> m D+</span>
            </div>
          </div>
        `;
        this.popup.setLngLat(e.lngLat).setHTML(html).addTo(this.map!);
      });

      this.map!.on('mouseleave', 'activities-line', () => {
        this.map!.getCanvas().style.cursor = '';
        if (this.hoveredId !== null) {
          this.map!.setFeatureState({ source: 'activities', id: this.hoveredId }, { hover: false });
          this.hoveredId = null;
        }
        this.popup.remove();
      });

      // Clic : naviguer vers le détail de l'activité
      this.map!.on('click', 'activities-line', (e) => {
        const activityId = e.features?.[0]?.properties?.['activityId'];
        if (activityId) {
          this.router.navigate(['/activities', activityId], { queryParams: { from: 'map' } });
        }
      });

      // Ajuster la vue pour afficher tous les tracés
      this.map!.fitBounds(bounds, { padding: 50 });
    });
  }
}
