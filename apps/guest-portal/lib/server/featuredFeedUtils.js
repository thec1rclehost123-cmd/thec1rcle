export const FEATURED_EVENT_LIMIT = 6;

export function mergePinnedAndHeatEvents(pinnedEvents = [], heatEvents = [], limit = FEATURED_EVENT_LIMIT) {
  const merged = [];
  const seen = new Set();

  for (const event of [...pinnedEvents, ...heatEvents]) {
    if (!event?.id || seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
    if (merged.length >= limit) break;
  }

  return merged;
}
