import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

/**
 * Global Cache-Control header policy.
 *
 * Rules (evaluated in order, first match wins):
 *  1. Mutations (POST/PATCH/PUT/DELETE) → no-store
 *  2. GET /api/v1/checkout/* → no-store (live pricing must never be cached)
 *  3. GET /api/v1/public/*  → public, max-age=300, stale-while-revalidate=60
 *  4. GET on user-private routes (orders, tickets, notifications) → private, no-store
 *  5. All other authenticated GETs → private, max-age=60
 */
export default fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onSend', async (request, reply) => {
    if (reply.hasHeader('Cache-Control')) return;

    const method = request.method.toUpperCase();
    const url = request.url;

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      reply.header('Cache-Control', 'no-store, no-cache');
      return;
    }

    if (method !== 'GET') return;

    if (url.startsWith('/api/v1/checkout')) {
      reply.header('Cache-Control', 'no-store');
      return;
    }

    if (url.startsWith('/api/v1/auth/me')) {
      reply.header('Cache-Control', 'private, no-store');
      return;
    }

    if (url.startsWith('/api/v1/public')) {
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      return;
    }

    const privateNoStore = [
      '/api/v1/orders',
      '/api/v1/tickets',
      '/api/v1/guest-notifications',
      '/api/v1/payments',
    ];
    if (privateNoStore.some((prefix) => url.startsWith(prefix))) {
      reply.header('Cache-Control', 'private, no-store');
      return;
    }

    reply.header('Cache-Control', 'private, max-age=60');
  });
});
