import { safeDate } from '@/lib/utils/date';

interface CalendarEventInput {
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
}

function toCalendarTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function buildCalendarEventUrl(input: CalendarEventInput): string | null {
  const start = safeDate(input.startDate);
  if (!start) {
    return null;
  }

  const end = safeDate(input.endDate) || new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title || 'THE C1RCLE Event',
    dates: `${toCalendarTimestamp(start)}/${toCalendarTimestamp(end)}`,
    location: input.location || '',
    details: input.description || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
