import AsyncStorage from '@react-native-async-storage/async-storage';
import { scannerFetch } from './client';
import { EventData } from '@/store/eventContext';

const SCANNER_CODE_KEY = 'scanner_active_code';

/** Persist the active scanner code so all other API calls can retrieve it. */
export async function saveActiveCode(code: string): Promise<void> {
  await AsyncStorage.setItem(SCANNER_CODE_KEY, code);
}

/** Retrieve the currently active scanner code. */
export async function getActiveCode(): Promise<string | null> {
  return AsyncStorage.getItem(SCANNER_CODE_KEY);
}

/** Clear the active scanner code (on sign-out or expiry). */
export async function clearActiveCode(): Promise<void> {
  await AsyncStorage.removeItem(SCANNER_CODE_KEY);
}

/**
 * Validate an event code against the backend.
 * On success, persists the code to AsyncStorage for subsequent API calls.
 */
export async function validateEventCode(
  code: string,
): Promise<EventData & { valid: boolean; error?: string }> {
  try {
    const data = await scannerFetch('/api/scanner/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });

    if (data.valid) {
      await saveActiveCode(code);
    }

    return { valid: !!data.valid, code, ...data };
  } catch (error: any) {
    console.error('[validateEventCode] Error:', error);

    // In dev mode, return mock data so the app is usable without a running backend
    if (__DEV__) {
      await saveActiveCode(code);
      return getMockEventData(code);
    }

    throw new Error(error.message || 'Unable to connect to server');
  }
}

/**
 * Refresh live event stats for the stats screen pull-to-refresh.
 * @param eventId  The actual Firestore event document ID
 * @param code     The scanner session code (optional — falls back to stored code)
 */
export async function refreshEventStats(eventId: string, code?: string): Promise<any> {
  try {
    const activeCode = code || (await getActiveCode()) || '';
    return await scannerFetch(
      `/api/scanner/stats?eventId=${encodeURIComponent(eventId)}`,
      {},
      activeCode,
    );
  } catch (error) {
    console.error('[refreshEventStats] Error:', error);
    return null;
  }
}

function getMockEventData(code: string): EventData & { valid: boolean } {
  return {
    valid: true,
    code,
    event: {
      id: 'dev_event_001',
      title: 'Dev Night — Test Event',
      venue: 'Club Dev',
      venueId: 'dev_venue_001',
      date: new Date().toISOString().split('T')[0],
      startTime: '22:00',
      endTime: '04:00',
      capacity: 500,
    },
    permissions: { canScan: true, canDoorEntry: true },
    tiers: [
      { id: 'stag', name: 'Stag Entry', price: 500, entryType: 'stag', available: true },
      { id: 'couple', name: 'Couple Entry', price: 800, entryType: 'couple', available: true },
      { id: 'vip', name: 'VIP Entry', price: 2000, entryType: 'vip', available: true },
    ],
    gate: 'Main Gate',
    stats: { totalEntered: 0, prebooked: 0, doorEntries: 0, doorRevenue: 0 },
  };
}
