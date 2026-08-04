const NON_BLOCKING_EVENT_LIFECYCLES = new Set(['draft', 'deleted', 'cancelled', 'denied']);

export function isBlockingCalendarEvent(event: Record<string, unknown>): boolean {
  const lifecycle = String(event.lifecycle || event.status || 'draft').toLowerCase();
  return !NON_BLOCKING_EVENT_LIFECYCLES.has(lifecycle);
}
