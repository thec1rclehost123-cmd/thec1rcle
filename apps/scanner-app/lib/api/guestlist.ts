import { scannerFetch } from './client';
import { getActiveCode } from './eventCode';

export interface Guest {
  id: string;
  name: string;
  ticketType: string;
  entryType: string;
  quantity: number;
  source: 'online' | 'door';
  status: 'entered' | 'not_entered';
  enteredAt?: string;
}

/**
 * Fetch the merged guestlist (ticket orders + door entries) for an event.
 */
export async function fetchGuestList(eventId: string, eventCode: string): Promise<Guest[]> {
  const code = (await getActiveCode()) || eventCode;

  try {
    const data = await scannerFetch(
      `/api/scanner/guestlist?eventId=${encodeURIComponent(eventId)}`,
      {},
      code,
    );
    return data.guests || [];
  } catch (error: any) {
    console.error('[fetchGuestList] Error:', error);

    if (__DEV__) {
      return getMockGuests();
    }

    return [];
  }
}

/**
 * Client-side name/type search over an already-fetched guest list.
 */
export async function searchGuests(
  eventId: string,
  eventCode: string,
  query: string,
): Promise<Guest[]> {
  const guests = await fetchGuestList(eventId, eventCode);
  const lower = query.toLowerCase();
  return guests.filter((g) => g.name.toLowerCase().includes(lower));
}

function getMockGuests(): Guest[] {
  const names = [
    'Arjun Sharma',
    'Priya Patel',
    'Rahul Verma',
    'Ananya Singh',
    'Vikram Kapoor',
    'Neha Gupta',
    'Rohan Malhotra',
    'Kavya Reddy',
  ];
  return names.map((name, i) => ({
    id: `dev_${i}`,
    name,
    ticketType: i % 2 === 0 ? 'Stag Entry' : 'Couple Entry',
    entryType: i % 2 === 0 ? 'stag' : 'couple',
    quantity: i % 2 === 0 ? 1 : 2,
    source: i === 7 ? 'door' : 'online',
    status: i < 5 ? 'entered' : 'not_entered',
    enteredAt: i < 5 ? new Date(Date.now() - i * 600000).toISOString() : undefined,
  }));
}
