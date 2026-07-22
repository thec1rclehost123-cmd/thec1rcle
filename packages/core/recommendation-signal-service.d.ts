export type RecommendationSignal = {
  type: 'event_view' | 'event_save' | 'venue_follow' | 'category_browse';
  category?: string;
  eventId?: string;
  venueId?: string;
};
export function recordRecommendationSignal(
  db: any,
  userId: string,
  input: RecommendationSignal,
  now?: string,
): Promise<{ accepted: true; profileVersion: number; changed: boolean }>;
export const recommendationSignalConstants: { MAX_RECENT_SIGNALS: number };
