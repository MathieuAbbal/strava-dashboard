/**
 * Utilitaires de formatage pour l'affichage
 */

/** Convertir des mètres en kilomètres avec 1 décimale */
export function metersToKm(meters: number): string {
  return (meters / 1000).toFixed(1);
}

/** Convertir des secondes en format "Xh Xmin" */
export function secondsToHoursMin(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  return `${hours}h ${minutes}min`;
}

/** Convertir m/s en min/km (allure course) */
export function speedToPace(metersPerSecond: number): string {
  if (metersPerSecond === 0) return '-';
  const minPerKm = 1000 / metersPerSecond / 60;
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

/** Convertir m/s en km/h */
export function speedToKmh(metersPerSecond: number): string {
  return (metersPerSecond * 3.6).toFixed(1);
}

/** Formater une date ISO en format français court */
export function formatDateFr(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/** Couleur associée à un type d'activité */
export function activityColor(type: string): string {
  const colors: Record<string, string> = {
    Run: '#ef4444',        // Rouge
    TrailRun: '#dc2626',   // Rouge foncé
    Ride: '#3b82f6',       // Bleu
    VirtualRide: '#60a5fa', // Bleu clair
    Swim: '#06b6d4',       // Cyan
    Hike: '#22c55e',       // Vert
    Walk: '#84cc16',       // Vert clair
    Workout: '#f59e0b',    // Ambre
    WeightTraining: '#a855f7', // Violet
    Yoga: '#ec4899',       // Rose
  };
  return colors[type] ?? '#6b7280'; // Gris par défaut
}

/** Traduction française des types d'activité */
export function activityTypeFr(type: string): string {
  const labels: Record<string, string> = {
    Run: 'Course',
    TrailRun: 'Trail',
    Ride: 'Vélo',
    VirtualRide: 'Vélo virtuel',
    Swim: 'Natation',
    Hike: 'Randonnée',
    Walk: 'Marche',
    Workout: 'Entraînement',
    WeightTraining: 'Musculation',
    Yoga: 'Yoga',
  };
  return labels[type] ?? type;
}

/** Icône emoji pour un type d'activité */
export function activityIcon(type: string): string {
  const icons: Record<string, string> = {
    Run: '🏃',
    TrailRun: '🏔️',
    Ride: '🚴',
    VirtualRide: '🖥️',
    Swim: '🏊',
    Hike: '🥾',
    Walk: '🚶',
    Workout: '💪',
    WeightTraining: '🏋️',
    Yoga: '🧘',
  };
  return icons[type] ?? '🏅';
}
