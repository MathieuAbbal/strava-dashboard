import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  Athlete,
  ActivitySummary,
  ActivityDetail,
  AthleteStats
} from '../models/strava.models';

/** Clés localStorage pour persister les tokens entre les sessions */
const STORAGE_ACCESS_TOKEN = 'strava_access_token';
const STORAGE_REFRESH_TOKEN = 'strava_refresh_token';
const STORAGE_EXPIRES_AT = 'strava_expires_at';

/**
 * Service principal pour les appels à l'API Strava
 * Gère automatiquement le renouvellement du token expiré
 */
@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly apiUrl = environment.strava.apiUrl;

  /** Token d'accès courant (localStorage ou environment) */
  private accessToken =
    localStorage.getItem(STORAGE_ACCESS_TOKEN) ?? environment.strava.accessToken;

  /** Refresh token courant (localStorage ou environment) */
  private refreshToken =
    localStorage.getItem(STORAGE_REFRESH_TOKEN) ?? environment.strava.refreshToken;

  /** Timestamp d'expiration du token */
  private expiresAt = Number(localStorage.getItem(STORAGE_EXPIRES_AT) ?? '0');

  /** Verrou pour éviter plusieurs refresh simultanés */
  private refreshPromise: Promise<void> | null = null;

  /** Signal : profil de l'athlète */
  readonly athlete = signal<Athlete | null>(null);

  /** Signal : liste des activités */
  readonly activities = signal<ActivitySummary[]>([]);

  /** Signal : statistiques globales */
  readonly stats = signal<AthleteStats | null>(null);

  /** Signal : état de chargement */
  readonly loading = signal(false);

  /** Signal : message d'erreur */
  readonly error = signal<string | null>(null);

  /** Computed : nombre total d'activités chargées */
  readonly activitiesCount = computed(() => this.activities().length);

  /** Computed : distance totale en km */
  readonly totalDistanceKm = computed(() => {
    const total = this.activities().reduce((sum, a) => sum + a.distance, 0);
    return Math.round(total / 1000);
  });

  /** Computed : dénivelé total en mètres */
  readonly totalElevation = computed(() => {
    return Math.round(
      this.activities().reduce((sum, a) => sum + a.total_elevation_gain, 0)
    );
  });

  /** Computed : temps total en heures */
  readonly totalTimeHours = computed(() => {
    const seconds = this.activities().reduce((sum, a) => sum + a.moving_time, 0);
    return Math.round((seconds / 3600) * 10) / 10;
  });

  /**
   * En-têtes d'authentification pour l'API Strava
   */
  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`
    };
  }

  /**
   * Vérifier si le token est expiré (avec 5 min de marge)
   */
  private isTokenExpired(): boolean {
    if (!this.expiresAt) return false;
    return Date.now() / 1000 > this.expiresAt - 300;
  }

  /**
   * Renouveler le token d'accès via le refresh token
   * POST /oauth/token
   */
  private async refreshAccessToken(): Promise<void> {
    const response = await fetch('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: environment.strava.clientId,
        client_secret: environment.strava.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Impossible de renouveler le token Strava');
    }

    const data = await response.json();

    // Mettre à jour les tokens en mémoire et dans localStorage
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = data.expires_at;

    localStorage.setItem(STORAGE_ACCESS_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_REFRESH_TOKEN, data.refresh_token);
    localStorage.setItem(STORAGE_EXPIRES_AT, data.expires_at.toString());
  }

  /**
   * S'assurer que le token est valide avant un appel API
   * Utilise un verrou pour éviter les refresh concurrents
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.isTokenExpired()) return;

    // Si un refresh est déjà en cours, attendre qu'il finisse
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = this.refreshAccessToken();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Appel générique à l'API Strava avec refresh automatique
   */
  private async fetchApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    // Vérifier le token avant l'appel
    await this.ensureValidToken();

    let url = `${this.apiUrl}${endpoint}`;
    if (params) {
      const query = new URLSearchParams(params).toString();
      url += `?${query}`;
    }

    let response = await fetch(url, { headers: this.headers });

    // Si 401, tenter un refresh puis réessayer une fois
    if (response.status === 401) {
      await this.refreshAccessToken();
      response = await fetch(url, { headers: this.headers });
    }

    if (!response.ok) {
      throw new Error(`Erreur API Strava : ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Récupérer le profil de l'athlète connecté
   * GET /athlete
   */
  async loadAthlete(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      const data = await this.fetchApi<Athlete>('/athlete');
      this.athlete.set(data);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Récupérer la liste des activités (paginée)
   * GET /athlete/activities
   */
  async loadActivities(page = 1, perPage = 50): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      const data = await this.fetchApi<ActivitySummary[]>('/athlete/activities', {
        page: page.toString(),
        per_page: perPage.toString()
      });
      this.activities.set(data);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Charger toutes les activités (pagination automatique)
   */
  async loadAllActivities(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      let page = 1;
      const perPage = 100;
      let allActivities: ActivitySummary[] = [];
      let batch: ActivitySummary[];

      do {
        batch = await this.fetchApi<ActivitySummary[]>('/athlete/activities', {
          page: page.toString(),
          per_page: perPage.toString()
        });
        allActivities = [...allActivities, ...batch];
        page++;
      } while (batch.length === perPage);

      this.activities.set(allActivities);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Récupérer le détail d'une activité (avec tracé GPS complet)
   * GET /activities/:id
   */
  async getActivityDetail(id: number): Promise<ActivityDetail | null> {
    try {
      this.loading.set(true);
      this.error.set(null);
      return await this.fetchApi<ActivityDetail>(`/activities/${id}`);
    } catch (e) {
      this.error.set((e as Error).message);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Récupérer les statistiques globales de l'athlète
   * GET /athletes/:id/stats
   */
  async loadStats(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      if (!this.athlete()) {
        await this.loadAthlete();
      }

      const athleteId = this.athlete()?.id;
      if (!athleteId) {
        throw new Error('Impossible de récupérer l\'ID de l\'athlète');
      }

      const data = await this.fetchApi<AthleteStats>(`/athletes/${athleteId}/stats`);
      this.stats.set(data);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
