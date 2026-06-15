export function getEvent(
  eventId: any,
  {
    client,
  }?: {
    client?: boolean | undefined;
  },
): Promise<any>;
/**
 * Calculates a heat score for trending events.
 * High scores indicate trending/popular events.
 */
export function calculateHeatScore(event: any): number;
/**
 * Resolves the starting price of an event based on its tickets.
 */
export function resolveStartingPrice(event: any): any;
/**
 * Determines current status based on time.
 */
export function determineStatus(start: any, end: any): 'live' | 'upcoming' | 'past';
/**
 * Pure transformation logic for building a complete Event object.
 * Moved from eventStore.js for universal use.
 */
export function buildEvent(payload?: {}): {
  id: any;
  slug: any;
  title: any;
  summary: any;
  description: any;
  category: any;
  tags: any;
  host: any;
  hostId: any;
  location: any;
  venue: any;
  venueId: any;
  promotersEnabled: any;
  city: string;
  cityKey: string;
  country: any;
  startDate: any;
  endDate: any;
  timezone: any;
  poster: any;
  image: any;
  accentColor: any;
  guests: any;
  gallery: any;
  tickets: any;
  tables: any;
  priceRange: any;
  isRSVP: boolean;
  promoterSettings: any;
  settings: any;
  stats: any;
  isDeleted: any;
  createdAt: any;
  updatedAt: string;
  lifecycle: any;
  creatorRole: any;
  creatorId: any;
  auditTrail: any;
};
/**
 * Filter and sort logic.
 */
export function filterAndSortEvents(
  events: any,
  {
    city,
    sort,
    search,
    host,
  }?: {
    city: any;
    sort?: string | undefined;
    search: any;
    host: any;
  },
): any;
export namespace EVENT_SORTERS {
  export function heat(a: any, b: any): number;
  export function _new(a: any, b: any): number;
  export { _new as new };
  export function soonest(a: any, b: any): number;
  export function price(a: any, b: any): number;
}
declare namespace _default {
  export { getEvent };
  export { calculateHeatScore };
  export { resolveStartingPrice };
  export { determineStatus };
  export { buildEvent };
  export { filterAndSortEvents };
  export { EVENT_SORTERS };
}
export default _default;
