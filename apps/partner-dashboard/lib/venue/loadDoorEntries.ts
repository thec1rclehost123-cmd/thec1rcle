export type VenueDoorEntriesPayload = {
  walkIns: Record<string, unknown>[];
  dineIns: Record<string, unknown>[];
};

type LoadVenueDoorEntriesInput = {
  venueId: string;
  eventId?: string | null;
  token: string;
  fetcher?: typeof fetch;
};

export async function loadVenueDoorEntries({
  venueId,
  eventId,
  token,
  fetcher = fetch,
}: LoadVenueDoorEntriesInput): Promise<VenueDoorEntriesPayload> {
  const params = new URLSearchParams({ venueId, limit: '100' });
  if (eventId) params.set('eventId', eventId);
  const headers = { Authorization: `Bearer ${token}` };
  const [walkInsResponse, dineInsResponse] = await Promise.all([
    fetcher(`/api/partners/venues/walk-ins?${params.toString()}`, { headers }),
    fetcher(`/api/partners/venues/door/dinein?${params.toString()}`, { headers }),
  ]);
  const [walkInsPayload, dineInsPayload] = await Promise.all([
    walkInsResponse.json().catch(() => ({})),
    dineInsResponse.json().catch(() => ({})),
  ]);
  if (!walkInsResponse.ok) {
    throw new Error((walkInsPayload as any)?.error?.message || 'Failed to load walk-ins');
  }
  if (!dineInsResponse.ok) {
    throw new Error((dineInsPayload as any)?.error?.message || 'Failed to load dine-ins');
  }
  return {
    walkIns: Array.isArray((walkInsPayload as any).entries) ? (walkInsPayload as any).entries : [],
    dineIns: Array.isArray((dineInsPayload as any).entries) ? (dineInsPayload as any).entries : [],
  };
}
