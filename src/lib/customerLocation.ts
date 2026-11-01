import * as Location from 'expo-location';
import { fetchAddresses } from './api';
import { useCustomerLocationStore } from '../stores/customerLocationStore';

export type ResolvedLocation = {
  lat: number;
  lng: number;
  source: 'gps' | 'saved_address' | 'cached';
  label?: string;
};

/** GPS first, then default saved address, then last cached coordinates. */
export async function resolveCustomerLocation(
  userId: string | undefined
): Promise<{ data?: ResolvedLocation; error?: 'permission_denied' | 'no_location' }> {
  const gps = await tryGps();
  if (gps) {
    useCustomerLocationStore.getState().setLocation(gps.lat, gps.lng, 'gps', 'GPS');
    return { data: { ...gps, source: 'gps' } };
  }

  if (userId) {
    const fromAddr = await tryDefaultAddress(userId);
    if (fromAddr) {
      useCustomerLocationStore
        .getState()
        .setLocation(fromAddr.lat, fromAddr.lng, 'saved_address', fromAddr.label);
      return { data: { ...fromAddr, source: 'saved_address' } };
    }
  }

  const cached = useCustomerLocationStore.getState();
  if (cached.lat != null && cached.lng != null) {
    return {
      data: {
        lat: cached.lat,
        lng: cached.lng,
        source: 'cached',
        label: cached.label ?? undefined,
      },
    };
  }

  return { error: 'no_location' };
}

async function tryGps(): Promise<{ lat: number; lng: number; label?: string } | null> {
  const { status } = await Location.getForegroundPermissionsAsync();
  let granted = status === 'granted';
  if (!granted) {
    const req = await Location.requestForegroundPermissionsAsync();
    granted = req.status === 'granted';
  }
  if (!granted) return null;

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'GPS' };
}

async function tryDefaultAddress(
  userId: string
): Promise<{ lat: number; lng: number; label?: string } | null> {
  const { data: addresses } = await fetchAddresses(userId);
  const pick = addresses.find((a) => a.is_default) ?? addresses[0];
  if (!pick || pick.lat == null || pick.lng == null) return null;
  return { lat: pick.lat, lng: pick.lng, label: pick.label };
}

export async function refreshGpsLocation(): Promise<ResolvedLocation | null> {
  const gps = await tryGps();
  if (!gps) return null;
  useCustomerLocationStore.getState().setLocation(gps.lat, gps.lng, 'gps', 'GPS');
  return { ...gps, source: 'gps' };
}
