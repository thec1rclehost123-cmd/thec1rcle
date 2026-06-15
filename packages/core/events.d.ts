/**
 * Is this lifecycle visible to guests in the public portal?
 * Use this instead of hardcoding lifecycle strings in components.
 */
export function isPublicLifecycle(lifecycle: any): boolean;
/**
 * Is this an upcoming or ongoing event (suitable for discovery feeds)?
 * Excludes completed, cancelled, paused, denied, deleted.
 */
export function isUpcomingLifecycle(lifecycle: any): boolean;
/**
 * Does this event require venue approval before it can be published?
 * Only host-created events go through the approval flow.
 */
export function requiresVenueApproval(event: any): boolean;
/**
 * Can a promoter see this event in their discovery view?
 * Requires both public visibility AND promotersEnabled flag.
 */
export function canPromoterSee(event: any): boolean;
export function getPromoterEligibleTicketTiers(event: any): any;
export function hasPromoterEligibleTicketTiers(event: any): boolean;
/**
 * Can a promoter create a personal link for this event?
 * Currently same as visibility logic, but separated for future extensibility (e.g. invite-only).
 */
export function canPromoterCreateLink(event: any): boolean;
/**
 * Can the given actor edit this event?
 * - venue: can edit their own draft events
 * - host: can edit their own draft or needs_changes events
 * - admin: can always edit
 */
export function isEditableEvent(event: any, actorRole: any): boolean;
/**
 * Returns the set of lifecycle values the actor can transition this event to.
 * Used to validate PATCH /events/:id/lifecycle requests.
 */
export function getNextAllowedTransitions(event: any, actorRole: any): string[];
export function normalizeCity(cityStr: any, locationStr?: string): string;
export function getCityLabel(key: any): string;
/**
 * Normalizes a Partner (Venue or Host) document into a standard snapshot.
 * Used for denormalized storage in events and orders.
 */
export function buildPartnerSnapshot(
  doc: any,
  type: any,
  fallbackName: any,
): {
  id: any;
  type: any;
  slug: any;
  handle: any;
  name: any;
  avatar: any;
  photoURL: any;
  image: any;
  cover: any;
  coverURL: any;
  verified: boolean;
  role: any;
  city: any;
  neighborhood: any;
};
export function resolvePoster(event: any): any;
/**
 * Maps a raw Firestore document to a consistent client-side object.
 * Used by Guest Portal, Partner Dashboard, and Admin Console.
 */
export function mapEventForClient(data: any, id: any): any;
/**
 * Resolves Host and Venue snapshots from a payload containing IDs.
 * Used for server-side normalization of partner metadata.
 */
export function resolvePartnerSnapshots(
  db: any,
  payload?: {},
): Promise<{
  hostData: {
    id: any;
    type: any;
    slug: any;
    handle: any;
    name: any;
    avatar: any;
    photoURL: any;
    image: any;
    cover: any;
    coverURL: any;
    verified: boolean;
    role: any;
    city: any;
    neighborhood: any;
  };
  venueData: {
    id: any;
    type: any;
    slug: any;
    handle: any;
    name: any;
    avatar: any;
    photoURL: any;
    image: any;
    cover: any;
    coverURL: any;
    verified: boolean;
    role: any;
    city: any;
    neighborhood: any;
  };
}>;
export namespace EVENT_LIFECYCLE {
  let DRAFT: string;
  let SUBMITTED: string;
  let NEEDS_CHANGES: string;
  let APPROVED: string;
  let SCHEDULED: string;
  let LIVE: string;
  let COMPLETED: string;
  let PAUSED: string;
  let CANCELLED: string;
  let DENIED: string;
  let DELETED: string;
}
/**
 * States that appear in the guest-facing public portal (explore, search, event pages).
 * approved is intentionally excluded — it is an internal pre-publish state.
 */
export const PUBLIC_LIFECYCLE_STATES: string[];
export const CITY_MAP: {
  key: string;
  label: string;
  matches: string[];
}[];
export function slugifyPartnerValue(value: any): string;
