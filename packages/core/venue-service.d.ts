export function getAllVenues(db: any, cityFilter?: string | null): Promise<any[]>;
export function getVenueById(db: any, venueId: string): Promise<any>;
export function getVenueEvents(db: any, venueId: string): Promise<any[]>;
export function toggleVenueFollow(
  db: any,
  venueId: string,
  userId: string,
): Promise<{ followed: boolean }>;
