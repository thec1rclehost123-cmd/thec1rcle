import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Linking, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_LOCATION_PROMPT_KEY = 'c1rcle_last_location_prompt';
const LAST_NOTIFICATION_PROMPT_KEY = 'c1rcle_last_notification_prompt';
const LOCATION_PROMPT_COUNT_KEY = 'c1rcle_location_prompt_count';
const NOTIFICATION_PROMPT_COUNT_KEY = 'c1rcle_notification_prompt_count';

const MAX_PROMPTS = 3;
const RE_PROMPT_DAYS = 7;

function scopedKey(baseKey: string, userId?: string) {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

async function getDate(key: string, userId?: string): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(scopedKey(key, userId));
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

async function setDate(key: string, userId?: string) {
  try {
    await AsyncStorage.setItem(scopedKey(key, userId), String(Date.now()));
  } catch {}
}

async function getCount(key: string, userId?: string): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(scopedKey(key, userId));
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

async function incrementCount(key: string, userId?: string) {
  try {
    const current = await getCount(key, userId);
    await AsyncStorage.setItem(scopedKey(key, userId), String(current + 1));
  } catch {}
}

export async function shouldPromptForLocation(userId?: string): Promise<boolean> {
  const isGranted = await checkLocationSystemPermission();
  if (isGranted) return false;

  const count = await getCount(LOCATION_PROMPT_COUNT_KEY, userId);
  if (count >= MAX_PROMPTS) return false;

  const last = await getDate(LAST_LOCATION_PROMPT_KEY, userId);
  if (!last) return true;

  const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return daysSince >= RE_PROMPT_DAYS;
}

export async function shouldPromptForNotifications(userId?: string): Promise<boolean> {
  const isGranted = await checkNotificationSystemPermission();
  if (isGranted) return false;

  const count = await getCount(NOTIFICATION_PROMPT_COUNT_KEY, userId);
  if (count >= MAX_PROMPTS) return false;

  const last = await getDate(LAST_NOTIFICATION_PROMPT_KEY, userId);
  if (!last) return true;

  const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return daysSince >= RE_PROMPT_DAYS;
}

export async function recordLocationPrompt(userId?: string) {
  await setDate(LAST_LOCATION_PROMPT_KEY, userId);
  await incrementCount(LOCATION_PROMPT_COUNT_KEY, userId);
}

export async function recordNotificationPrompt(userId?: string) {
  await setDate(LAST_NOTIFICATION_PROMPT_KEY, userId);
  await incrementCount(NOTIFICATION_PROMPT_COUNT_KEY, userId);
}

export async function getLocationPromptCount(userId?: string): Promise<number> {
  return getCount(LOCATION_PROMPT_COUNT_KEY, userId);
}

export async function getNotificationPromptCount(userId?: string): Promise<number> {
  return getCount(NOTIFICATION_PROMPT_COUNT_KEY, userId);
}

export function openSystemSettings() {
  Linking.openSettings();
}

export async function checkLocationSystemPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

export async function checkNotificationSystemPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export function showSettingsAlert(title: string, message: string) {
  Alert.alert(
    title,
    message,
    [
      { text: 'Not Now', style: 'cancel' },
      { text: 'Open Settings', onPress: openSystemSettings },
    ],
  );
}
