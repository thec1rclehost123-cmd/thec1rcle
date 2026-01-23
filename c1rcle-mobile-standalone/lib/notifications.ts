// Push notifications service
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
        console.log("Push notifications only work on physical devices");
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== "granted") {
        console.log("Failed to get push notification permissions");
        return false;
    }

    return true;
}

// Get Expo push token
export async function getExpoPushToken(): Promise<string | null> {
    try {
        const hasPermission = await requestNotificationPermissions();
        if (!hasPermission) return null;

        // Get project ID from app config
        const token = await Notifications.getExpoPushTokenAsync({
            projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });

        return token.data;
    } catch (error) {
        console.error("Error getting push token:", error);
        return null;
    }
}

// Register push token with user profile
export async function registerPushToken(userId: string): Promise<boolean> {
    try {
        const token = await getExpoPushToken();
        if (!token) return false;

        const db = getFirebaseDb();
        const userRef = doc(db, "users", userId);

        await updateDoc(userRef, {
            pushTokens: arrayUnion(token),
            lastTokenUpdate: new Date().toISOString(),
        });

        return true;
    } catch (error) {
        console.error("Error registering push token:", error);
        return false;
    }
}

// Schedule local notification
export async function scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    trigger?: Notifications.NotificationTriggerInput
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
    hoursBeforeEvent: number = 1
): Promise<string | null> {
    const reminderTime = new Date(eventDate.getTime() - hoursBeforeEvent * 60 * 60 * 1000);

    // Don't schedule if reminder time has passed
    if (reminderTime <= new Date()) {
        return null;
    }

    const id = await scheduleLocalNotification(
        `🎉 ${eventTitle} starts soon!`,
        `Your event starts in ${hoursBeforeEvent} hour${hoursBeforeEvent > 1 ? "s" : ""}. Get ready!`,
        { eventId, type: "event_reminder" },
        { date: reminderTime }
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
    handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(handler);
}

// Handle notification tap (user interaction)
export function addNotificationResponseListener(
    handler: (response: Notifications.NotificationResponse) => void
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
