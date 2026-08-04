import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'mock-timestamp',
    increment: (val: number) => `mock-increment-${val}`,
    arrayUnion: (...args: any[]) => `mock-array-union-${JSON.stringify(args)}`,
  },
}));

vi.mock('@c1rcle/core/admin', () => ({
  getAdminStorage: () => ({
    bucket: () => ({
      name: 'mock-bucket',
      file: () => ({
        save: async () => {},
      }),
    }),
  }),
}));

vi.mock('../../lib/signed-urls.js', () => ({
  enrichSupportTicketWithSignedUrls: vi.fn((ticket) => ticket),
  cleanSupportTicketBeforeSave: vi.fn(),
  signStorageUrl: vi.fn(async (url) => url),
}));

import validatePlugin from '../../plugins/validate';
import supportRoutes from './support';

async function buildServer(dbMock: any, currentUser: any = null) {
  const server = Fastify({ logger: false });
  server.decorate('db', dbMock);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  server.addHook('onRequest', async (request: any) => {
    if (currentUser) {
      request.user = currentUser;
    }
  });

  await server.register(validatePlugin);
  await server.register(supportRoutes, { prefix: '/support' });
  return server;
}

describe('Support Tickets IDOR Validation Tests', () => {
  it('POST /support/tickets/:id/reply - rejects unauthenticated users', async () => {
    const dbMock = {};
    const server = await buildServer(dbMock, null);

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/reply',
      payload: { message: 'Hello' },
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it('POST /support/tickets/:id/reply - rejects with 404 if ticket not found', async () => {
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    const dbMock = {
      collection: () => ({
        doc: () => ({
          get: getMock,
        }),
      }),
    };
    const server = await buildServer(dbMock, { uid: 'user_1', email: 'user1@example.com' });

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/reply',
      payload: { message: 'Hello' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Ticket not found' });
    expect(getMock).toHaveBeenCalled();
    await server.close();
  });

  it('POST /support/tickets/:id/reply - blocks IDOR (ticket belongs to user_2, user_1 tries to reply)', async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        userId: 'user_2',
        messages: [],
        timeline: [],
      }),
    });
    const dbMock = {
      collection: () => ({
        doc: () => ({
          get: getMock,
        }),
      }),
    };
    const server = await buildServer(dbMock, { uid: 'user_1', email: 'user1@example.com' });

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/reply',
      payload: { message: 'Hello' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    await server.close();
  });

  it('POST /support/tickets/:id/reply - allows reply if ticket belongs to the user', async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        userId: 'user_1',
        messages: [],
        timeline: [],
      }),
    });
    const updateMock = vi.fn().mockResolvedValue(null);
    const dbMock = {
      collection: () => ({
        doc: () => ({
          get: getMock,
          update: updateMock,
        }),
      }),
    };
    const server = await buildServer(dbMock, { uid: 'user_1', email: 'user1@example.com' });

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/reply',
      payload: { message: 'Hello' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Reply registered successfully' });
    expect(updateMock).toHaveBeenCalled();
    await server.close();
  });

  it('POST /support/tickets/:id/feedback - blocks IDOR', async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        userId: 'user_2',
        timeline: [],
      }),
    });
    const dbMock = {
      collection: () => ({
        doc: () => ({
          get: getMock,
        }),
      }),
    };
    const server = await buildServer(dbMock, { uid: 'user_1', email: 'user1@example.com' });

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/feedback',
      payload: { rating: 5, comment: 'Great', resolved: true },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    await server.close();
  });

  it('POST /support/tickets/:id/feedback - allows feedback if owner', async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        userId: 'user_1',
        timeline: [],
      }),
    });
    const updateMock = vi.fn().mockResolvedValue(null);
    const dbMock = {
      collection: () => ({
        doc: () => ({
          get: getMock,
          update: updateMock,
        }),
      }),
    };
    const server = await buildServer(dbMock, { uid: 'user_1', email: 'user1@example.com' });

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/feedback',
      payload: { rating: 5, comment: 'Great', resolved: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Feedback submitted successfully' });
    expect(updateMock).toHaveBeenCalled();
    await server.close();
  });

  it('POST /support/tickets/:id/reopen - blocks IDOR', async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        userId: 'user_2',
        timeline: [],
      }),
    });
    const dbMock = {
      collection: () => ({
        doc: () => ({
          get: getMock,
        }),
      }),
    };
    const server = await buildServer(dbMock, { uid: 'user_1', email: 'user1@example.com' });

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/reopen',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    await server.close();
  });

  it('POST /support/tickets/:id/reopen - allows reopen if owner', async () => {
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        userId: 'user_1',
        timeline: [],
      }),
    });
    const updateMock = vi.fn().mockResolvedValue(null);
    const dbMock = {
      collection: () => ({
        doc: () => ({
          get: getMock,
          update: updateMock,
        }),
      }),
    };
    const server = await buildServer(dbMock, { uid: 'user_1', email: 'user1@example.com' });

    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets/ticket_123/reopen',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Ticket reopened successfully' });
    expect(updateMock).toHaveBeenCalled();
    await server.close();
  });
});

