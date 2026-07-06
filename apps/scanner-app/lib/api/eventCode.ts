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

export async function createStaffSession(
  eventId: string,
  venueId: string,
  userId: string,
  role: string,
): Promise<any> {
  // Deprecated, no-op
  return { valid: true };
}

export async function fetchStaffEvents(venueId: string): Promise<any[]> {
  // If in dev and using the mock developer account, return mock events directly
  if (__DEV__ && venueId === 'venue_NPpsWyAw') {
    return [
      {
        id: 'dev_event_001',
        title: 'EPITOME Bollywood Night',
        venueName: 'EPITOME',
        venueId,
        startDate: new Date().toISOString().split('T')[0],
        startTime: '21:00',
        endTime: '03:00',
        capacity: 500,
      },
      {
        id: 'dev_event_002',
        title: 'Club Alpha Techno Madness',
        venueName: 'Club Alpha',
        venueId,
        startDate: new Date().toISOString().split('T')[0],
        startTime: '22:00',
        endTime: '04:00',
        capacity: 800,
      },
    ];
  }

  try {
    // Fetch events using the unified Partner Dashboard endpoint
    const res = await scannerFetch(
      `/partners/venues/events?venueId=${encodeURIComponent(venueId)}`,
      {},
    );
    return res.events || [];
  } catch (error: any) {
    console.error('[fetchStaffEvents] Error:', error);
    throw error;
  }
}
