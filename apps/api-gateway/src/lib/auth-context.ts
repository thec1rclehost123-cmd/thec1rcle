export interface AuthMembership {
  partnerId: string;
  partnerType: string;
  role: string;
  status: string;
  isActive: boolean;
}

export interface RequestAuthContext {
  identity: {
    uid: string;
    email: string | null;
    role: string | null;
    isSystem: boolean;
  };
  memberships: AuthMembership[];
  activeMembership: AuthMembership | null;
  scopes: {
    partnerIds: string[];
    partnerTypes: string[];
    roles: string[];
  };
}

function normalizeMembership(raw: Record<string, any>): AuthMembership | null {
  if (!raw.partnerId || !raw.partnerType) return null;
  return {
    partnerId: String(raw.partnerId),
    partnerType: String(raw.partnerType),
    role: String(raw.role || 'member').toLowerCase(),
    status: String(raw.status || (raw.isActive ? 'active' : 'inactive')).toLowerCase(),
    isActive: raw.isActive === true || String(raw.status || '').toLowerCase() === 'active',
  };
}

export function buildRequestAuthContext(
  user: Record<string, any>,
  rawMemberships: Array<Record<string, any>> = [],
): RequestAuthContext {
  const memberships = rawMemberships
    .map(normalizeMembership)
    .filter((entry): entry is AuthMembership => Boolean(entry));

  const claimedPartnerId = user.activeMembership?.partnerId || user.partnerId || null;
  const claimedPartnerType = user.activeMembership?.partnerType || user.partnerType || null;

  const activeMembership =
    memberships.find((membership) => {
      if (!membership.isActive) return false;
      if (claimedPartnerId && membership.partnerId !== claimedPartnerId) return false;
      if (claimedPartnerType && membership.partnerType !== claimedPartnerType) return false;
      return true;
    }) ||
    memberships.find((membership) => membership.isActive) ||
    null;

  return {
    identity: {
      uid: String(user.uid),
      email: user.email ? String(user.email) : null,
      role: user.role ? String(user.role) : null,
      isSystem: user.isSystem === true,
    },
    memberships,
    activeMembership,
    scopes: {
      partnerIds: [...new Set(memberships.map((membership) => membership.partnerId))],
      partnerTypes: [...new Set(memberships.map((membership) => membership.partnerType))],
      roles: [...new Set(memberships.map((membership) => membership.role))],
    },
  };
}