describe('Support submission contract tests', () => {
  function submissionDb() {
    const writes: Array<Record<string, any>> = [];
    return {
      writes,
      db: {
        collection: () => ({
          doc: () => {
            let saved: Record<string, any> = {};
            return {
              set: vi.fn(async (value: Record<string, any>) => {
                saved = value;
                writes.push(value);
              }),
              get: vi.fn(async () => ({ exists: true, data: () => saved })),
            };
          },
        }),
      },
    };
  }

  it('accepts the partner dashboard support-ticket payload', async () => {
    const { db, writes } = submissionDb();
    const server = await buildServer(db, { uid: 'user_1', email: 'user1@example.com' });
    const response = await server.inject({
      method: 'POST',
      url: '/support/tickets',
      payload: {
        subject: 'Ticket setup issue',
        category: 'Ticketing - Ticket Inventory Problems',
        priority: 'medium',
        description: 'Inventory is not updating.',
        relatedEvent: '',
        relatedEventId: '',
        images: [],
        documents: [],
        contactMethod: 'email',
        partnerId: 'venue_1',
        currentModule: 'Support Module',
        browserInfo: 'Browser',
        deviceInfo: 'Device',
        appVersion: 'staging',
        errorLogs: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(writes[0]).toMatchObject({
      subject: 'Ticket setup issue',
      userId: 'user_1',
      status: 'new',
    });
    await server.close();
  });

  it('accepts complete bug and feature submissions and returns field errors for incomplete bugs', async () => {
    const { db, writes } = submissionDb();
    const server = await buildServer(db, { uid: 'user_1', email: 'user1@example.com' });
    const validBug = {
      title: 'Checkout stalls',
      description: 'The checkout remains on the loading state.',
      stepsToReproduce: 'Open checkout and submit.',
      expectedResult: 'Payment sheet opens.',
      actualResult: 'Loading state remains.',
      browserInfo: 'Browser',
      deviceInfo: 'Device',
      appVersion: 'staging',
      screenshots: [],
      screenRecordings: [],
    };

    const bugResponse = await server.inject({
      method: 'POST',
      url: '/support/bugs',
      payload: validBug,
    });
    const featureResponse = await server.inject({
      method: 'POST',
      url: '/support/feature-requests',
      payload: {
        title: 'Saved report filters',
        description: 'Let operators save their most-used report filters.',
      },
    });
    const invalidResponse = await server.inject({
      method: 'POST',
      url: '/support/bugs',
      payload: { ...validBug, expectedResult: '' },
    });

    expect(bugResponse.statusCode).toBe(200);
    expect(featureResponse.statusCode).toBe(200);
    expect(writes).toHaveLength(2);
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json()).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ path: 'expectedResult', message: 'Expected Result is required' }],
      },
    });
    await server.close();
  });

  it('returns only currently visible bulletins for the authenticated partner role', async () => {
    const date = (iso: string) => ({ toDate: () => new Date(iso) });
    const docs = [
      {
        id: 'active',
        data: () => ({
          title: 'Venue bulletin',
          content: 'Visible now',
          status: 'published',
          audience: ['venue'],
          publishStart: date('2026-01-01T00:00:00.000Z'),
          publishEnd: date('2027-01-01T00:00:00.000Z'),
          createdAt: date('2026-07-01T00:00:00.000Z'),
        }),
      },
      {
        id: 'future',
        data: () => ({
          title: 'Future bulletin',
          content: 'Not visible yet',
          status: 'published',
          audience: ['venue'],
          publishStart: date('2027-01-01T00:00:00.000Z'),
          createdAt: date('2026-07-02T00:00:00.000Z'),
        }),
      },
      {
        id: 'wrong-role',
        data: () => ({
          title: 'Host bulletin',
          content: 'Hosts only',
          status: 'published',
          audience: ['host'],
          createdAt: date('2026-07-03T00:00:00.000Z'),
        }),
      },
    ];
    const db = {
      collection: () => ({
        get: vi.fn(async () => ({ empty: false, docs })),
      }),
    };
    const server = await buildServer(db, {
      uid: 'venue_user',
      email: 'venue@example.com',
      role: 'venue',
    });
    const response = await server.inject({
      method: 'GET',
      url: '/support/announcements',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().announcements.map((item: any) => item.id)).toEqual(['active']);
    await server.close();
  });
});
