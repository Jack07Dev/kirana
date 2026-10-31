import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem, Product } from '../types/database';

interface CartState {
  storeId: string | null;
  items: CartItem[];
  addItem: (product: Product, qty?: number) => { error?: string };
  removeItem: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
}

export const cartSelectors = {
  itemCount: (s: CartState) =>
    s.items.reduce((total, item) => total + item.quantity, 0),
  subtotal: (s: CartState) =>
    s.items.reduce(
      (total, item) => total + item.product.selling_price * item.quantity,
      0
    ),
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      items: [],

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
    }),
    {
      name: 'kirana-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        storeId: state.storeId,
        items: state.items,
      }),
    }
  )
);
