/**
 * useSettings Hook
 * Provides access to user settings with automatic sync
 */

import { useEffect } from 'react';
import { useSettingsStore, UserSettings } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

export function useSettings() {
  const user = useAuthStore((state) => state.user);
  const settings = useSettingsStore((state) => state.settings);
  const loading = useSettingsStore((state) => state.loading);
  const syncing = useSettingsStore((state) => state.syncing);
  const lastSyncedAt = useSettingsStore((state) => state.lastSyncedAt);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const updateNotificationSetting = useSettingsStore((state) => state.updateNotificationSetting);
  const updatePrivacySetting = useSettingsStore((state) => state.updatePrivacySetting);
  const updateAppearanceSetting = useSettingsStore((state) => state.updateAppearanceSetting);

  // Load settings when user changes
  useEffect(() => {
    loadSettings(user?.uid);
  }, [user?.uid, loadSettings]);

  // Wrapper functions that include userId
  const setNotificationSetting = (key: keyof UserSettings['notifications'], value: boolean) => {
    updateNotificationSetting(user?.uid, key, value);
  };

  const setPrivacySetting = <K extends keyof UserSettings['privacy']>(
    key: K,
    value: UserSettings['privacy'][K],
  ) => {
    updatePrivacySetting(user?.uid, key, value);
  };

  const setAppearanceSetting = <K extends keyof UserSettings['appearance']>(
    key: K,
    value: UserSettings['appearance'][K],
  ) => {
    updateAppearanceSetting(user?.uid, key, value);
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
export { useHapticsEnabled, useReduceMotion } from '@/store/settingsStore';
