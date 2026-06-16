import type { VenueAuthContext } from '@/lib/rbac/staffProfileEnforcer';
import type { StaffAction } from '@/lib/types/staffProfile';

export type VenuePartnerRouteGuard = {
  partnerType: 'venue';
  requiredAction: StaffAction;
  eventId: string | null;
  requiresEditableGuestlist?: boolean;
  requiresEventScope?: boolean;
};

type GuardError = {
  status: number;
  message: string;
};

function normalizeMethod(method: string) {
  return String(method || 'GET').toUpperCase();
}

function isGuestOpsReadPath(path: string) {
  return (
    path === 'summary' ||
    path === 'exceptions' ||
    path === 'scanner/devices' ||
    path === 'scanner/stream' ||
    path === 'scanner/summary' ||
    path === 'guest-rules' ||
    path === 'host-allocations/all' ||
    path.startsWith('host-allocations/') ||
    path.startsWith('promoter-allocations/') ||
    path === 'guests' ||
    path === 'guests/search' ||
    path === 'guests/export' ||
    path === 'guests/manual-lookup'
  );
}

export function resolveVenuePartnerRouteGuard(
  segments: string[],
  method: string,
  searchParams: URLSearchParams,
): VenuePartnerRouteGuard | null {
  if (segments[0] !== 'venues') return null;

  const normalizedMethod = normalizeMethod(method);
  const surface = segments[1] || '';

  if (surface === 'guest-ops') {
    const eventId = segments[2] || null;
    const guestOpsPath = segments.slice(3).join('/');

    if (!eventId) {
      return {
        partnerType: 'venue',
        requiredAction: 'guestlist:read',
        eventId: null,
        requiresEventScope: true,
      };
    }

    if (normalizedMethod === 'GET' && guestOpsPath === 'guests/export') {
      return {
        partnerType: 'venue',
        requiredAction: 'guestlist:export',
        eventId,
        requiresEventScope: true,
      };
    }

    if (normalizedMethod === 'GET' && isGuestOpsReadPath(guestOpsPath)) {
      return {
        partnerType: 'venue',
        requiredAction: 'guestlist:read',
        eventId,
        requiresEventScope: true,
      };
    }

    if (guestOpsPath === 'guests' && normalizedMethod === 'POST') {
      return {
        partnerType: 'venue',
        requiredAction: 'guestlist:add_guest',
        eventId,
        requiresEditableGuestlist: true,
        requiresEventScope: true,
      };
    }

    if (guestOpsPath === 'guests/manual-lookup' && normalizedMethod === 'POST') {
      return {
        partnerType: 'venue',
        requiredAction: 'guestlist:add_guest',
        eventId,
        requiresEditableGuestlist: true,
        requiresEventScope: true,
      };
    }

    if (guestOpsPath === 'guest-rules' && normalizedMethod === 'POST') {
      return {
        partnerType: 'venue',
        requiredAction: 'events:edit',
        eventId,
        requiresEventScope: true,
      };
    }

    if (
      guestOpsPath.startsWith('exceptions/') &&
      guestOpsPath.endsWith('/resolve') &&
      normalizedMethod === 'POST'
    ) {
      return {
        partnerType: 'venue',
        requiredAction: 'guestlist:flag',
        eventId,
        requiresEditableGuestlist: true,
        requiresEventScope: true,
      };
    }

    const guestActionMatch = guestOpsPath.match(/^guests\/[^/]+\/(check-in|deny|flag|re-entry)$/);
    if (guestActionMatch && normalizedMethod === 'POST') {
      const action = guestActionMatch[1];
      const requiredAction: StaffAction =
        action === 'check-in' || action === 're-entry'
          ? 'guestlist:check_in'
          : action === 'deny'
            ? 'guestlist:deny'
            : 'guestlist:flag';

      return {
        partnerType: 'venue',
        requiredAction,
        eventId,
        requiresEditableGuestlist: true,
        requiresEventScope: true,
      };
    }
  }

  if (surface === 'walk-ins') {
    const eventId = segments[2] || searchParams.get('eventId');

    if (normalizedMethod === 'GET') {
      return {
        partnerType: 'venue',
        requiredAction: 'walkins:read',
        eventId,
        requiresEventScope: true,
      };
    }

    if (normalizedMethod === 'POST') {
      return {
        partnerType: 'venue',
        requiredAction: 'walkins:create',
        eventId,
        requiresEventScope: true,
      };
    }

    if (normalizedMethod === 'PATCH') {
      return {
        partnerType: 'venue',
        requiredAction: 'walkins:edit',
        eventId,
        requiresEventScope: true,
      };
    }

    if (normalizedMethod === 'DELETE') {
      return {
        partnerType: 'venue',
        requiredAction: 'walkins:delete',
        eventId,
        requiresEventScope: true,
      };
    }
  }

  return null;
}

export function validateVenuePartnerRouteGuard(
  auth: VenueAuthContext,
  guard: VenuePartnerRouteGuard,
): GuardError | null {
  if (guard.requiresEventScope && auth.eventScope && auth.eventScope.length > 0) {
    if (!guard.eventId) {
      return {
        status: 403,
        message: 'Event-scoped venue staff must target one allowed event.',
      };
    }

    if (!auth.eventScope.includes(guard.eventId)) {
      return {
        status: 403,
        message: 'This venue staff profile is not allowed to access the requested event.',
      };
    }
  }

  if (guard.requiredAction.startsWith('guestlist:')) {
    if (auth.guestlistScope === 'none') {
      return {
        status: 403,
        message: 'This venue staff profile does not have guestlist access.',
      };
    }

    if (guard.requiresEditableGuestlist && auth.guestlistScope !== 'editable') {
      return {
        status: 403,
        message: 'This venue staff profile does not have editable guestlist access.',
      };
    }
  }

  return null;
}
