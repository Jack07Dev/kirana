import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, Product } from '../types/database';

interface CartState {
  storeId: string | null;
  items: CartItem[];
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  addItem: (product: Product, qty?: number) => { error?: string };
  removeItem: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      items: [],
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),

      addItem: (product, qty = 1) => {
        const { storeId, items } = get();
        if (storeId && storeId !== product.store_id) {
          return { error: 'Clear cart to order from another store' };
        }
        const existing = items.find((i) => i.product.id === product.id);
        if (existing) {
          set({
            storeId: product.store_id,
            items: items.map((i) =>
              i.product.id === product.id
                ? { ...i, quantity: i.quantity + qty }
                : i
            ),
          });
        } else {
          set({
            storeId: product.store_id,
            items: [...items, { product, quantity: qty }],
          });
        }
        return {};
      },

      removeItem: (productId) => {
        const items = get().items.filter((i) => i.product.id !== productId);
        set({ items, storeId: items.length ? get().storeId : null });
      },

      setQty: (productId, qty) => {
        if (qty <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.product.id === productId ? { ...i, quantity: qty } : i
          ),
        });
      },

      clear: () => set({ storeId: null, items: [] }),

      subtotal: () =>
        get().items.reduce((s, i) => s + i.product.selling_price * i.quantity, 0),

      itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    {
      name: 'kirana-cart-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ storeId: s.storeId, items: s.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
