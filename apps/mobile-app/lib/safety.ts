// Safety features - Location sharing, SOS, Party Buddy
import * as Location from "expo-location";
import {
    doc,
    updateDoc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    serverTimestamp,
    GeoPoint,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { scheduleLocalNotification } from "./notifications";
import { Linking, Alert } from "react-native";

// Location sharing session
export interface LocationSession {
    id: string;
    userId: string;
    eventId?: string;
    sharedWith: string[]; // User IDs
    location: {
        latitude: number;
        longitude: number;
    };
    lastUpdate: any;
    expiresAt: any;
    isActive: boolean;
}

// Request location permissions
export async function requestLocationPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== "granted") {
        Alert.alert(
            "Location Permission Required",
            "Please enable location access to use safety features",
            [{ text: "OK" }]
        );
        return false;
    }

    // Request background location for continuous sharing
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    return foregroundStatus === "granted";
}

// Get current location
export async function getCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
} | null> {
    try {
        const hasPermission = await requestLocationPermissions();
        if (!hasPermission) return null;

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
    } catch (error) {
        console.error("Error getting location:", error);
        return null;
    }
}

// Start sharing location
export async function startLocationSharing(
    userId: string,
    eventId?: string,
    durationHours: number = 4
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
        const location = await getCurrentLocation();
        if (!location) {
            return { success: false, error: "Could not get location" };
        }

        const db = getFirebaseDb();
        const sessionId = `loc_${userId}_${Date.now()}`;
        const sessionRef = doc(db, "locationSessions", sessionId);

        await setDoc(sessionRef, {
            id: sessionId,
            userId,
            eventId: eventId || null,
            sharedWith: [],
            location: new GeoPoint(location.latitude, location.longitude),
            lastUpdate: serverTimestamp(),
            expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
            isActive: true,
            createdAt: serverTimestamp(),
        });

        return { success: true, sessionId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Update location in active session
export async function updateSharedLocation(
    sessionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const location = await getCurrentLocation();
        if (!location) {
            return { success: false, error: "Could not get location" };
        }

        const db = getFirebaseDb();
        const sessionRef = doc(db, "locationSessions", sessionId);

        await updateDoc(sessionRef, {
            location: new GeoPoint(location.latitude, location.longitude),
            lastUpdate: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Stop sharing location
export async function stopLocationSharing(
    sessionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const sessionRef = doc(db, "locationSessions", sessionId);

        await updateDoc(sessionRef, {
            isActive: false,
            endedAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Add friend to location sharing
export async function shareLocationWith(
    sessionId: string,
    friendUserId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const sessionRef = doc(db, "locationSessions", sessionId);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists()) {
            return { success: false, error: "Session not found" };
        }

        const currentShared = sessionDoc.data().sharedWith || [];

        await updateDoc(sessionRef, {
            sharedWith: [...new Set([...currentShared, friendUserId])],
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Subscribe to friend's location
export function subscribeToFriendLocation(
    sessionId: string,
    onUpdate: (location: { latitude: number; longitude: number } | null) => void
): () => void {
    const db = getFirebaseDb();
    const sessionRef = doc(db, "locationSessions", sessionId);

    return onSnapshot(sessionRef, (snapshot) => {
        if (snapshot.exists() && snapshot.data().isActive) {
            const geoPoint = snapshot.data().location;
            onUpdate({
                latitude: geoPoint.latitude,
                longitude: geoPoint.longitude,
            });
        } else {
            onUpdate(null);
        }
    });
}

// Emergency contacts
export interface EmergencyContact {
    id: string;
    name: string;
    phone: string;
    relationship: string;
}

// Save emergency contacts
export async function saveEmergencyContacts(
    userId: string,
    contacts: EmergencyContact[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const userRef = doc(db, "users", userId);

        await updateDoc(userRef, {
            emergencyContacts: contacts,
            updatedAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Get emergency contacts
export async function getEmergencyContacts(
    userId: string
): Promise<EmergencyContact[]> {
    try {
        const db = getFirebaseDb();
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            return userDoc.data().emergencyContacts || [];
        }
        return [];
    } catch (error) {
        console.error("Error getting emergency contacts:", error);
        return [];
    }
}

// Trigger SOS
export async function triggerSOS(
    userId: string,
    eventId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get current location
        const location = await getCurrentLocation();

        // Get emergency contacts
        const contacts = await getEmergencyContacts(userId);

        if (contacts.length === 0) {
            Alert.alert(
                "No Emergency Contacts",
                "Please add emergency contacts in your profile settings"
            );
            return { success: false, error: "No emergency contacts" };
        }

        // Get user info
        const db = getFirebaseDb();
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        const userName = userDoc.exists() ? userDoc.data().displayName || "A friend" : "A friend";

        // Create SOS alert in database
        const sosRef = await setDoc(doc(collection(db, "sosAlerts")), {
            userId,
            eventId: eventId || null,
            location: location ? new GeoPoint(location.latitude, location.longitude) : null,
            locationUrl: location
                ? `https://maps.google.com/?q=${location.latitude},${location.longitude}`
                : null,
            contacts: contacts.map(c => c.phone),
            status: "triggered",
            triggeredAt: serverTimestamp(),
        });

        // Send SMS to emergency contacts (via backend)
        // For now, open default SMS app
        const message = encodeURIComponent(
            `🆘 SOS ALERT from ${userName}!\n\n` +
            `They may need help.\n` +
            (location
                ? `📍 Location: https://maps.google.com/?q=${location.latitude},${location.longitude}`
                : "Location unavailable")
        );

        // Open SMS to first contact
        const firstContact = contacts[0];
        await Linking.openURL(`sms:${firstContact.phone}?body=${message}`);

        // Show local notification
        await scheduleLocalNotification(
            "SOS Alert Sent",
            `Alert sent to ${contacts.length} emergency contact(s)`,
            { type: "sos_sent" }
        );

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Party Buddy - Connect with friend at event
export interface PartyBuddy {
    id: string;
    eventId: string;
    userId: string;
    buddyUserId: string;
    status: "pending" | "accepted" | "active" | "ended";
    checkInInterval: number; // minutes
    lastCheckIn?: any;
    nextCheckInDue?: any;
}

// Request party buddy
export async function requestPartyBuddy(
    userId: string,
    buddyUserId: string,
    eventId: string,
    checkInInterval: number = 30
): Promise<{ success: boolean; buddyId?: string; error?: string }> {
    try {
        const db = getFirebaseDb();
        const buddyId = `buddy_${eventId}_${userId}_${buddyUserId}`;
        const buddyRef = doc(db, "partyBuddies", buddyId);

        await setDoc(buddyRef, {
            id: buddyId,
            eventId,
            userId,
            buddyUserId,
            status: "pending",
            checkInInterval,
            createdAt: serverTimestamp(),
        });

        return { success: true, buddyId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Check in with party buddy
export async function checkInWithBuddy(
    buddyId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const buddyRef = doc(db, "partyBuddies", buddyId);
        const buddyDoc = await getDoc(buddyRef);

        if (!buddyDoc.exists()) {
            return { success: false, error: "Buddy session not found" };
        }

        const interval = buddyDoc.data().checkInInterval;
        const nextDue = new Date(Date.now() + interval * 60 * 1000);

        await updateDoc(buddyRef, {
            lastCheckIn: serverTimestamp(),
            nextCheckInDue: nextDue,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Safe ride home - call ride service
export async function requestSafeRide(
    service: "uber" | "ola" | "rapido"
): Promise<void> {
    const urls = {
        uber: "uber://",
        ola: "olacabs://",
        rapido: "rapido://",
    };

    const fallbackUrls = {
        uber: "https://m.uber.com",
        ola: "https://book.olacabs.com",
        rapido: "https://www.rapido.bike",
    };

    try {
        const canOpen = await Linking.canOpenURL(urls[service]);
        if (canOpen) {
            await Linking.openURL(urls[service]);
        } else {
            await Linking.openURL(fallbackUrls[service]);
        }
    } catch (error) {
        await Linking.openURL(fallbackUrls[service]);
    }
}
