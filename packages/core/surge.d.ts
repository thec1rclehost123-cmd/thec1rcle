/**
 * Join Queue with Guardrails
 */
export function joinQueue(
  db: any,
  eventId: any,
  userId: any,
  deviceId: any,
  options?: {},
): Promise<any>;
/**
 * Check Queue Status (Heartbeat Sensitive)
 */
export function getQueueStatus(db: any, queueId: any): Promise<any>;
/**
 * Lane-Based Admission Logic
 * Prevents "Fast-Pass" from totally blocking guest lanes.
 */
export function admitUsers(
  db: any,
  eventId: any,
  totalCount?: number,
  source?: string,
): Promise<number>;
/**
 * Standardized Analytics Definitions
 */
export function getSurgeAnalytics(
  db: any,
  eventId: any,
): Promise<{
  total_demand: number;
  velocity: number;
  conversion_stats: {
    admitted: number;
    consumed: number;
    abandoned_pre_reserve: number;
    payment_failed: number;
    stalled: number;
  };
}>;
export function generateAdmissionToken(eventId: any, userId: any, queueId: any): string;
export function validateAdmission(db: any, eventId: any, userId: any, token: any): Promise<boolean>;
export function consumeAdmission(db: any, queueId: any): Promise<void>;
export function flagPaymentFailure(db: any, queueId: any): Promise<void>;
/**
 * High-performance metric recording using Redis.
 * Uses Firestore as a secondary audit log every 100 increments.
 */
export function recordSurgeMetric(db: any, eventId: any, type: any): Promise<boolean>;
export function getSurgeStatus(db: any, eventId: any): Promise<any>;
export namespace QUEUE_TIERS {
  let LOYAL: string;
  let AUTHENTICATED: string;
  let ANONYMOUS: string;
}
