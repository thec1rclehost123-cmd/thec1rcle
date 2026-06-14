/**
 * Shared constants for the partner-dashboard application.
 * Import from here instead of using magic numbers inline.
 */

// Polling intervals (ms)
export const POLL_INTERVAL_GUEST_OPS_MS = 15_000; // 15s live KPI refresh
export const POLL_INTERVAL_TONIGHT_MS = 30_000;   // 30s tonight pulse refresh

// Pagination limits
export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX_GUESTS = 500;
export const PAGE_SIZE_MAX_LIST = 200;
export const PAGE_SIZE_MAX_EVENTS = 100;

// Finance
export const REVENUE_COMPACT_THRESHOLD = 100_000; // ₹1L — show compact format above this

// File upload
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
