export type HostVenueCalendarQuery = {
  venueId: string;
  startDate: string;
  endDate: string;
  view?: string;
};

export function buildHostVenueCalendarUrl({
  venueId,
  startDate,
  endDate,
  view = 'operating',
}: HostVenueCalendarQuery): string {
  const params = new URLSearchParams({
    venueId,
    startDate,
    endDate,
    view,
  });
  return `/api/partners/hosts/venue-calendar?${params.toString()}`;
}

export function getHostVenueCalendarDays(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as { calendar?: unknown; days?: unknown };
  if (Array.isArray(record.calendar)) return record.calendar;
  if (Array.isArray(record.days)) return record.days;
  return [];
}

function toNightlifeMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  const minutes = hour * 60 + minute;
  return hour < 12 ? minutes + 24 * 60 : minutes;
}

export function nightlifeTimeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  if (![startA, endA, startB, endB].every((value) => /^\d{2}:\d{2}$/.test(value))) {
    return true;
  }
  const normalizedStartA = toNightlifeMinutes(startA);
  let normalizedEndA = toNightlifeMinutes(endA);
  const normalizedStartB = toNightlifeMinutes(startB);
  let normalizedEndB = toNightlifeMinutes(endB);
  if (normalizedEndA <= normalizedStartA) normalizedEndA += 24 * 60;
  if (normalizedEndB <= normalizedStartB) normalizedEndB += 24 * 60;
  return normalizedStartA < normalizedEndB && normalizedStartB < normalizedEndA;
}

export function hostVenueDayStatus(
  day: { state?: string; status?: string; slots?: Array<{ status?: string }> } | undefined,
): 'available' | 'blocked' | 'booked' | 'partial' {
  const state = String(day?.state || day?.status || '').toUpperCase();
  if (state === 'BLOCKED') return 'blocked';
  if (state === 'CONFIRMED' || state === 'BOOKED') return 'booked';
  const hasPending = (day?.slots || []).some((slot) =>
    ['pending', 'requested'].includes(String(slot.status || '').toLowerCase()),
  );
  return hasPending ? 'partial' : 'available';
}
