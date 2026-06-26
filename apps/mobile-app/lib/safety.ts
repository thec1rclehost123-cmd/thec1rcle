// Safety features - Location sharing, SOS via API Gateway
import * as Location from 'expo-location';
import { apiFetch } from '@/lib/api';
import { scheduleLocalNotification } from './notifications';
import { Linking, Alert } from 'react-native';

export interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  relationship?: string;
}

export async function getEmergencyContacts(uid: string): Promise<EmergencyContact[]> {
  try {
    const response = await apiFetch<any>('/api/v1/users/me', { requireAuth: true });
    const profile = response.profile || response.data?.profile || response;
    return (profile?.emergencyContacts as EmergencyContact[]) ?? [];
  } catch (error) {
    if (__DEV__) console.error('Error fetching emergency contacts:', error);
    return [];
  }
}

export async function saveEmergencyContacts(
  uid: string,
  contacts: EmergencyContact[],
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiFetch('/api/v1/users/me', {
      method: 'PUT',
      body: JSON.stringify({ emergencyContacts: contacts }),
      requireAuth: true,
    });
    return { success: true };
  } catch (error: any) {
    if (__DEV__) console.error('Error saving emergency contacts:', error);
    return { success: false, error: error.message };
  }
}

// Location sharing session
export interface LocationSession {
  id: string;
  userId: string;
  eventId?: string;
  sharedWith: string[];
  location: {
    latitude: number;
    longitude: number;
  };
  lastUpdate: string;
  expiresAt: string;
  isActive: boolean;
}

// Request location permissions
export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    Alert.alert(
      'Location Permission Required',
      'Please enable location access to use safety features',
    );
    return false;
  }

  return true;
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
    if (__DEV__) console.error('Error getting location:', error);
    return null;
  }
}

// Start sharing location via Gateway
export async function startLocationSharing(
  userId: string,
  eventId?: string,
  durationHours: number = 4,
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const location = await getCurrentLocation();
    if (!location) return { success: false, error: 'Could not get location' };

    const response = await apiFetch<any>('/api/v1/social/location/start', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        latitude: location.latitude,
        longitude: location.longitude,
        durationHours,
      }),
      requireAuth: true,
    });

    return { success: true, sessionId: response.sessionId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Update location via Gateway
export async function updateSharedLocation(
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const location = await getCurrentLocation();
    if (!location) return { success: false, error: 'Could not get location' };

    await apiFetch(`/api/v1/social/location/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
      }),
      requireAuth: true,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Stop sharing location via Gateway
export async function stopLocationSharing(
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/social/location/${sessionId}/stop`, {
      method: 'POST',
      requireAuth: true,
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Subscribe to friend's location via Polling
export function subscribeToFriendLocation(
  sessionId: string,
  onUpdate: (location: { latitude: number; longitude: number } | null) => void,
): () => void {
  let active = true;

  async function poll() {
    if (!active) return;
    try {
      const session = await apiFetch<LocationSession>(`/api/v1/social/location/${sessionId}`, {
        requireAuth: true,
      });
      if (active && session?.isActive) {
        onUpdate(session.location);
      } else {
        onUpdate(null);
      }
    } catch {
      onUpdate(null);
    }
  }

  poll();
  const intervalId = setInterval(poll, 10000); // 10s polling

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

// Trigger SOS via Gateway
export async function triggerSOS(
  userId: string,
  eventId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const location = await getCurrentLocation();

    // Register SOS in Gateway
    await apiFetch('/api/v1/social/sos', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        latitude: location?.latitude,
        longitude: location?.longitude,
      }),
      requireAuth: true,
    });

    const contacts = await getEmergencyContacts(userId);

    if (contacts.length > 0) {
      const message = encodeURIComponent(
        `🆘 SOS ALERT!\n` +
          (location
            ? `📍 Location: https://maps.google.com/?q=${location.latitude},${location.longitude}`
            : 'Location unavailable'),
      );
      await Linking.openURL(`sms:${contacts[0].phone}?body=${message}`);
    }

    await scheduleLocalNotification('SOS Alert Sent', 'Emergency contacts have been notified.', {
      type: 'sos_sent',
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Safe ride home
export async function requestSafeRide(service: 'uber' | 'ola' | 'rapido'): Promise<void> {
  const urls = { uber: 'uber://', ola: 'olacabs://', rapido: 'rapido://' };
  const fallbacks = {
    uber: 'https://m.uber.com',
    ola: 'https://book.olacabs.com',
    rapido: 'https://www.rapido.bike',
  };

  try {
    const canOpen = await Linking.canOpenURL(urls[service]);
    await Linking.openURL(canOpen ? urls[service] : fallbacks[service]);
  } catch {
    await Linking.openURL(fallbacks[service]);
  }
}
