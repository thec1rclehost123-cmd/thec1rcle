import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';
import checkoutRoutes from './checkout';
import paymentRoutes from './payments';
import orderRoutes from './orders';
import ticketRoutes from './tickets';
import guestNotificationRoutes from './guest-notifications';
import guestProfileRoutes from './guest-profiles';
import socialRoutes from './social';
import eventRoutes from './events';
import venueSettingsRoutes from './venue-settings';
import { parseCookieHeader, verifyGuestCsrfRequest } from '../../lib/guest-csrf';

vi.mock('@c1rcle/core/staff-engine', () => ({
  hasStaffPermission: vi.fn(async () => false),
}));

vi.mock('@c1rcle/core/follow-graph-engine', () => ({
  followEntity: vi.fn(async (userId: string, targetId: string, targetType: string) => ({
    id: `${userId}_${targetId}`,
    followerId: userId,
    targetId,
    targetType,
  })),
  unfollowEntity: vi.fn(async () => ({ unfollowed: true })),
  isFollowing: vi.fn(async () => false),
}));

vi.mock('@c1rcle/core/guest-wallet-profile-notification-service', () => ({
  getGuestWallet: vi.fn(async () => ({ upcomingTickets: [], pastTickets: [], actionNeeded: [], cancelledTickets: [] })),
  getGuestWalletTicket: vi.fn(async () => null),
  getGuestProfileSummary: vi.fn(async (_db: any, _auth: any, profileUserId: string, viewerUserId: string | null) => ({
    profile: { uid: profileUserId, displayName: 'Guest Member', email: viewerUserId === profileUserId ? 'guest@example.com' : undefined },
    events: { upcoming: [], attended: [] },
  })),
  findGuestUserByEmail: vi.fn(async (_db: any, email: string) => ({ uid: 'user_lookup', email, displayName: 'Lookup Guest' })),
  getGuestNotifications: vi.fn(async () => [{ id: 'notif_1' }]),
  getGuestUnreadCount: vi.fn(async () => 1),
  markGuestNotificationRead: vi.fn(async () => ({ id: 'notif_1', isRead: true })),
  markAllGuestNotificationsRead: vi.fn(async () => ({ updated: 1 })),
}));

vi.mock('@c1rcle/core/guest-event-conversion', () => ({
  getEventQueueStatus: vi.fn(async () => ({ id: 'queue_1', status: 'waiting' })),
  getEventSurgeStatus: vi.fn(async () => ({ status: 'surge' })),
  joinEventQueue: vi.fn(async (_db: any, payload: any) => ({ id: 'queue_1', status: 'waiting', ...payload })),
  joinEventWaitlist: vi.fn(async (_db: any, payload: any) => ({ id: 'wl_1', status: 'waiting', ...payload })),
  toggleEventRsvp: vi.fn(async () => ({ success: true })),
  trackGuestEventInteraction: vi.fn(async () => ({ ok: true })),
  trackGuestEventView: vi.fn(async () => ({ ok: true })),
  verifyEventWaitlistAccess: vi.fn(async () => ({ id: 'wl_1' })),
}));

