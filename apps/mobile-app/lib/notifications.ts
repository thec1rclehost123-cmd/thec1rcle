// Push notifications service
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';

const PUSH_TOKEN_KEY = '@c1rcle/pushToken';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    if (__DEV__) console.log('Push notifications only work on physical devices');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6D5DF6',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('Failed to get push notification permissions');
    return false;
  }

  return true;
}

function getEasProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_PROJECT_ID
  );
}

export type PushTokenResult =
  | { token: string }
  | { error: 'permission_denied' }
  | { error: 'no_project_id' }
  | { error: 'system_error'; message: string };

// Get Expo push token
export async function getExpoPushToken(): Promise<PushTokenResult | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return { error: 'permission_denied' };

    const projectId = getEasProjectId();
    if (!projectId) return { error: 'no_project_id' };

    const result = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return { token: result.data };
  } catch (error) {
    if (__DEV__) console.error('Error getting push token:', error);
    return { error: 'system_error', message: String(error) };
  }
}

async function sendDeviceTokenToGateway(token: string): Promise<void> {
  await apiFetch('/api/v1/users/me/device-token', {
    method: 'POST',
    body: JSON.stringify({
      token,
      provider: 'expo',
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
      deviceId: `${Platform.OS}-${Device.osBuildId || Device.modelId || 'unknown'}`,
      projectId: getEasProjectId(),
      appVersion: Constants.expoConfig?.version || 'unknown',
    }),
    requireAuth: true,
  });
}

// Register push token with user profile — via API gateway
export async function registerPushToken(userId: string): Promise<boolean> {
  try {
    const result = await getExpoPushToken();
    if (!result || 'error' in result) {
      if (result && result.error === 'permission_denied') {
        if (__DEV__) console.log('Push notification permission not granted');
      }
      return false;
    }

    await sendDeviceTokenToGateway(result.token);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, result.token);

    return true;
  } catch (error) {
    if (__DEV__) console.error('Error registering push token:', error);
    return false;
  }
}

// Schedule local notification
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  trigger?: Notifications.NotificationTriggerInput,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger || null, // null = immediate
  });

  return id;
}

// Schedule event reminder
export async function scheduleEventReminder(
  eventId: string,
  eventTitle: string,
  eventDate: Date,
  hoursBeforeEvent: number = 1,
): Promise<string | null> {
  const reminderTime = new Date(eventDate.getTime() - hoursBeforeEvent * 60 * 60 * 1000);

  if (reminderTime <= new Date()) {
    return null;
  }

  const id = await scheduleLocalNotification(
    `${eventTitle} starts soon!`,
    `Your event starts in ${hoursBeforeEvent} hour${hoursBeforeEvent > 1 ? 's' : ''}. Get ready!`,
    { eventId, type: 'event_reminder' },
    {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderTime,
    },
  );

  return id;
}

// Cancel scheduled notification
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Cancel all notifications for an event
export async function cancelEventNotifications(eventId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduled) {
    if (notification.content.data?.eventId === eventId) {
      await cancelNotification(notification.identifier);
    }
  }
}

// Handle notification received while app is foregrounded
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

// Handle notification tap (user interaction)
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

// Get badge count
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

// Set badge count
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Refresh push token — only writes to API if the token has changed since
 * the last registration. Safe to call on every foreground resume and auth change.
 */
export async function refreshPushToken(userId: string): Promise<void> {
  try {
    const result = await getExpoPushToken();
    if (!result || 'error' in result) return;

    const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (storedToken === result.token) return;

    await sendDeviceTokenToGateway(result.token);

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, result.token);
  } catch (error) {
    if (__DEV__) console.error('Error refreshing push token:', error);
  }
}
