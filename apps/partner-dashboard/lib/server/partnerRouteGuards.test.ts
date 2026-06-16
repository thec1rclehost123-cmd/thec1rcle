import { describe, expect, it } from 'vitest';

import {
  resolveVenuePartnerRouteGuard,
  validateVenuePartnerRouteGuard,
} from './partnerRouteGuards';

describe('partnerRouteGuards', () => {
  it('maps venue guestlist mutations to fine-grained staff actions', () => {
    const guard = resolveVenuePartnerRouteGuard(
      ['venues', 'guest-ops', 'evt_1', 'guests', 'guest_1', 'check-in'],
      'POST',
      new URLSearchParams('venueId=venue_1'),
    );

    expect(guard).toMatchObject({
      requiredAction: 'guestlist:check_in',
      eventId: 'evt_1',
      requiresEditableGuestlist: true,
    });
  });

  it('blocks event-scoped walk-in reads without a concrete event id', () => {
    const guard = resolveVenuePartnerRouteGuard(
      ['venues', 'walk-ins'],
      'GET',
      new URLSearchParams('venueId=venue_1'),
    );

    const error = validateVenuePartnerRouteGuard(
      {
        uid: 'user_1',
        venueId: 'venue_1',
        membershipId: 'member_1',
        baseRole: 'STAFF',
        piiPolicy: {
          showPhone: false,
          showEmail: false,
          showLastName: false,
          showOrderAmount: false,
          showPayoutAmounts: false,
        },
        guestlistScope: 'read_only',
        eventScope: ['evt_1'],
        canDo: () => true,
      },
      guard!,
    );

    expect(error).toEqual({
      status: 403,
      message: 'Event-scoped venue staff must target one allowed event.',
    });
  });

  it('blocks guestlist mutations when the profile is read only', () => {
    const guard = resolveVenuePartnerRouteGuard(
      ['venues', 'guest-ops', 'evt_1', 'guests'],
      'POST',
      new URLSearchParams('venueId=venue_1'),
    );

    const error = validateVenuePartnerRouteGuard(
      {
        uid: 'user_1',
        venueId: 'venue_1',
        membershipId: 'member_1',
        baseRole: 'STAFF',
        piiPolicy: {
          showPhone: false,
          showEmail: false,
          showLastName: false,
          showOrderAmount: false,
          showPayoutAmounts: false,
        },
        guestlistScope: 'read_only',
        eventScope: null,
        canDo: () => true,
      },
      guard!,
    );

    expect(error).toEqual({
      status: 403,
      message: 'This venue staff profile does not have editable guestlist access.',
    });
  });
});
