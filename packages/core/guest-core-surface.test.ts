import { describe, expect, it } from 'vitest';
import { buildAppleWalletPassPreview, buildGoogleWalletPassPreview } from './guest-pass-engine.js';
import {
  buildGuestAuthProfile,
  filterGuestProfileUpdates,
  normalizeGuestEmail,
} from './guest-auth-engine.js';
import {
  buildEventCardReadModel,
  buildGuestDiscoveryEnvelope,
  filterGuestEventCards,
  isGuestDiscoveryVisible,
  normalizeGuestDiscoveryLimit,
  normalizeGuestDiscoverySort,
  rankGuestSearchGroups,
} from './guest-discovery-engine.js';
import { buildGuestScanDecision, parseGuestTicketPayload } from './guest-scanner-engine.js';

describe('guest core surface', () => {
  it('builds wallet pass previews without route-local business logic', () => {
    const order = {
      id: 'order_123456789',
      eventTitle: 'After Dark',
      eventDate: '2099-01-01T20:00:00.000Z',
      tickets: [{ tierName: 'VIP', quantity: 2 }],
    };
    const event = { title: 'After Dark', location: 'High Spirits', hostName: 'C1RCLE' };

    expect(buildAppleWalletPassPreview(order, event, {})).toMatchObject({
      status: 'preview',
      pass: {
        serialNumber: 'order_123456789',
        eventTicket: {
          secondaryFields: expect.arrayContaining([
            { key: 'ticket', label: 'TICKET', value: 'VIP' },
          ]),
        },
      },
    });
    expect(buildGoogleWalletPassPreview(order, event, {})).toMatchObject({
      status: 'preview',
      pass: {
        eventName: 'After Dark',
        ticketType: 'VIP',
        quantity: 2,
      },
    });
  });

  it('keeps guest auth profile normalization and safe update filtering in core', () => {
    expect(normalizeGuestEmail('  GUEST@EXAMPLE.COM ')).toBe('guest@example.com');
    expect(
      filterGuestProfileUpdates({ displayName: 'Guest', role: 'admin', gender: 'female' }),
    ).toEqual({
      displayName: 'Guest',
      gender: 'female',
    });
    expect(
      buildGuestAuthProfile({ uid: 'user_1', displayName: 'Guest', gender: 'female' }),
    ).toMatchObject({
      uid: 'user_1',
      onboardingComplete: true,
    });
  });

  it('centralizes guest discovery visibility and envelope helpers', () => {
    expect(normalizeGuestDiscoverySort('trending')).toBe('heatScore');
    expect(normalizeGuestDiscoveryLimit('200')).toBe(100);
    expect(
      isGuestDiscoveryVisible({
        visibility: 'public',
        lifecycle: 'scheduled',
        statusKey: 'upcoming',
      }),
    ).toBe(true);
    expect(buildGuestDiscoveryEnvelope([{ id: 'event_1' }], { hasMore: true })).toEqual({
      items: [{ id: 'event_1' }],
      nextCursor: null,
      hasMore: true,
      appliedFilters: {},
    });
  });

  it('owns guest discovery projection, filtering, and search ranking in core', () => {
    const card = buildEventCardReadModel({
      id: 'event_1',
      title: 'After Dark',
      visibility: 'public',
      lifecycle: 'scheduled',
      city: 'Pune, IN',
      hostName: 'C1RCLE',
      venueName: 'High Spirits',
      startDate: '2099-04-21T20:00:00.000Z',
      tickets: [{ id: 'vip', name: 'VIP', price: 2000 }],
      tags: ['house'],
    });

    expect(card).toMatchObject({
      id: 'event_1',
      cityKey: 'pune-in',
      statusKey: 'upcoming',
      searchText: expect.stringContaining('after dark'),
    });

    const result = filterGuestEventCards(
      [
        card,
        { ...card, id: 'event_ended', statusKey: 'ended' },
        { ...card, id: 'event_private', visibility: 'private' },
      ],
      { city: 'Pune', search: 'after', sort: 'trending', limit: 10 },
    );

    expect(result.items.map((item: any) => item.id)).toEqual(['event_1']);
    expect(result.appliedFilters).toMatchObject({ cityKey: 'pune-in', sort: 'heatScore' });

    const ranked = rankGuestSearchGroups(
      {
        events: [card],
        hosts: [
          {
            id: 'host_1',
            visibility: 'public',
            searchText: 'C1RCLE after dark',
            followersCount: 50,
          },
        ],
        venues: [
          {
            id: 'venue_1',
            visibility: 'public',
            searchText: 'High Spirits pune',
            followersCount: 20,
          },
          {
            id: 'venue_private',
            visibility: 'private',
            searchText: 'High Spirits',
            followersCount: 999,
          },
        ],
      },
      'high',
      5,
    );

    expect(ranked.events.map((event: any) => event.id)).toEqual(['event_1']);
    expect(ranked.hosts).toEqual([]);
    expect(ranked.venues.map((venue: any) => venue.id)).toEqual(['venue_1']);
  });

  it('parses scan payloads and builds the legacy scan decision shape', () => {
    expect(parseGuestTicketPayload(JSON.stringify({ eid: 'ent_1' }))).toMatchObject({
      kind: 'entitlement',
    });
    expect(parseGuestTicketPayload('ticket_1:signature_1')).toMatchObject({
      kind: 'legacy',
      ticketId: 'ticket_1',
      signature: 'signature_1',
    });
    expect(buildGuestScanDecision({ approved: true, ticket: { id: 'ticket_1' } })).toEqual({
      status: 'approved',
      ticket: { id: 'ticket_1' },
      message: 'Entry Granted',
    });
  });
});
