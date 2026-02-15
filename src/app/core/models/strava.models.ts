/**
 * Modèles de données pour l'API Strava
 */

/** Profil de l'athlète */
export interface Athlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;        // URL de la photo de profil
  city: string;
  country: string;
  weight: number;          // Poids en kg
}

/** Résumé d'une activité (liste) */
export interface ActivitySummary {
  id: number;
  name: string;
  type: ActivityType;
  sport_type: string;
  start_date: string;      // ISO 8601
  distance: number;        // En mètres
  moving_time: number;     // En secondes
  elapsed_time: number;    // En secondes
  total_elevation_gain: number; // En mètres
  average_speed: number;   // En m/s
  max_speed: number;       // En m/s
  average_heartrate?: number;
  max_heartrate?: number;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  map: {
    id: string;
    summary_polyline: string; // Polyline encodée (résumé)
    polyline?: string;        // Polyline complète (détail uniquement)
  };
}

/** Détail complet d'une activité */
export interface ActivityDetail extends ActivitySummary {
  description: string;
  calories: number;
  map: {
    id: string;
    summary_polyline: string;
    polyline: string;         // Polyline complète du tracé
  };
}

/** Types d'activité Strava */
export type ActivityType =
  | 'Run'
  | 'Ride'
  | 'Swim'
  | 'Hike'
  | 'Walk'
  | 'TrailRun'
  | 'VirtualRide'
  | 'Workout'
  | 'WeightTraining'
  | 'Yoga'
  | string;

/** Statistiques globales de l'athlète */
export interface AthleteStats {
  all_run_totals: ActivityTotals;
  all_ride_totals: ActivityTotals;
  all_swim_totals: ActivityTotals;
  recent_run_totals: ActivityTotals;
  recent_ride_totals: ActivityTotals;
  recent_swim_totals: ActivityTotals;
  ytd_run_totals: ActivityTotals;
  ytd_ride_totals: ActivityTotals;
  ytd_swim_totals: ActivityTotals;
}

/** Totaux pour un type d'activité */
export interface ActivityTotals {
  count: number;
  distance: number;       // En mètres
  moving_time: number;    // En secondes
  elapsed_time: number;   // En secondes
  elevation_gain: number; // En mètres
}