function buildDbMock() {
  return {
    batch() {
      return {
        update: vi.fn(),
        commit: vi.fn(async () => undefined),
      };
    },
    collection(name: string) {
      if (name === 'events') {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: true,
                  id,
                  data: () => ({
                    title: 'After Dark',
                    venueId: 'venue_1',
                    startDate: '2099-01-01T20:00:00.000Z',
                    tickets: [{ id: 'tier_1', name: 'GA', price: 999, quantity: 100, remaining: 80 }],
                  }),
                };
              },
            };
          },
          where() {
            return {
              get: vi.fn(async () => ({ docs: [] })),
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn(async () => ({ docs: [] })),
                })),
              })),
              limit: vi.fn(() => ({
                get: vi.fn(async () => ({ docs: [] })),
              })),
            };
          },
        };
      }

      if (name === 'venues') {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: true,
                  id,
                  data: () => ({ name: 'High Spirits', ownerId: 'venue_owner' }),
                };
              },
            };
          },
          where() {
            return {
              limit: vi.fn(() => ({
                get: vi.fn(async () => ({ empty: true, docs: [] })),
              })),
            };
          },
        };
      }

      if (name === 'table_reservations') {
        return {
          add: vi.fn(async (payload: any) => ({ id: `res_${payload.venueId}` })),
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn(async () => ({ docs: [] })),
                })),
              })),
              get: vi.fn(async () => ({ docs: [] })),
            })),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: vi.fn(async () => ({ docs: [] })),
              })),
            })),
          })),
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({ exists: false, data: () => null })),
            update: vi.fn(async () => undefined),
          })),
        };
      }

      if (name === 'users') {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  id,
                  exists: true,
                  data: () => ({
                    uid: id,
                    gender: 'man',
                    genderLastChangedAt: new Date().toISOString(),
                  }),
                };
              },
            };
          },
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ empty: false, docs: [{ id: 'user_lookup', data: () => ({ email: 'guest@example.com' }) }] })),
            })),
          })),
        };
      }

      return {
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
            })),
            get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
            })),
          })),
          limit: vi.fn(() => ({
            get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
          })),
          get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
          count: vi.fn(() => ({
            get: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
          })),
        })),
        doc: vi.fn((id: string) => ({
          get: vi.fn(async () => ({
            exists: name === 'orders',
            id,
            data: () => name === 'orders'
              ? { userId: 'user_1', eventId: 'event_1', status: 'payment_pending', totalAmount: 1499, isRSVP: false }
              : null,
          })),
          update: vi.fn(async () => undefined),
        })),
      };
    },
  };
}

async function buildServer() {
  const server = Fastify({ logger: false });

  server.decorate('db', buildDbMock() as any);
  server.decorate('cache', {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    invalidateNamespace: vi.fn(async () => undefined),
  } as any);
  server.decorate('requireRoles', vi.fn(() => async () => undefined) as any);
  server.decorate('checkoutService', {
    validatePricing: vi.fn(async () => ({ success: true, pricing: { items: [] } })),
    initiateCheckout: vi.fn(async () => ({ success: true, requiresPayment: false, order: { id: 'ord_1' }, pricing: { grandTotal: 0 } })),
    preparePayment: vi.fn(async () => ({ razorpayOrderId: 'order_rzp_1', amount: 1499, currency: 'INR' })),
    verifyPayment: vi.fn(async () => ({ success: true, order: { id: 'ord_1', status: 'confirmed' } })),
    getCancellationDecision: vi.fn(async () => ({ canCancel: true })),
    cancelOrder: vi.fn(async () => ({ success: true })),
    cancelCheckout: vi.fn(async () => ({ success: true })),
  } as any);
  server.decorate('orderRepo', {
    getOrderById: vi.fn(async (id: string) => ({ id, userId: 'user_1', eventId: 'event_1', status: 'payment_pending', totalAmount: 1499, isRSVP: false })),
    getReservationById: vi.fn(async () => null),
    updateOrder: vi.fn(async () => undefined),
  } as any);
  server.decorate('profileService', {
    createProfile: vi.fn(async () => undefined),
    updateProfile: vi.fn(async () => undefined),
    getPublicProfile: vi.fn(async () => null),
    getPosts: vi.fn(async () => []),
    getHighlights: vi.fn(async () => []),
  } as any);
  server.decorate('eventService', {
    listEvents: vi.fn(async () => ({ events: [] })),
    listNearby: vi.fn(async () => []),
    getEventByIdOrSlug: vi.fn(async () => null),
  } as any);
  server.decorate('publicDiscoveryService', {
    syncEventReadModels: vi.fn(async () => undefined),
    syncVenueReadModels: vi.fn(async () => undefined),
    syncHostReadModels: vi.fn(async () => undefined),
  } as any);
  server.decorate('invalidatePublicDiscovery', vi.fn(async () => undefined) as any);
  server.decorate('verifyPartnerAccess', vi.fn(async () => true) as any);
  server.decorate('writeAuditLog', vi.fn(async () => undefined) as any);
  server.decorate('auth', {} as any);
  server.decorateRequest('user', null);
  server.addHook('onRequest', async (request: any, reply) => {
    const cookies = parseCookieHeader(request.headers.cookie);
    if (request.headers.authorization || cookies.__session) {
      request.user = { uid: 'user_1', email: 'guest@example.com', displayName: 'Guest' };
    }

    if (request.user) {
      const csrf = verifyGuestCsrfRequest(request);
      if (!csrf.ok) {
        return reply.status(403).send(csrf.response);
      }
    }
  });

  await server.register(validatePlugin);
  await server.register(checkoutRoutes, { prefix: '/api/v1' });
  await server.register(paymentRoutes, { prefix: '/api/v1' });
  await server.register(orderRoutes, { prefix: '/api/v1/orders' });
  await server.register(ticketRoutes, { prefix: '/api/v1' });
  await server.register(guestNotificationRoutes, { prefix: '/api/v1' });
  await server.register(guestProfileRoutes, { prefix: '/api/v1' });
  await server.register(socialRoutes, { prefix: '/api/v1' });
  await server.register(eventRoutes, { prefix: '/api/v1' });
  await server.register(venueSettingsRoutes, { prefix: '/api/v1/venue-settings' });

  return server;
}

