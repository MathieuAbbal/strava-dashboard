/**
 * Décodeur de polylines encodées (format Google)
 * Utilisé pour convertir les tracés GPS Strava en coordonnées [lat, lng]
 * Référence : https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Décoder la latitude
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    // Décoder la longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Convertir des coordonnées [lat, lng] en format GeoJSON [lng, lat]
 * MapLibre utilise [longitude, latitude] contrairement à Strava [latitude, longitude]
 */
export function toGeoJsonCoords(points: [number, number][]): [number, number][] {
  return points.map(([lat, lng]) => [lng, lat]);
}
