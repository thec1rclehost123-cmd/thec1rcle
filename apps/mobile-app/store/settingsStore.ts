/**
 * Settings Store
 * Centralized settings management with backend sync
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/lib/api';

// Settings interface
export interface UserSettings {
  // Notification preferences
  notifications: {
    tickets: boolean;
    events: boolean;
    chat: boolean;
    dm: boolean;
    promo: boolean;
    allowAlerts: boolean;
    smsTransactional: boolean;
    marketingPromotions: boolean;
    eventInvites: boolean;
    eventReminders: boolean;
    eventBlasts: boolean;
    eventUpdates: boolean;
    feedbackRequests: boolean;
    guestRegistrations: boolean;
    feedbackResponses: boolean;
    newMembers: boolean;
    eventSubmissions: boolean;
  };

  // Privacy settings
  privacy: {
    dmPrivacy: 'anyone' | 'event' | 'contacts' | 'none';
    showOnlineStatus: boolean;
    showLastSeen: boolean;
    publicProfile: boolean;
    showOnGuestlists: boolean;
    showEventsAttending: boolean;
    contactsSyncing: boolean;
    locationAccess: boolean;
  };

  // Appearance
  appearance: {
    theme: 'system' | 'light' | 'dark';
    reduceMotion: boolean;
    haptics: boolean;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    tickets: true,
    events: true,
    chat: true,
    dm: true,
    promo: false,
    allowAlerts: true,
    smsTransactional: true,
    marketingPromotions: true,
    eventInvites: true,
    eventReminders: true,
    eventBlasts: false,
    eventUpdates: true,
    feedbackRequests: true,
    guestRegistrations: true,
    feedbackResponses: true,
    newMembers: true,
    eventSubmissions: true,
  },
  privacy: {
    dmPrivacy: 'event',
    showOnlineStatus: true,
    showLastSeen: true,
    publicProfile: true,
    showOnGuestlists: true,
    showEventsAttending: true,
    contactsSyncing: false,
    locationAccess: false,
  },
  appearance: {
    theme: 'dark',
    reduceMotion: false,
    haptics: true,
  },
};

const LOCAL_STORAGE_KEY = '@user_settings';

type SettingsPatch = {
  notifications?: Partial<UserSettings['notifications']>;
  privacy?: Partial<UserSettings['privacy']>;
  appearance?: Partial<UserSettings['appearance']>;
};

type SettingsApiPayload = SettingsPatch & { updatedAt?: string | null };

type SettingsApiResponse = {
  settings?: SettingsApiPayload;
  profile?: { settings?: SettingsApiPayload };
  data?: {
    settings?: SettingsApiPayload;
    profile?: { settings?: SettingsApiPayload };
  };
};

function mergeSettings(base: UserSettings, patch?: SettingsApiPayload | null): UserSettings {
  if (!patch) {
    return {
      ...base,
      notifications: { ...base.notifications },
      privacy: { ...base.privacy },
      appearance: { ...base.appearance },
    };
  }

  return {
    ...base,
    notifications: {
      ...base.notifications,
      ...(patch.notifications || {}),
    },
    privacy: {
      ...base.privacy,
      ...(patch.privacy || {}),
    },
    appearance: {
      ...base.appearance,
      ...(patch.appearance || {}),
    },
  };
}

function normalizeSettings(payload?: SettingsApiPayload | null): UserSettings {
  return mergeSettings(DEFAULT_SETTINGS, payload);
}

function extractSettings(response: SettingsApiResponse): SettingsApiPayload | undefined {
  return (
    response.settings ||
    response.data?.settings ||
    response.profile?.settings ||
    response.data?.profile?.settings
  );
}

async function cacheSettings(settings: UserSettings) {
  await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  syncing: boolean;
  lastSyncedAt: Date | null;

  // Actions
  loadSettings: (userId?: string) => Promise<void>;
  updateSettings: (userId: string | undefined, partial: SettingsPatch) => Promise<void>;
  updateNotificationSetting: (
    userId: string | undefined,
    key: keyof UserSettings['notifications'],
    value: boolean,
  ) => Promise<void>;
  updatePrivacySetting: <K extends keyof UserSettings['privacy']>(
    userId: string | undefined,
    key: K,
    value: UserSettings['privacy'][K],
  ) => Promise<void>;
  updateAppearanceSetting: <K extends keyof UserSettings['appearance']>(
    userId: string | undefined,
    key: K,
    value: UserSettings['appearance'][K],
  ) => Promise<void>;
  syncToBackend: (userId?: string) => Promise<void>;
}

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 500;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,
  syncing: false,
  lastSyncedAt: null,

  loadSettings: async (userId?: string) => {
    set({ loading: true });

    try {
      // First, load from local storage (immediate)
      const localData = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
      if (localData) {
        const parsed = JSON.parse(localData);
        set({ settings: normalizeSettings(parsed) });
      }

      // Then, sync from backend if user is logged in
      if (userId) {
        try {
          const response = await apiFetch<SettingsApiResponse>('/api/v1/users/me/settings');
          const data = extractSettings(response);

          if (data) {
            const merged = normalizeSettings(data);

            set({ settings: merged, lastSyncedAt: new Date() });
            await cacheSettings(merged);
          }
        } catch {
          // Ignore errors — local settings remain in effect
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (userId: string | undefined, partial: SettingsPatch) => {
    // Merge only the new partial into current state
    const currentSettings = get().settings;
    const newSettings = mergeSettings(currentSettings, partial);

    // Optimistic update
    set({ settings: newSettings, syncing: Boolean(userId) });
    await cacheSettings(newSettings);

    if (!userId) return;

    try {
      const response = await apiFetch<SettingsApiResponse>('/api/v1/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify(partial),
        headers: { 'Idempotency-Key': `settings_${userId}_${Date.now()}_${Math.random()}` },
      });
      const savedSettings = extractSettings(response);
      const confirmedSettings = savedSettings ? normalizeSettings(savedSettings) : get().settings;
      set({ settings: confirmedSettings, lastSyncedAt: new Date() });
      await cacheSettings(confirmedSettings);
    } catch (error) {
      console.error('Failed to sync settings to backend:', error);
      // Revert ONLY the fields in partial back to their state before this call
      // to avoid wiping out concurrent optimistic updates.
      set((state) => {
        const revertedSettings = mergeSettings(state.settings, null); // Clone
        if (partial.notifications) {
          for (const k in partial.notifications) {
            // @ts-ignore
            revertedSettings.notifications[k] = currentSettings.notifications[k];
          }
        }
        if (partial.privacy) {
          for (const k in partial.privacy) {
            // @ts-ignore
            revertedSettings.privacy[k] = currentSettings.privacy[k];
          }
        }
        if (partial.appearance) {
          for (const k in partial.appearance) {
            // @ts-ignore
            revertedSettings.appearance[k] = currentSettings.appearance[k];
          }
        }
        cacheSettings(revertedSettings).catch(() => {});
        return { settings: revertedSettings };
      });

      const { Alert } = require('react-native');
      Alert.alert('Sync Error', 'Failed to save settings. Your changes were reverted.');
    } finally {
      set({ syncing: false });
    }
  },

  updateNotificationSetting: async (
    userId: string | undefined,
    key: keyof UserSettings['notifications'],
    value: boolean,
  ) => {
    await get().updateSettings(userId, { notifications: { [key]: value } });
  },

  updatePrivacySetting: async <K extends keyof UserSettings['privacy']>(
    userId: string | undefined,
    key: K,
    value: UserSettings['privacy'][K],
  ) => {
    await get().updateSettings(userId, { privacy: { [key]: value } });
  },

  updateAppearanceSetting: async <K extends keyof UserSettings['appearance']>(
    userId: string | undefined,
    key: K,
    value: UserSettings['appearance'][K],
  ) => {
    await get().updateSettings(userId, { appearance: { [key]: value } });
  },

  syncToBackend: async (userId?: string) => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }

    return new Promise((resolve) => {
      syncDebounceTimer = setTimeout(async () => {
        set({ syncing: true });
        try {
          if (!userId) return;
          const { settings } = get();
          const response = await apiFetch<SettingsApiResponse>('/api/v1/users/me/settings', {
            method: 'PATCH',
            body: JSON.stringify(settings),
            headers: { 'Idempotency-Key': `settings_sync_${userId}_${Date.now()}` },
          });
          const savedSettings = extractSettings(response);
          const confirmedSettings = savedSettings ? normalizeSettings(savedSettings) : settings;
          set({ settings: confirmedSettings, lastSyncedAt: new Date() });
          await cacheSettings(confirmedSettings);
        } catch (error) {
          console.error('Failed to sync settings to backend:', error);
        } finally {
          set({ syncing: false });
          resolve();
        }
      }, SYNC_DEBOUNCE_MS);
    });
  },
}));

// Helper to check if haptics are enabled
export function useHapticsEnabled(): boolean {
  return useSettingsStore((state) => state.settings.appearance.haptics);
}

// Helper to check if reduce motion is enabled
export function useReduceMotion(): boolean {
  return useSettingsStore((state) => state.settings.appearance.reduceMotion);
}

export default useSettingsStore;