describe('Phase 4 auth enforcement matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('rejects unauthenticated guest mutations and protected reads across checkout, payments, orders, tickets, profile, social, queue, and venue reservation flows', async () => {
    const server = await buildServer();

    const cases = [
      ['POST', '/api/v1/checkout/reserve', { eventId: 'event_1', items: [{ tierId: 'tier_1', quantity: 1 }] }],
      ['POST', '/api/v1/checkout/initiate', { reservationId: 'res_1' }],
      ['POST', '/api/v1/payments/order', { orderId: 'ord_1' }],
      ['PATCH', '/api/v1/payments/verify', { orderId: 'ord_1', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1' }],
      ['GET', '/api/v1/orders/ord_1', undefined],
      ['POST', '/api/v1/orders/ord_1/cancel', { reason: 'change_of_plans' }],
      ['GET', '/api/v1/tickets', undefined],
      ['GET', '/api/v1/guest-notifications', undefined],
      ['GET', '/api/v1/guest-profiles/lookup?email=guest%40example.com', undefined],
      ['POST', '/api/v1/guest-profiles/avatar', undefined],
      ['POST', '/api/v1/follow', { targetId: 'host_1', targetType: 'host' }],
      ['POST', '/api/v1/events/event_1/rsvp', { shouldInclude: true }],
      ['POST', '/api/v1/events/event_1/queue', {}],
      ['POST', '/api/v1/venue-settings/venue/reservations', { venueId: 'venue_1', date: '2099-01-01', guests: 2, bookingType: 'restaurant' }],
    ] as const;

    for (const [method, url, payload] of cases) {
      const response = await server.inject({ method, url, payload });
      expect([401, 403], `${method} ${url} returned ${response.statusCode}`).toContain(response.statusCode);
    }

    await server.close();
  });

  it('requires CSRF for unsafe cookie-authenticated guest mutations', async () => {
    const server = await buildServer();
    const cookie = '__session=session_token; guest_csrf=token_1';

    const cases = [
      ['POST', '/api/v1/checkout/initiate', { reservationId: 'res_1' }],
      ['PATCH', '/api/v1/payments/verify', { orderId: 'ord_1', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1' }],
      ['POST', '/api/v1/orders/ord_1/cancel', { reason: 'change_of_plans' }],
      ['PATCH', '/api/v1/guest-notifications', { markAll: true }],
      ['POST', '/api/v1/follow', { targetId: 'host_1', targetType: 'host' }],
      ['POST', '/api/v1/events/event_1/rsvp', { shouldInclude: true }],
      ['POST', '/api/v1/events/event_1/queue', {}],
      ['POST', '/api/v1/venue-settings/venue/reservations', { venueId: 'venue_1', date: '2099-01-01', guests: 2, bookingType: 'restaurant' }],
    ] as const;

    for (const [method, url, payload] of cases) {
      const response = await server.inject({
        method,
        url,
        payload,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('CSRF_TOKEN_INVALID');
    }

    await server.close();
  });

  it('creates venue reservations for authenticated guests when CSRF is satisfied', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/venue-settings/venue/reservations',
      payload: {
        venueId: 'venue_1',
        venueName: 'High Spirits',
        date: '2099-01-01T20:00:00.000Z',
        time: '21:00',
        guests: 4,
        bookingType: 'restaurant',
        specialRequests: 'Window table',
      },
      headers: {
        cookie: '__session=session_token; guest_csrf=token_1',
        'x-csrf-token': 'token_1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      reservation: {
        venueId: 'venue_1',
        userId: 'user_1',
        guestEmail: 'guest@example.com',
        bookingType: 'restaurant',
        status: 'pending',
      },
    });

    await server.close();
  });
});
