/**
 * Settings Store
 * Centralized settings management with backend sync
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/lib/api";

// Settings interface
export interface UserSettings {
    // Notification preferences
    notifications: {
        tickets: boolean;
        events: boolean;
        chat: boolean;
        dm: boolean;
        promo: boolean;
    };

    // Privacy settings
    privacy: {
        dmPrivacy: "anyone" | "event" | "contacts" | "none";
        showOnlineStatus: boolean;
        showLastSeen: boolean;
    };

    // Appearance
    appearance: {
        theme: "system" | "light" | "dark";
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
    },
    privacy: {
        dmPrivacy: "event",
        showOnlineStatus: true,
        showLastSeen: true,
    },
    appearance: {
        theme: "dark",
        reduceMotion: false,
        haptics: true,
    },
};

const LOCAL_STORAGE_KEY = "@user_settings";

interface SettingsState {
    settings: UserSettings;
    loading: boolean;
    syncing: boolean;
    lastSyncedAt: Date | null;

    // Actions
    loadSettings: (userId?: string) => Promise<void>;
    updateSettings: (userId: string, partial: Partial<UserSettings>) => Promise<void>;
    updateNotificationSetting: (userId: string, key: keyof UserSettings["notifications"], value: boolean) => Promise<void>;
    updatePrivacySetting: (userId: string, key: keyof UserSettings["privacy"], value: any) => Promise<void>;
    updateAppearanceSetting: (key: keyof UserSettings["appearance"], value: any) => Promise<void>;
    syncToBackend: (userId: string) => Promise<void>;
}

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
                set({ settings: { ...DEFAULT_SETTINGS, ...parsed } });
            }

            // Then, sync from backend if user is logged in
            if (userId) {
                try {
                    const data = await apiFetch<UserSettings>('/api/v1/profiles/settings', { requireAuth: true });
                    
                    if (data) {
                        const merged = {
                            ...DEFAULT_SETTINGS,
                            ...data,
                            notifications: { ...DEFAULT_SETTINGS.notifications, ...data.notifications },
                            privacy: { ...DEFAULT_SETTINGS.privacy, ...data.privacy },
                            appearance: { ...DEFAULT_SETTINGS.appearance, ...data.appearance },
                        };

                        set({ settings: merged, lastSyncedAt: new Date() });

                        // Update local storage with backend data
                        await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
                    }
                } catch (e) {
                    // Ignore 404s, user just doesn't have settings yet
                }
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        } finally {
            set({ loading: false });
        }
    },

    updateSettings: async (userId: string, partial: Partial<UserSettings>) => {
        const { settings } = get();
        const newSettings = { ...settings, ...partial };

        // Optimistic update
        set({ settings: newSettings });

        // Save locally
        await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));

        // Sync to backend
        get().syncToBackend(userId);
    },

    updateNotificationSetting: async (userId: string, key: keyof UserSettings["notifications"], value: boolean) => {
        const { settings } = get();
        const newSettings = {
            ...settings,
            notifications: {
                ...settings.notifications,
                [key]: value,
            },
        };

        set({ settings: newSettings });
        await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
        get().syncToBackend(userId);
    },

    updatePrivacySetting: async (userId: string, key: keyof UserSettings["privacy"], value: any) => {
        const { settings } = get();
        const newSettings = {
            ...settings,
            privacy: {
                ...settings.privacy,
                [key]: value,
            },
        };

        set({ settings: newSettings });
        await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
        get().syncToBackend(userId);
    },

    updateAppearanceSetting: async (key: keyof UserSettings["appearance"], value: any) => {
        const { settings } = get();
        const newSettings = {
            ...settings,
            appearance: {
                ...settings.appearance,
                [key]: value,
            },
        };

        set({ settings: newSettings });
        await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
        // Appearance settings are local-only, no backend sync needed
    },

    syncToBackend: async (userId: string) => {
        const { settings, syncing } = get();

        if (syncing) return; // Debounce

        set({ syncing: true });

        try {
            await apiFetch('/api/v1/profiles/settings', {
                method: 'PATCH',
                body: JSON.stringify({
                    settings: {
                        ...settings,
                        updatedAt: new Date().toISOString(),
                    }
                }),
                requireAuth: true
            });

            set({ lastSyncedAt: new Date() });
        } catch (error) {
            console.error("Failed to sync settings to backend:", error);
        } finally {
            set({ syncing: false });
        }
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
