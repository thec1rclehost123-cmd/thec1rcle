import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { scannerFetch } from './client';

import { auth } from '../firebase';
import { EventData } from '@/store/eventContext';

const SCANNER_CODE_KEY = 'scanner_active_code';

export async function getActiveCode(): Promise<string | null> {
  return null;
}

export async function clearActiveCode(): Promise<void> {
  // Deprecated, no-op
}

// Validate code, stats, and mock events were removed as they are deprecated.

export interface StaffLoginResponse {
  success: boolean;
  userId: string;
  venueId: string;
  role: string;
  error?: string;
}

export async function loginStaff(email: string, password: string): Promise<StaffLoginResponse> {
  // Allow developer mock login with bypass credentials in development
  if (__DEV__ && email.trim().toLowerCase() === 'mock@c1rcle.com') {
    return {
      success: true,
      userId: 'dev_staff_001',
      venueId: 'venue_NPpsWyAw',
      role: 'DOOR',
    };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password,
    );
    const idToken = await userCredential.user.getIdToken(true);

    const res = await scannerFetch('/scan/staff-login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    return {
      success: true,
      userId: res.userId,
      venueId: res.venueId,
      role: res.role || 'DOOR',
    };
  } catch (error: any) {
    console.error('[loginStaff] Error:', error);
    throw new Error(error.message || 'Unable to sign in');
  }
}

export async function verifyStaffSession(idToken: string): Promise<StaffLoginResponse> {
  try {
    const res = await scannerFetch('/scan/staff-login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    return {
      success: true,
      userId: res.userId,
      venueId: res.venueId,
      role: res.role || 'DOOR',
    };
  } catch (error: any) {
    console.error('[verifyStaffSession] Error:', error);
    throw new Error(error.message || 'Session verification failed');
  }
}

/**
 * Fetch today's events for a venue (used by staff on the scanner app).
 * Authenticates via Firebase ID token attached by scannerFetch automatically.
 * @param venueId  The venue to fetch events for
 */
export async function fetchStaffEvents(venueId: string): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  const data = await scannerFetch(
    `/scan/events?venueId=${encodeURIComponent(venueId)}&date=${today}`,
  );
  return Array.isArray(data?.events) ? data.events : [];
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
