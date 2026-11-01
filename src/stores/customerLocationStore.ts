import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocationSource = 'gps' | 'saved_address' | 'manual';

interface CustomerLocationState {
  lat: number | null;
  lng: number | null;
  label: string | null;
  source: LocationSource | null;
  setLocation: (
    lat: number,
    lng: number,
    source: LocationSource,
    label?: string | null
  ) => void;
  clear: () => void;
}

export const useCustomerLocationStore = create<CustomerLocationState>()(
  persist(
    (set) => ({
      lat: null,
      lng: null,
      label: null,
      source: null,
      setLocation: (lat, lng, source, label = null) =>
        set({ lat, lng, source, label }),
      clear: () => set({ lat: null, lng: null, label: null, source: null }),
    }),
    {
      name: 'kirana-customer-location',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
