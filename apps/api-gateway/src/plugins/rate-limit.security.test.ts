import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import rateLimitPlugin from './rate-limit.js';

describe('Gateway rate-limit identity isolation', () => {
  it('does not pool authenticated proxy traffic under one shared IP key', async () => {
    const server = Fastify({ logger: false });
    await server.register(rateLimitPlugin);
    server.get('/api/v1/discovery', async () => ({ ok: true }));

    for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/discovery',
        headers: { authorization: 'Bearer qa-token-a' },
      });
      expect(response.statusCode).toBe(200);
    }

    const exhaustedResponse = await server.inject({
      method: 'GET',
      url: '/api/v1/discovery',
      headers: { authorization: 'Bearer qa-token-a' },
    });
    expect(exhaustedResponse.statusCode).toBe(429);

    const independentCredentialResponse = await server.inject({
      method: 'GET',
      url: '/api/v1/discovery',
      headers: { authorization: 'Bearer qa-token-b' },
    });
    expect(independentCredentialResponse.statusCode).toBe(200);

    await server.close();
  });

  it('keeps discovery limits isolated from unrelated authenticated reads', async () => {
    const server = Fastify({ logger: false });
    await server.register(rateLimitPlugin);
    server.get('/api/v1/dashboard-read', async () => ({ ok: true }));
    server.get('/api/v1/discovery', async () => ({ ok: true }));

    for (let requestNumber = 0; requestNumber < 61; requestNumber += 1) {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard-read',
        headers: { authorization: 'Bearer qa-token-a' },
      });
      expect(response.statusCode).toBe(200);
    }

    const discoveryResponse = await server.inject({
      method: 'GET',
      url: '/api/v1/discovery',
      headers: { authorization: 'Bearer qa-token-a' },
    });
    expect(discoveryResponse.statusCode).toBe(200);

    await server.close();
  });
});
