/**
 * Modèles de données pour l'API Strava
 */

/** Profil de l'athlète */
export interface Athlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;              // URL de la photo de profil
  profile_medium?: string;      // Photo taille moyenne
  city: string;
  state?: string;               // État/région
  country: string;
  sex?: string;                 // "M" ou "F"
  weight: number;               // Poids en kg
  premium?: boolean;            // Compte premium/abonné
  created_at?: string;          // Date d'inscription ISO 8601
  follower_count?: number;
  friend_count?: number;
  measurement_preference?: string; // "meters" ou "feet"
  ftp?: number;                 // FTP vélo (watts)
}

/** Résumé d'une activité (liste) */
export interface ActivitySummary {
  id: number;
  name: string;
  type: ActivityType;
  sport_type: string;
  start_date: string;           // ISO 8601
  distance: number;             // En mètres
  moving_time: number;          // En secondes
  elapsed_time: number;         // En secondes
  total_elevation_gain: number; // En mètres
  average_speed: number;        // En m/s
  max_speed: number;            // En m/s
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate?: boolean;      // true si données FC présentes
  average_watts?: number;       // Puissance moyenne (vélo)
  max_watts?: number;           // Puissance max
  kilojoules?: number;          // Énergie dépensée (vélo)
  device_watts?: boolean;       // true si capteur de puissance réel
  average_temp?: number;        // Température moyenne (°C)
  suffer_score?: number;        // Score d'effort relatif Strava
  pr_count?: number;            // Nombre de records personnels
  kudos_count?: number;         // Nombre de kudos
  comment_count?: number;       // Nombre de commentaires
  athlete_count?: number;       // Nombre de participants
  photo_count?: number;         // Nombre de photos
  trainer?: boolean;            // true si home trainer
  commute?: boolean;            // true si trajet domicile-travail
  gear_id?: string;             // ID de l'équipement utilisé
  workout_type?: number;        // 0=default, 1=race, 2=long run, 3=workout
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  map: {
    id: string;
    summary_polyline: string;   // Polyline encodée (résumé)
    polyline?: string;          // Polyline complète (détail uniquement)
  };
}

/** Détail complet d'une activité */
export interface ActivityDetail extends ActivitySummary {
  description: string;
  calories: number;
  average_cadence?: number;     // Pas/min (course) ou rpm (vélo)
  elev_high?: number;           // Altitude max (m)
  elev_low?: number;            // Altitude min (m)
  device_name?: string;         // Nom de la montre/compteur
  perceived_exertion?: number;  // Effort perçu (1-10)
  segment_efforts?: SegmentEffort[];  // Segments traversés
  splits_metric?: Split[];      // Splits au km
  best_efforts?: BestEffort[];  // Meilleurs efforts (400m, 1km, 5km...)
  gear?: Gear;                  // Détail de l'équipement
  map: {
    id: string;
    summary_polyline: string;
    polyline: string;           // Polyline complète du tracé
  };
}

/** Effort sur un segment Strava */
export interface SegmentEffort {
  id: number;
  name: string;
  elapsed_time: number;         // En secondes
  moving_time: number;          // En secondes
  distance: number;             // En mètres
  start_index: number;
  end_index: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  pr_rank?: number | null;      // 1, 2, 3 ou null
  kom_rank?: number | null;     // Classement KOM/QOM
  segment: {
    id: number;
    name: string;
    distance: number;           // En mètres
    average_grade: number;      // Pente moyenne (%)
    maximum_grade: number;      // Pente max (%)
    elevation_high: number;     // Altitude haute (m)
    elevation_low: number;      // Altitude basse (m)
    climb_category: number;     // 0=NC, 1-4=cat, 5=HC
    city?: string;
    country?: string;
  };
}

/** Split kilométrique */
export interface Split {
  split: number;                // Numéro du km
  distance: number;             // En mètres
  elapsed_time: number;         // En secondes
  moving_time: number;          // En secondes
  elevation_difference: number; // Dénivelé du split (m)
  average_speed: number;        // En m/s
  average_heartrate?: number;
  pace_zone?: number;           // Zone d'allure Strava
}

/** Meilleur effort (400m, 1km, 5km, 10km, semi, marathon...) */
export interface BestEffort {
  id: number;
  name: string;                 // "400m", "1k", "5k", "10k", "Half-Marathon", "Marathon"
  elapsed_time: number;         // En secondes
  moving_time: number;          // En secondes
  distance: number;             // En mètres
  start_index: number;
  end_index: number;
  pr_rank?: number | null;      // 1=PR, 2=2e meilleur, 3=3e, null=pas top 3
}

/** Équipement (chaussures, vélo...) */
export interface Gear {
  id: string;
  name: string;
  distance: number;             // Distance totale en mètres
  primary: boolean;             // Équipement principal
}

/** Lap/split d'une activité (retourné par GET /activities/{id}/laps) */
export interface Lap {
  lap_index: number;
  distance: number;             // En mètres
  elapsed_time: number;         // En secondes
  moving_time: number;          // En secondes
  average_speed: number;        // En m/s
  max_speed: number;            // En m/s
  total_elevation_gain: number; // En mètres
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
}

/** Record personnel dérivé des activités */
export interface PersonalRecord {
  label: string;
  value: string;
  activityName: string;
  activityId: number;
  date: string;
  icon: string;
  tooltip?: string;
}

/** Stream de données d'une activité (retourné par GET /activities/{id}/streams) */
export interface ActivityStream {
  type: string;                 // time, distance, altitude, heartrate, cadence, watts, temp, velocity_smooth, moving, grade_smooth, latlng
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
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
  distance: number;             // En mètres
  moving_time: number;          // En secondes
  elapsed_time: number;         // En secondes
  elevation_gain: number;       // En mètres
}
