/**
 * Venue availability slot types
 * Venue Dashboard v2 — Feature 2
 */

export type SlotStatus = 'open' | 'blocked' | 'pending_review' | 'booked' | 'hold';

export type SlotSource =
  | 'manual_block'
  | 'partial_block'
  | 'event_hold'
  | 'event_confirmed'
  | 'event_pending'
  | 'system_generated';

export interface AvailabilitySlot {
  id: string;
  venueId: string;
  /** YYYY-MM-DD (IST) */
  date: string;
  /** HH:mm (24h, IST) — null means full day */
  startTime: string | null;
  /** HH:mm (24h, IST) — null means full day */
  endTime: string | null;
  status: SlotStatus;
  source: SlotSource;
  linkedEventId: string | null;
  note: string;
  createdBy: string; // uid
  updatedBy: string; // uid
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface SlotBlockRequest {
  venueId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  note?: string;
}

export interface CalendarDaySlots {
  date: string;
  slots: AvailabilitySlot[];
  /** Derived: true if any slot is blocked/booked for the full day */
  fullyBlocked: boolean;
  /** Derived: true if partial blocks exist */
  partiallyBlocked: boolean;
  /** Number of open time windows remaining */
  openCount: number;
  /** Events pending review on this date */
  pendingCount: number;
  /** Confirmed events on this date */
  confirmedCount: number;
}

export interface SlotCalendarResponse {
  venueId: string;
  startDate: string;
  endDate: string;
  days: CalendarDaySlots[];
}

export type CalendarFilter = 'all' | 'pending_review' | 'confirmed' | 'open' | 'blocked';
