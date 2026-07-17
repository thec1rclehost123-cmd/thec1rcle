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
