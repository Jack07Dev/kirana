/** Earth radius in meters */
const R = 6371000;

/** Haversine distance in meters between two WGS84 points */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Whether customer is within store delivery radius */
export function isWithinRadius(
  storeLat: number,
  storeLng: number,
  customerLat: number,
  customerLng: number,
  radiusM: number
): boolean {
  return distanceMeters(storeLat, storeLng, customerLat, customerLng) <= radiusM;
}

export function formatDistance(meters: number, lang: 'hi' | 'en' = 'en'): string {
  if (meters < 1000) {
    return lang === 'hi' ? `${Math.round(meters)} मी` : `${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return lang === 'hi' ? `${km} किमी` : `${km} km`;
}

/** PostGIS-compatible WKT point (lng lat) */
export function toWktPoint(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}

/** Extract lat/lng from PostGIS GeoJSON or WKT returned by Supabase */
export function parseLocation(loc: unknown): { lat: number; lng: number } | null {
  if (!loc) return null;
  if (typeof loc === 'object' && loc !== null) {
    const g = loc as { type?: string; coordinates?: number[] };
    if (g.type === 'Point' && Array.isArray(g.coordinates)) {
      return { lng: g.coordinates[0], lat: g.coordinates[1] };
    }
  }
  if (typeof loc === 'string') {
    const m = loc.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (m) return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
  }
  return null;
}

export const RADIUS_MIN = 50;
export const RADIUS_MAX = 2000;
export const RADIUS_STEP = 50;
