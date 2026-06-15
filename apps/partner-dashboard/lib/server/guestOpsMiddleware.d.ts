import { NextRequest } from 'next/server';

export interface GuestOpsAuthContext {
  user: {
    uid: string;
    email?: string;
    name?: string;
  };
  membership: {
    userId: string;
    venueId: string;
    role: string;
    isActive: boolean;
    permissions?: string[];
  };
  event: any;
}

export interface GuestOpsAuthError {
  error: string;
  status: number;
}

export function requireGuestOpsAccess(
  request: Request | NextRequest,
  venueId: string,
  eventId: string,
  requiredPermissions?: string[],
): Promise<GuestOpsAuthContext | GuestOpsAuthError>;

export function writeSecurityAuditLog(params: {
  venueId: string;
  actorUid: string;
  actorRole: string;
  action: string;
  eventId?: string;
  queryHash?: string;
  metadata?: Record<string, any>;
}): Promise<void>;

export function writeOverrideLog(
  db: any,
  params: {
    eventId: string;
    venueId: string;
    action: string;
    actorUid: string;
    actorName?: string;
    actorRole?: string;
    targetGuestId: string;
    targetGuestName?: string;
    reason?: string;
    metadata?: Record<string, any>;
  },
): Promise<void>;
