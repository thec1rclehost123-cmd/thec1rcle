import type { Firestore } from 'firebase-admin/firestore';
import type { FastifyRequest } from 'fastify';
import type { PartnerContext, PartnerRole, PartnerType } from '../services/unified/types.js';

// ─── Resolution ───────────────────────────────────────────────────────────────
//
// Resolution order (fastest to slowest):
//   1. activeMembership already on request.user (set by firebase.ts preHandler)
//   2. authContext.memberships already loaded in memory
//   3. Firestore partner_memberships query
//   4. Firestore direct ownership check (hosts / venues / promoters collections)
//
// Returns null if the authenticated user has no partner identity. Callers
// must reject the request with 403 in that case.

type RawUser = Record<string, any> | null;
type RawMembership = Record<string, any>;

function pickDisplayName(source: RawUser): string {
  if (!source) return 'Partner';
  return String(source.displayName || source.name || source.email || source.uid || 'Partner');
}

function membershipToRoles(partnerType: string, role: string): PartnerRole[] {
  const t = partnerType.toLowerCase();
  const r = role.toLowerCase();

  if (t === 'venue') {
    if (r === 'owner') return ['venue_owner'];
    if (r === 'manager') return ['venue_manager'];
    return ['venue_staff'];
  }
  if (t === 'host') return ['host_owner'];
  if (t === 'promoter') {
    if (r === 'owner' || r === 'promoter') return ['promoter_owner'];
    return ['promoter_staff'];
  }
  return [];
}

function membershipToType(partnerType: string): PartnerType | null {
  const t = partnerType.toLowerCase();
  if (t === 'host') return 'host';
  if (t === 'venue') return 'venue';
  if (t === 'promoter') return 'promoter';
  return null;
}

function buildFromMembership(
  uid: string,
  membership: RawMembership,
  user: RawUser,
): PartnerContext | null {
  const partnerId = String(membership.partnerId || '');
  const partnerType = String(membership.partnerType || membership.type || '');
  const type = membershipToType(partnerType);
  if (!partnerId || !type) return null;

  const role = String(membership.role || 'staff');
  return {
    partnerId,
    uid,
    type,
    roles: membershipToRoles(partnerType, role),
    venueIds: type === 'venue' ? [partnerId] : [],
    displayName: pickDisplayName(user),
  };
}

export async function resolvePartnerContext(
  db: Firestore,
  request: FastifyRequest & { user?: RawUser; authContext?: Record<string, any> | null },
): Promise<PartnerContext | null> {
  const user = request.user;
  if (!user?.uid) return null;
  const uid = String(user.uid);

  // 1. activeMembership already on request.user (fastest — no extra DB read)
  const active = user.activeMembership;
  if (active?.partnerId) {
    const ctx = buildFromMembership(uid, active, user);
    if (ctx) return ctx;
  }

  // 2. memberships already loaded in authContext
  const memberships: RawMembership[] = Array.isArray(request.authContext?.memberships)
    ? request.authContext!.memberships
    : [];
  for (const m of memberships) {
    if (m.isActive === false) continue;
    const ctx = buildFromMembership(uid, m, user);
    if (ctx) return ctx;
  }

  // 3. Firestore partner_memberships query
  // Primary: isActive == true. Fallback: status == 'active' for memberships that use
  // the status field instead of isActive (both are treated as valid by the BFF layer).
  const primarySnap = await db
    .collection('partner_memberships')
    .where('uid', '==', uid)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get()
    .catch(() => null);

  const memberDocs = primarySnap?.docs ?? [];

  if (memberDocs.length === 0) {
    const statusSnap = await db
      .collection('partner_memberships')
      .where('uid', '==', uid)
      .where('status', '==', 'active')
      .limit(10)
      .get()
      .catch(() => null);
    if (statusSnap) memberDocs.push(...statusSnap.docs);
  }

  for (const doc of memberDocs) {
    const ctx = buildFromMembership(uid, doc.data(), user);
    if (ctx) return ctx;
  }

  // 4. Direct ownership fallback — check hosts, venues, promoters collections
  const [hostSnap, venueSnap, promoterSnap] = await Promise.all([
    db
      .collection('hosts')
      .where('ownerId', '==', uid)
      .limit(1)
      .get()
      .catch(() => null),
    db
      .collection('venues')
      .where('ownerId', '==', uid)
      .limit(1)
      .get()
      .catch(() => null),
    db
      .collection('promoters')
      .doc(uid)
      .get()
      .catch(() => null),
  ]);

  if (hostSnap && !hostSnap.empty) {
    const doc = hostSnap.docs[0];
    return {
      partnerId: doc.id,
      uid,
      type: 'host',
      roles: ['host_owner'],
      venueIds: [],
      displayName: pickDisplayName(user),
    };
  }

  if (venueSnap && !venueSnap.empty) {
    const doc = venueSnap.docs[0];
    return {
      partnerId: doc.id,
      uid,
      type: 'venue',
      roles: ['venue_owner'],
      venueIds: [doc.id],
      displayName: pickDisplayName(user),
    };
  }

  if (promoterSnap && promoterSnap.exists) {
    return {
      partnerId: promoterSnap.id,
      uid,
      type: 'promoter',
      roles: ['promoter_owner'],
      venueIds: [],
      displayName: pickDisplayName(user),
    };
  }

  return null;
}

// ─── Access guards ────────────────────────────────────────────────────────────

export function requireType(ctx: PartnerContext, ...types: PartnerType[]): void {
  if (!types.includes(ctx.type)) {
    const err: any = new Error(`Access denied: requires ${types.join(' or ')} partner type`);
    err.statusCode = 403;
    err.code = 'FORBIDDEN_PARTNER_TYPE';
    throw err;
  }
}

export function requireRole(ctx: PartnerContext, ...roles: PartnerRole[]): void {
  const hasRole = roles.some((r) => ctx.roles.includes(r));
  if (!hasRole) {
    const err: any = new Error(`Access denied: requires role ${roles.join(' or ')}`);
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

export function canManageVenue(ctx: PartnerContext, venueId: string): boolean {
  if (ctx.type === 'venue' && ctx.venueIds.includes(venueId)) return true;
  if (ctx.roles.includes('venue_owner') || ctx.roles.includes('venue_manager')) return true;
  return false;
}
