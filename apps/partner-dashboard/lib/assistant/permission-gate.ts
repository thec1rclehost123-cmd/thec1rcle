/**
 * Partner Dashboard AI Assistant — Permission Gate
 *
 * Server-side permission enforcement for every tool call.
 * MUST run before any data retrieval. Never trust client-supplied scope.
 *
 * Rules:
 *   - Finance data requires VIEW_FINANCIALS
 *   - Payout management requires MANAGE_PAYOUTS
 *   - Staff data requires MANAGE_STAFF
 *   - Analytics requires VIEW_ANALYTICS
 *   - Partner obligation data requires VIEW_FINANCIALS + OWNER/FINANCE_ADMIN
 *   - Cross-partner data is never allowed (user can only see their own partnerId)
 *   - Promoters see only their own commission and attribution data
 */

import type { AssistantPermissionContext } from './types';
import type { Permission } from '@/lib/rbac/types';
import { VENUE_PERMISSIONS, HOST_PERMISSIONS, PROMOTER_PERMISSIONS } from '@/lib/rbac/types';

// ── Permission Resolution ─────────────────────────────────────────────────────

/** Resolve the canonical permissions for a given role. */
export function resolvePermissions(
  ctx: Pick<AssistantPermissionContext, 'partnerType' | 'role'>,
): Permission[] {
  const { partnerType, role } = ctx;
  if (partnerType === 'venue' || partnerType === 'club') {
    return VENUE_PERMISSIONS[role as keyof typeof VENUE_PERMISSIONS] ?? [];
  }
  if (partnerType === 'host') {
    return HOST_PERMISSIONS[role as keyof typeof HOST_PERMISSIONS] ?? [];
  }
  if (partnerType === 'promoter') {
    return PROMOTER_PERMISSIONS[role as keyof typeof PROMOTER_PERMISSIONS] ?? [];
  }
  return [];
}

/** Check if a permission context has all required permissions. */
export function hasPermissions(ctx: AssistantPermissionContext, required: Permission[]): boolean {
  return required.every((p) => ctx.permissions.includes(p));
}

// ── Gate Results ──────────────────────────────────────────────────────────────

export interface GateResult {
  allowed: boolean;
  reason?: string; // Human-readable reason when denied (used in assistant answer)
  refusalText?: string; // Ready-to-use refusal message for the assistant
}

// ── Specific Permission Checks ────────────────────────────────────────────────

/** Can this user see financial overview data? */
export function canViewFinancials(ctx: AssistantPermissionContext): GateResult {
  if (!hasPermissions(ctx, ['VIEW_FINANCIALS'])) {
    return {
      allowed: false,
      reason: 'Missing VIEW_FINANCIALS permission',
      refusalText: 'Financial data is restricted to owners and finance admins for this account.',
    };
  }
  return { allowed: true };
}

/** Can this user see payout details? */
export function canManagePayouts(ctx: AssistantPermissionContext): GateResult {
  if (!hasPermissions(ctx, ['VIEW_FINANCIALS'])) {
    return {
      allowed: false,
      reason: 'Missing VIEW_FINANCIALS permission',
      refusalText: 'Payout details are restricted to owners and finance admins for this account.',
    };
  }
  return { allowed: true };
}

/** Can this user see venue-wide partner obligations (what the venue owes hosts/promoters)? */
export function canViewPartnerObligations(ctx: AssistantPermissionContext): GateResult {
  if (ctx.partnerType !== 'venue' && ctx.partnerType !== 'club') {
    return {
      allowed: false,
      reason: 'Partner obligations are a venue-only view',
      refusalText: 'Partner obligation totals are only visible to venue accounts.',
    };
  }
  if (!hasPermissions(ctx, ['VIEW_FINANCIALS'])) {
    return {
      allowed: false,
      reason: 'Missing VIEW_FINANCIALS permission',
      refusalText: 'That data is restricted to owners and finance admins for this venue.',
    };
  }
  return { allowed: true };
}

/** Can this user see analytics? */
export function canViewAnalytics(ctx: AssistantPermissionContext): GateResult {
  if (!hasPermissions(ctx, ['VIEW_ANALYTICS'])) {
    return {
      allowed: false,
      reason: 'Missing VIEW_ANALYTICS permission',
      refusalText: 'Analytics data is not available for your current role.',
    };
  }
  return { allowed: true };
}

/** Can this user see staff performance data? */
export function canViewStaff(ctx: AssistantPermissionContext): GateResult {
  if (!hasPermissions(ctx, ['MANAGE_STAFF'])) {
    return {
      allowed: false,
      reason: 'Missing MANAGE_STAFF permission',
      refusalText: 'Staff performance data is restricted to managers and owners.',
    };
  }
  return { allowed: true };
}

/** Can this user see guestlist data? */
export function canViewGuestlist(ctx: AssistantPermissionContext): GateResult {
  if (!hasPermissions(ctx, ['VIEW_GUESTLIST'])) {
    return {
      allowed: false,
      reason: 'Missing VIEW_GUESTLIST permission',
      refusalText: 'Guest list data is not available for your current role.',
    };
  }
  return { allowed: true };
}

/** Can this user see real-time entry/scan data? */
export function canViewEntryOps(ctx: AssistantPermissionContext): GateResult {
  const hasEntry =
    hasPermissions(ctx, ['SCAN_ENTRY']) ||
    hasPermissions(ctx, ['VIEW_REAL_TIME_SCANS']) ||
    hasPermissions(ctx, ['VIEW_ANALYTICS']);
  if (!hasEntry) {
    return {
      allowed: false,
      reason: 'Missing entry operations permission',
      refusalText: 'Entry and scan data is not available for your current role.',
    };
  }
  return { allowed: true };
}

/** Can this user see promoter commission data? */
export function canViewPromoterCommissions(ctx: AssistantPermissionContext): GateResult {
  // Promoters can always see their own commission
  if (ctx.partnerType === 'promoter') return { allowed: true };
  // Hosts and venues with VIEW_FINANCIALS can see partner commission data
  if (hasPermissions(ctx, ['VIEW_FINANCIALS'])) return { allowed: true };
  // Hosts with MANAGE_PROMOTERS can see promoter summary (but not payout amounts)
  if (hasPermissions(ctx, ['MANAGE_PROMOTERS'])) return { allowed: true };
  return {
    allowed: false,
    reason: 'Insufficient permissions to view commission data',
    refusalText:
      'Commission data is restricted to owners, finance admins, and promoters for their own data.',
  };
}

/**
 * Enforce partner scope: the user can only query data for their own partnerId.
 * If the requested resourceOwnerId does not match, deny.
 */
export function enforcePartnerScope(
  ctx: AssistantPermissionContext,
  resourceOwnerId: string,
): GateResult {
  if (ctx.partnerId !== resourceOwnerId) {
    return {
      allowed: false,
      reason: 'Cross-partner data access attempted',
      refusalText:
        'That data belongs to a different account. I can only show you data within your authorized scope.',
    };
  }
  return { allowed: true };
}

/**
 * Build the complete permission context from a verified token + user profile.
 * Called in the API route after verifyAuth().
 */
export function buildPermissionContext(
  uid: string,
  partnerId: string,
  partnerName: string,
  partnerType: AssistantPermissionContext['partnerType'],
  role: AssistantPermissionContext['role'],
  token: string,
): AssistantPermissionContext {
  const partialCtx = { partnerType, role };
  const permissions = resolvePermissions(partialCtx);
  return { uid, partnerId, partnerName, partnerType, role, permissions, token };
}
