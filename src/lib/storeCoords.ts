import { supabase } from './supabase';
import { parseLocation } from './geo';
import type { NearbyStore } from '../types/database';

/** Attach lat/lng from store geography when RPC rows omit coordinates. */
export async function attachStoreCoordinates(
  rows: NearbyStore[]
): Promise<NearbyStore[]> {
  if (!rows.length) return rows;
  if (rows[0].lat != null && rows[0].lng != null) return rows;

  const ids = rows.map((r) => r.id);
  const { data } = await supabase.from('stores').select('id, location').in('id', ids);
  const byId = new Map<string, { lat: number; lng: number }>();
  for (const s of data ?? []) {
    const loc = parseLocation(s.location);
    if (loc) byId.set(s.id, loc);
  }

  return rows.map((r) => {
    const loc = byId.get(r.id);
    return loc ? { ...r, lat: loc.lat, lng: loc.lng } : r;
  });
}
