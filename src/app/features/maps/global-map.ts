import {
  Component,
  inject,
  afterNextRender,
  viewChild,
  ElementRef,
  effect,
  signal,
  computed,
  untracked
} from '@angular/core';
import { Router } from '@angular/router';
import { StravaService } from '../../core/services/strava.service';
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
          @for (t of activityTypes(); track t.key) {
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

        <!-- Toggle Heatmap -->
        <button (click)="heatmapMode.set(!heatmapMode())"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                [class]="heatmapMode()
                  ? 'bg-strava text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">
          Heatmap
        </button>

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
        {{ geoJsonData().features.length }} / {{ activitiesWithTrack() }} activités affichées
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

  /** La carte est-elle prête (load event fired) ? */
  private mapReady = false;

  /** Le style de carte actuellement chargé */
  private currentStyle: 'light' | 'dark' = 'light';

  /** Popup partagée pour le survol */
  private popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '280px' });

  /** ID de la feature actuellement survolée */
  private hoveredId: number | null = null;

  /** Types d'activités présents dans les données et ayant un tracé GPS */
  readonly activityTypes = computed(() => {
    const types = new Set(
      this.strava.activities()
        .filter(a => a.map?.summary_polyline)
        .map(a => a.type)
    );
    return [...types].map(key => ({
      key,
      label: activityTypeFr(key),
      color: activityColor(key)
    }));
  });

  /** Types actuellement sélectionnés (mis à jour quand de nouveaux types apparaissent) */
  readonly selectedTypes = signal<Set<string>>(new Set());

  /** Périodes disponibles */
  readonly periods = [
    { key: 'all', label: 'Tout' },
    { key: '12m', label: '12 mois' },
    { key: '6m', label: '6 mois' },
    { key: '3m', label: '3 mois' },
  ];

  /** Période sélectionnée */
  readonly selectedPeriod = signal('all');

  /** Mode heatmap */
  readonly heatmapMode = signal(false);

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

  /** Nombre total d'activités avec tracé GPS */
  protected readonly activitiesWithTrack = computed(() =>
    this.strava.activities().filter(a => a.map?.summary_polyline).length
  );

  /** Features GeoJSON construites à partir des activités filtrées */
  protected readonly geoJsonData = computed(() => {
    const activities = this.filteredActivities();
    const features: GeoJSON.Feature[] = [];

    activities.forEach((activity, index) => {
      const polyline = activity.map?.summary_polyline;
      if (!polyline) return;

      const coords = toGeoJsonCoords(decodePolyline(polyline));
      if (coords.length === 0) return;

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

    return { type: 'FeatureCollection' as const, features };
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
    // Synchroniser les types sélectionnés avec les types disponibles
    effect(() => {
      const available = this.activityTypes();
      const availableKeys = new Set(available.map(t => t.key));
      const current = untracked(() => this.selectedTypes());
      // Ajouter les nouveaux types automatiquement
      const updated = new Set(current);
      let changed = false;
      for (const key of availableKeys) {
        if (!updated.has(key)) { updated.add(key); changed = true; }
      }
      // Retirer les types qui n'existent plus
      for (const key of updated) {
        if (!availableKeys.has(key)) { updated.delete(key); changed = true; }
      }
      if (changed) this.selectedTypes.set(updated);
    });

    afterNextRender(() => {
      if (this.strava.activities().length === 0) {
        this.strava.loadActivities(1, 200);
      }
    });

    // Créer la carte quand le conteneur est prêt
    effect(() => {
      const container = this.mapContainer();
      const heatmap = this.heatmapMode();
      const targetStyle = heatmap ? 'dark' : 'light';

      if (!container) return;

      // Recréer la carte uniquement si elle n'existe pas ou si le style change (heatmap toggle)
      if (!this.map || this.currentStyle !== targetStyle) {
        this.createMap(container.nativeElement, heatmap);
      }
    });

    // Mettre à jour les données quand les filtres changent
    effect(() => {
      const data = this.geoJsonData();
      const heatmap = this.heatmapMode();
      if (this.map && this.mapReady) {
        this.updateData(data, heatmap);
      }
    });
  }

  /** Créer la carte MapLibre (appelé une seule fois ou lors du changement de style) */
  private createMap(container: HTMLElement, heatmap: boolean): void {
    // Nettoyer l'ancienne carte
    if (this.map) {
      this.popup.remove();
      this.hoveredId = null;
      try { this.map.remove(); } catch { /* ignore */ }
      this.map = null;
      this.mapReady = false;
    }

    this.currentStyle = heatmap ? 'dark' : 'light';

    const activities = this.filteredActivities();
    const firstWithCoords = activities.find(a => a.start_latlng);
    const center: [number, number] = firstWithCoords?.start_latlng
      ? [firstWithCoords.start_latlng[1], firstWithCoords.start_latlng[0]]
      : [2.3522, 48.8566];

    this.map = new maplibregl.Map({
      container,
      style: heatmap
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom: 10
    });

    this.map.on('load', () => {
      this.mapReady = true;

      // Ajouter la source vide
      this.map!.addSource('activities', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Layer invisible pour faciliter le clic/tap sur mobile
      this.map!.addLayer({
        id: 'activities-hitarea',
        type: 'line',
        source: 'activities',
        paint: { 'line-color': 'transparent', 'line-width': 20 }
      });

      // Layer visible
      this.map!.addLayer({
        id: 'activities-line',
        type: 'line',
        source: 'activities',
        paint: {
          'line-color': heatmap ? '#FC4C02' : ['get', 'color'],
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 6, 3],
          'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, heatmap ? 0.15 : 0.25]
        }
      });

      // Événements
      const layers = ['activities-hitarea', 'activities-line'];

      const handleHover = (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
        if (!this.map) return;
        const feature = e.features?.[0];
        if (!feature) return;

        this.map.getCanvas().style.cursor = 'pointer';
        const id = feature.id as number;

        if (this.hoveredId !== null && this.hoveredId !== id) {
          this.map.setFeatureState({ source: 'activities', id: this.hoveredId }, { hover: false });
        }
        if (this.hoveredId !== id) {
          this.hoveredId = id;
          this.map.setFeatureState({ source: 'activities', id }, { hover: true });
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
      };

      const handleLeave = () => {
        if (!this.map) return;
        this.map.getCanvas().style.cursor = '';
        if (this.hoveredId !== null) {
          this.map.setFeatureState({ source: 'activities', id: this.hoveredId }, { hover: false });
          this.hoveredId = null;
        }
        this.popup.remove();
      };

      const handleClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
        if (!this.map) return;
        const activityId = e.features?.[0]?.properties?.['activityId'];
        if (activityId) {
          this.router.navigate(['/activities', activityId], { queryParams: { from: 'map' } });
        }
      };

      for (const layer of layers) {
        this.map!.on('mousemove', layer, handleHover);
        this.map!.on('mouseleave', layer, handleLeave);
        this.map!.on('click', layer, handleClick);
      }

      // Charger les données initiales
      this.updateData(this.geoJsonData(), heatmap);
    });
  }

  /** Mettre à jour les données GeoJSON sans recréer la carte */
  private updateData(data: GeoJSON.FeatureCollection, _heatmap: boolean): void {
    if (!this.map || !this.mapReady) return;

    const source = this.map.getSource('activities') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Reset hover
    this.popup.remove();
    if (this.hoveredId !== null) {
      try { this.map.setFeatureState({ source: 'activities', id: this.hoveredId }, { hover: false }); } catch { /* ignore */ }
      this.hoveredId = null;
    }

    // Mettre à jour les données
    source.setData(data);

    // Ajuster la vue si il y a des features
    if (data.features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const feature of data.features) {
        const coords = (feature.geometry as GeoJSON.LineString).coordinates;
        for (const coord of coords) {
          bounds.extend(coord as maplibregl.LngLatLike);
        }
      }
      this.map.fitBounds(bounds, { padding: 50 });
    }
  }
}
