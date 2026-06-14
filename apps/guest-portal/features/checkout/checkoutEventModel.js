export function normalizeCheckoutEventDetail(detail) {
  const event = detail?.event || detail;
  if (!event) return null;

  return {
    ...event,
    tickets: event.ticketCatalog?.tiers ?? event.tickets ?? [],
  };
}
