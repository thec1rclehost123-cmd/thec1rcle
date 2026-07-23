export function buildVenueFeed<T extends { id: string }>(
  filteredVenues: T[],
  spotlightVenueId: string | undefined,
  spotlightIsVisible: boolean,
): T[] {
  if (!spotlightIsVisible || !spotlightVenueId) return filteredVenues;
  return filteredVenues.filter((venue) => venue.id !== spotlightVenueId);
}
