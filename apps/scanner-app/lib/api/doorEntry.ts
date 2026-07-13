import { scannerFetch } from './client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EventCapacity {
  total: number;
  soldCount: number;
  doorWalkInCount: number;
  available: number;
  isSoldOut: boolean;
  currentCount: number;
  capacityPercentage: number;
  availabilityMessage: string;
  isNearCapacity: boolean;
}

export interface DoorEntryRequest {
  eventId: string;
  venueId: string;
  guestName: string;
  contact?: string; // 10-digit
  email?: string;
  age?: number;
  partySize?: number;
  totalGuests?: number;
  gender?: string | null;
  purpose: 'party' | 'dinein';
  idempotencyKey: string;
}

export interface DoorEntryResponse {
  success: boolean;
  entryId?: string;
  purpose?: string;
  remainingCapacity?: number;
  error?: string;
}

export interface WalkInEntry {
  id: string;
  eventId: string;
  venueId: string;
  guestName: string;
  age?: number | null;
  contact?: string | null;
  gender?: string | null;
  totalGuests?: number;
  addedAt: string;
}

export interface DineInEntry {
  id: string;
  eventId: string;
  venueId: string;
  guestName: string;
  totalGuests: number;
  gender: string;
  age: number;
  contact?: string | null;
  addedAt: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

// No scan-level capacity endpoint exists; UI handles null gracefully.
export async function fetchCapacity(
  _eventId: string,
  _venueId: string,
): Promise<EventCapacity | null> {
  return null;
}

export async function submitDoorEntry(request: DoorEntryRequest): Promise<DoorEntryResponse> {
  try {
    if (request.purpose === 'dinein') {
      const data = await scannerFetch(
        `/venue/door/dinein?venueId=${encodeURIComponent(request.venueId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            eventId: request.eventId,
            venueId: request.venueId,
            guestName: request.guestName,
            totalGuests: request.partySize || 1,
            gender: request.gender || 'male',
            age: request.age || 0,
            contact: request.contact || '',
          }),
        },
      );
      return { success: true, entryId: data.id, purpose: 'dinein' };
    }

    // walk-in (party)
    const data = await scannerFetch(
      `/venue/walk-ins?venueId=${encodeURIComponent(request.venueId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          eventId: request.eventId,
          venueId: request.venueId,
          guestName: request.guestName,
          contact: request.contact || '',
          age: request.age || 0,
          gender: request.gender || 'male',
          totalGuests: 1,
        }),
      },
    );
    return { success: true, entryId: data.id, purpose: 'party' };
  } catch (error: any) {
    console.error('[submitDoorEntry] Error:', error);
    return {
      success: false,
      error:
        error.data?.error?.message ||
        error.data?.error ||
        error.message ||
        'Failed to submit entry',
    };
  }
}

// second param is eventCode (caller passes eventData.code which is 'STAFF')
export async function fetchWalkIns(
  eventId: string,
  eventCode: string,
  venueId: string,
): Promise<WalkInEntry[]> {
  try {
    const data = await scannerFetch(
      `/venue/walk-ins?eventId=${encodeURIComponent(eventId)}&venueId=${encodeURIComponent(venueId)}&limit=200`,
      {},
    );
    const entries = data.entries ?? [];
    return entries.map((e: any) => ({
      id: e.id,
      eventId: e.eventId,
      venueId: e.venueId,
      guestName: e.guestName,
      contact: e.contact,
      gender: e.gender,
      age: e.age,
      addedAt: e.addedAt,
      totalGuests: e.totalGuests || 1,
    }));
  } catch (error) {
    console.error('[fetchWalkIns] Error:', error);
    return [];
  }
}

export async function fetchDineIns(venueId: string): Promise<DineInEntry[]> {
  try {
    const data = await scannerFetch(
      `/venue/door/dinein?venueId=${encodeURIComponent(venueId)}&limit=200`,
      {},
    );
    const entries = data.entries ?? [];
    return entries.map((e: any) => ({
      id: e.id,
      eventId: e.eventId,
      venueId: e.venueId,
      guestName: e.guestName,
      totalGuests: e.totalGuests || 1,
      gender: e.gender ?? 'male',
      age: e.age ?? 0,
      contact: e.contact,
      addedAt: e.addedAt,
    }));
  } catch (error) {
    console.error('[fetchDineIns] Error:', error);
    return [];
  }
}
