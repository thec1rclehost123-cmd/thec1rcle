import { formatEventDate, formatEventTime } from '@c1rcle/core/time';

export function normalizeCheckoutEventDetail(detail) {
  const event = detail?.event || detail;
  if (!event) return null;

  const startDate = event.startDateTime || event.startAt || event.startDate;
  const startTime = event.startTime || event.time;

  return {
    ...event,
    tickets: event.ticketCatalog?.tiers ?? event.tickets ?? [],
    date: startDate ? formatEventDate(startDate) : '',
    time: formatEventTime(startTime, startDate, ''),
  };
}
