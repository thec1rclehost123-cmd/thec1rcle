import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { cacheClear } from '@/lib/scanner/api';
import { ScannerEventData } from '@/lib/scanner/types';

const SCANNER_SESSION_KEY = 'c1rcle_scanner_session';

interface ScannerState {
  eventData: ScannerEventData | null;
  isAuthenticated: boolean;
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  setEventData: (data: ScannerEventData | null) => Promise<void>;
  clearEvent: () => Promise<void>;
  rehydrate: () => Promise<void>;
}

export const useScannerStore = create<ScannerState>((set) => ({
  eventData: null,
  isAuthenticated: false,
  sessionToken: null,
  sessionExpiresAt: null,

  setEventData: async (data) => {
    set({
      eventData: data,
      isAuthenticated: !!data?.valid,
      sessionToken: data?.sessionToken ?? null,
      sessionExpiresAt: data?.sessionExpiresAt ?? null,
    });
    if (data?.valid) {
      await SecureStore.setItemAsync(SCANNER_SESSION_KEY, JSON.stringify(data));
      return;
    }
    cacheClear();
    await SecureStore.deleteItemAsync(SCANNER_SESSION_KEY);
  },

  clearEvent: async () => {
    set({ eventData: null, isAuthenticated: false, sessionToken: null, sessionExpiresAt: null });
    cacheClear();
    await SecureStore.deleteItemAsync(SCANNER_SESSION_KEY);
  },

  rehydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SCANNER_SESSION_KEY);
      if (!raw) return;
      const data: ScannerEventData = JSON.parse(raw);
      // Check session token expiry
      if (data.sessionExpiresAt && new Date(data.sessionExpiresAt) < new Date()) {
        cacheClear();
        await SecureStore.deleteItemAsync(SCANNER_SESSION_KEY);
        return;
      }
      set({
        eventData: data,
        isAuthenticated: true,
        sessionToken: data.sessionToken ?? null,
        sessionExpiresAt: data.sessionExpiresAt ?? null,
      });
    } catch {}
  },
}));
