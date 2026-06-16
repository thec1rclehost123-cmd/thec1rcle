/**
 * useSettings Hook
 * Provides access to user settings with automatic sync
 */

import { useEffect } from "react";
import { useSettingsStore, UserSettings } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";

export function useSettings() {
    const { user } = useAuthStore();
    const {
        settings,
        loading,
        syncing,
        lastSyncedAt,
        loadSettings,
        updateNotificationSetting,
        updatePrivacySetting,
        updateAppearanceSetting,
    } = useSettingsStore();

    // Load settings when user changes
    useEffect(() => {
        loadSettings(user?.uid);
    }, [user?.uid, loadSettings]);

    // Wrapper functions that include userId
    const setNotificationSetting = (
        key: keyof UserSettings["notifications"],
        value: boolean
    ) => {
        if (user?.uid) {
            updateNotificationSetting(user.uid, key, value);
        }
    };

    const setPrivacySetting = <K extends keyof UserSettings["privacy"]>(
        key: K,
        value: UserSettings["privacy"][K]
    ) => {
        if (user?.uid) {
            updatePrivacySetting(user.uid, key, value);
        }
    };

    const setAppearanceSetting = <K extends keyof UserSettings["appearance"]>(
        key: K,
        value: UserSettings["appearance"][K]
    ) => {
        updateAppearanceSetting(key, value);
    };

    return {
        // Settings values
        notifications: settings.notifications,
        privacy: settings.privacy,
        appearance: settings.appearance,

        // State
        loading,
        syncing,
        lastSyncedAt,

        // Setters
        setNotificationSetting,
        setPrivacySetting,
        setAppearanceSetting,

        // Raw store access for advanced use
        settings,
    };
}

// Convenience exports
export { useHapticsEnabled, useReduceMotion } from "@/store/settingsStore";
