import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { requestPhoneOtp, verifyPhoneOtp } from '../lib/phoneAuth';
import { supabase } from '../lib/supabase';
import type { Store, User, UserRole } from '../types/database';
import i18n from '../i18n';

interface AuthState {
  session: Session | null;
  user: User | null;
  store: Store | null;
  loading: boolean;
  otpSent: boolean;
  phone: string;
  initialized: boolean;

  init: () => Promise<void>;
  sendOtp: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (otp: string) => Promise<{ error?: string }>;
  setRole: (role: UserRole, fullName: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
  setStore: (store: Store | null) => void;
  setLanguage: (lang: 'hi' | 'en') => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  store: null,
  loading: false,
  otpSent: false,
  phone: '',
  initialized: false,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, initialized: true });
    if (data.session) await get().refreshProfile();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session) await get().refreshProfile();
      else set({ user: null, store: null });
    });
  },

  sendOtp: async (phone) => {
    set({ loading: true });
    const res = await requestPhoneOtp(phone);
    set({ loading: false });
    if (res.error) return { error: res.error };
    if (res.e164) set({ phone: res.e164, otpSent: true });
    return {};
  },

  verifyOtp: async (otp) => {
    const { phone } = get();
    if (!phone) return { error: 'required' };

    set({ loading: true });
    const result = await verifyPhoneOtp(phone, otp);
    if (result.error) {
      set({ loading: false });
      return { error: result.error };
    }

    const { data } = await supabase.auth.getSession();
    set({ session: data.session, loading: false });
    await get().refreshProfile();
    return {};
  },

  setRole: async (role, fullName) => {
    set({ loading: true });
    const uid = get().session?.user?.id;
    if (!uid) {
      set({ loading: false });
      return { error: 'Not authenticated' };
    }
    const { error } = await supabase
      .from('users')
      .update({ role, full_name: fullName })
      .eq('id', uid);
    set({ loading: false });
    if (error) return { error: error.message };
    await get().refreshProfile();
    return {};
  },

  refreshProfile: async () => {
    const uid = get().session?.user?.id;
    if (!uid) return;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (user) {
      set({ user: user as User });
      if (user.preferred_lang) {
        await i18n.changeLanguage(user.preferred_lang);
      }
      const { registerForPushNotifications } = await import('../lib/notifications');
      void registerForPushNotifications(uid);
    }

    if (user?.role === 'store_owner') {
      const { data: store } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', uid)
        .maybeSingle();
      set({ store: (store as Store) ?? null });
    }
  },

  setStore: (store) => set({ store }),

  setLanguage: async (lang) => {
    await i18n.changeLanguage(lang);
    const uid = get().session?.user?.id;
    if (uid) {
      await supabase.from('users').update({ preferred_lang: lang }).eq('id', uid);
    }
    set({
      user: get().user ? { ...get().user!, preferred_lang: lang } : null,
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      store: null,
      otpSent: false,
      phone: '',
    });
    router.replace('/(auth)/phone');
  },
}));
