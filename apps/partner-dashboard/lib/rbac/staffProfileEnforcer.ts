/**
 * Staff Profile Enforcer — server-side middleware helper
 * Venue Dashboard v2 — Feature 1
 *
 * Delegates base token + membership resolution to requirePartnerAccess,
 * then layers on fine-grained venue RBAC via resolveEffectiveProfile.
 *
 * Usage in API routes:
 *   const ctx = await requireVenueAccess(request, "events:create");
 *   if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '../server/auth';
import { getAdminDb, isFirebaseConfigured } from '../firebase/admin';
import { requirePartnerAccess, buildPartnerAuthError } from '../server/partnerAuthMiddleware';
import { resolveEffectiveProfile } from '../server/staffProfileStore';
import type { StaffAction, PIIPolicy } from '../types/staffProfile';
import { OWNER_PII_POLICY } from '../types/staffProfile';

type LegacyStaffAction =
  | 'manage_calendar'
  | 'manage_events'
  | 'view_analytics'
  | 'view_financials'
  | 'manage_financials'
  | 'manage_orders'
  | 'manage_promoters'
  | 'manage_staff';

const LEGACY_STAFF_ACTION_ALIASES: Record<LegacyStaffAction, StaffAction[]> = {
  manage_calendar: [
    'calendar:block_slot',
    'calendar:unblock_slot',
    'calendar:approve_host_request',
  ],
  manage_events: [
    'events:create',
    'events:edit',
    'events:cancel',
    'events:duplicate',
    'events:approve_requests',
  ],
  view_analytics: ['analytics:read'],
  view_financials: [
    'finance:read_overview',
    'finance:read_ledger',
    'finance:read_payouts',
    'finance:read_host_payouts',
    'finance:read_promoter_payouts',
  ],
  manage_financials: ['finance:initiate_payout', 'settings:edit'],
  manage_orders: ['orders_resendReceipt', 'orders_refund', 'orders_refundResell'],
  manage_promoters: ['events:edit'],
  manage_staff: ['staff:invite', 'staff:edit_profiles', 'staff:revoke'],
};

export interface VenueAuthContext {
  uid: string;
  venueId: string;
  membershipId: string;
  baseRole: string;
  piiPolicy: PIIPolicy;
  guestlistScope: 'read_only' | 'editable' | 'none';
  eventScope: string[] | null;
  canDo: (action: StaffAction) => boolean;
}

export interface VenueAuthError {
  error: { code: string; message: string; requestId: string };
  status: number;
}

function ownerContext(uid: string, venueId: string, membershipId: string): VenueAuthContext {
  return {
    uid,
    venueId,
    membershipId,
    baseRole: 'OWNER',
    piiPolicy: OWNER_PII_POLICY,
    guestlistScope: 'editable',
    eventScope: null,
    canDo: () => true,
  };
}

// ── Size-bounded LRU cache (15s TTL) ─────────────────────────────────────────
// BFF runs serverless — each instance is short-lived, so in-memory LRU is correct.
// Cross-instance consistency is handled by the API gateway's Redis-backed HybridCache.
const ACCESS_CACHE_TTL_MS = 15_000;
const ACCESS_CACHE_MAX = 500;

class BoundedCache<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(key: string) {
    return this.map.get(key);
  }
  set(key: string, val: V) {
    this.map.delete(key);
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, val);
  }
  clear() {
    this.map.clear();
  }
}

const accessCache = new BoundedCache<{ ctx: VenueAuthContext; expiresAt: number }>(
  ACCESS_CACHE_MAX,
);

export async function requireVenueAccess(
  request: NextRequest,
  requiredAction?: StaffAction | LegacyStaffAction,
): Promise<VenueAuthContext | VenueAuthError> {
  try {
    if (!isFirebaseConfigured()) {
      return buildPartnerAuthError(
        request,
        503,
        process.env.NODE_ENV === 'development'
          ? 'Service unavailable: Firebase Admin is in Toy Mode (missing credentials). Check your terminal console for details.'
          : 'Service temporarily unavailable',
      );
    }

    // Fast token decode (local, no network) — needed to build the cache key
    const user = await verifyAuth(request);
    if (!user) return buildPartnerAuthError(request, 401, 'Unauthorized');

    const { searchParams } = new URL(request.url);
    const venueId =
      searchParams.get('venueId') ??
      searchParams.get('hostId') ??
      searchParams.get('promoterId') ??
      request.headers.get('x-partner-id') ??
      request.headers.get('x-venue-id') ??
      request.headers.get('x-host-id') ??
      null;

    if (!venueId || venueId === 'null' || venueId === 'undefined') {
      return buildPartnerAuthError(request, 400, 'partnerId (venue/host) required');
    }

    // LRU cache short-circuit — skips all Firestore reads for repeat calls within 15s
    if (!requiredAction) {
      const hit = accessCache.get(`${user.uid}:${venueId}`);
      if (hit && hit.expiresAt > Date.now()) return hit.ctx;
    }

    // Delegate base auth to the unified resolver (token + memberships + fallbacks)
    const base = await requirePartnerAccess(request, { type: 'venue', explicitPartnerId: venueId });
    if ('error' in base) return base;

    // OWNER path — no profile resolution needed
    if (base.role === 'OWNER') return ownerContext(base.uid, venueId, base.membershipId);

    // Staff path — resolve fine-grained effective profile
    const authHeader = request.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const effective = await resolveEffectiveProfile(venueId, base.membershipId, token);

    const rawCanDo = (action: StaffAction): boolean => {
      const normalizedRole = String(effective.baseRole || '').toUpperCase();
      // MANAGER has broad defaults — only deny if explicitly false
      if (normalizedRole === 'MANAGER') return effective.actionPermissions[action] !== false;
      return effective.actionPermissions[action] === true;
    };

    const canDo = (action: StaffAction | LegacyStaffAction): boolean => {
      const aliases =
        action in LEGACY_STAFF_ACTION_ALIASES
          ? LEGACY_STAFF_ACTION_ALIASES[action as LegacyStaffAction]
          : [];
      return [action as StaffAction, ...aliases].some(rawCanDo);
    };

    if (requiredAction && !canDo(requiredAction)) {
      // Last-resort: a stale membership doc with wrong role may exist — check direct ownership
      const db = getAdminDb();
      const [venueDoc, hostDoc] = await Promise.all([
        db.collection('venues').doc(venueId).get(),
        db.collection('hosts').doc(venueId).get(),
      ]);
      if (
        (venueDoc.exists && venueDoc.data()?.ownerId === user.uid) ||
        (hostDoc.exists && hostDoc.data()?.ownerId === user.uid)
      ) {
        return ownerContext(user.uid, venueId, 'owner-direct-fallback');
      }
      return buildPartnerAuthError(request, 403, 'Insufficient permissions');
    }

    const result: VenueAuthContext = {
      uid: base.uid,
      venueId,
      membershipId: base.membershipId,
      baseRole: effective.baseRole,
      piiPolicy: effective.piiPolicy,
      guestlistScope: effective.guestlistScope,
      eventScope: effective.eventScope,
      canDo,
    };
    accessCache.set(`${base.uid}:${venueId}`, {
      ctx: result,
      expiresAt: Date.now() + ACCESS_CACHE_TTL_MS,
    });
    return result;
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    console.error('[RBAC Enforcer] Internal Access Check Error:', msg);
    return buildPartnerAuthError(
      request,
      500,
      process.env.NODE_ENV === 'development'
        ? `Internal authorization error: ${msg}`
        : 'Internal authorization error',
    );
  }
}

/** Apply PII masking to any record (or array of records) based on policy. */
export function applyPIIMask<T>(record: T, policy: PIIPolicy): T {
  if (!record || typeof record !== 'object') return record;
  if (Array.isArray(record)) {
    return (record as unknown[]).map((item) => applyPIIMask(item, policy)) as unknown as T;
  }

  const out = { ...(record as Record<string, unknown>) };

  if (!policy.showPhone) {
    if ('phoneFull' in out && typeof out.phoneFull === 'string') out.phoneFull = undefined;
    if ('phone' in out && typeof out.phone === 'string') {
      const p = out.phone;
      out.phone = `****${p.slice(-4)}`;
    }
  }
  if (!policy.showEmail && 'email' in out && typeof out.email === 'string') {
    const parts = out.email.split('@');
    out.email = `${parts[0].slice(0, 2)}****@${parts[1] ?? ''}`;
  }
  if (!policy.showLastName) {
    if ('guestName' in out && typeof out.guestName === 'string') {
      const parts = out.guestName.split(' ');
      if (parts.length > 1) out.guestName = `${parts[0]} ${parts[1][0]}.`;
    }
    if ('lastName' in out && typeof out.lastName === 'string') {
      out.lastName = `${out.lastName[0]}.`;
    }
  }
  if (!policy.showOrderAmount) {
    out.amountPaise = undefined;
    out.amount = undefined;
    out.grossPaise = undefined;
    out.netPaise = undefined;
  }
  if (!policy.showPayoutAmounts) {
    out.payoutAmount = undefined;
    out.payoutAmountPaise = undefined;
    out.settledAmount = undefined;
    out.pendingAmount = undefined;
  }
  for (const key of Object.keys(out)) {
    const val = out[key];
    if (val && typeof val === 'object') out[key] = applyPIIMask(val, policy);
  }
  return out as unknown as T;
}

/** Check if request is from an OWNER or MANAGER (for management-only endpoints) */
export async function requireManagementRole(
  request: NextRequest,
): Promise<{ uid: string; venueId: string } | VenueAuthError> {
  const ctx = await requireVenueAccess(request);
  if ('error' in ctx) return ctx;
  if (!['OWNER', 'MANAGER'].includes((ctx.baseRole || '').toUpperCase())) {
    return buildPartnerAuthError(request, 403, 'Manager or Owner role required');
  }
  return { uid: ctx.uid, venueId: ctx.venueId };
}
