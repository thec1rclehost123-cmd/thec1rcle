import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance, FastifyRequest } from 'fastify';
// @ts-ignore
import { checkAdaptiveRateLimit } from '@c1rcle/core/rate-limiter';

/**
 * 🛡️ Dynamic Rate Limiting Plugin
 *
 * Enforces API rate limits based on endpoint sensitivity and user authentication state.
 * Key ordering matters — more specific rules must come before the generic fallbacks.
 */

export default fp(async (fastify: FastifyInstance) => {
  // 🛡️ Layer 1: Fail-Closed Security for Sensitive Ghost Bridge Routes
  // These endpoints MUST NOT operate if the security system (Redis) is down.
  fastify.addHook('preHandler', async (request, reply) => {
    const isHandshake =
      request.url.includes('/api/v1/tickets/') && request.url.includes('/handshake');
    const isMatching = request.url.startsWith('/api/v1/matching');
    const isProfile = request.url.startsWith('/api/v1/profiles/');
    const isCheckEmail = request.url.includes('/api/v1/auth/check-email');

    if (isHandshake || isMatching || isProfile || isCheckEmail) {
      // @ts-ignore
      const identifier = request.user?.uid || request.ip;
      const maxLimit = isCheckEmail ? 5 : 30;

      try {
        const { success, reset } = await checkAdaptiveRateLimit(
          `sensitive:${identifier}`,
          maxLimit,
          60,
          'ip',
          request.ip,
          true, // 🔒 failClosed: true
        );

        if (!success) {
          reply.code(429).send({
            error: 'Too Many Requests',
            message:
              'Security threshold exceeded or security system unavailable. Critical routes are locked for protection.',
            retryAfter: reset,
          });
          return;
        }
      } catch (error) {
        fastify.log.error({ err: error, url: request.url }, 'Fail-closed security check triggered');
        reply.code(503).send({
          error: 'Service Unavailable',
          message: 'Security system is currently offline. Critical operations are suspended.',
        });
        return;
      }
    }
  });

  // 🛡️ Layer 2: General API Availability (Fail-Open)
  // For non-critical routes, we prioritize availability over strict enforcement.
  await fastify.register(rateLimit, {
    global: true,
    max: (req: FastifyRequest) => {
      // 1. Internal network / health checks bypass limits
      if (req.url.startsWith('/health') || req.url.startsWith('/metrics')) {
        return 1000;
      }

      // 2. Auth routes: strict limit to prevent brute force
      if (req.url.startsWith('/api/v1/auth')) {
        return 300;
      }

      // 3. Handshake & Matching: Strict protection for identity reveal
      if (
        req.url.includes('/api/v1/tickets/') ||
        req.url.includes('/api/v1/profiles/') ||
        req.url.startsWith('/api/v1/matching')
      ) {
        return 30;
      }

      // 4. Admin routes: tightly limited regardless of auth state
      if (req.url.startsWith('/api/v1/admin')) {
        return 100;
      }

      // 5. Search: moderate
      if (req.url.startsWith('/api/v1/search')) {
        return 500;
      }

      // 6. High-risk financial / abuse-prone endpoints
      if (
        req.url.includes('/api/v1/partners/promoters/payouts') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ) {
        return 5;
      }

      if (req.url.includes('/api/v1/discovery')) {
        return 60;
      }

      if (
        req.url.includes('/checkout/cancel') ||
        req.url.includes('/refunds/request') ||
        req.url.includes('/promos/validate') ||
        req.url.includes('/checkout/promo')
      ) {
        return 50;
      }

      // 6. SaaS Dynamic Quotas (plan-based) — only if workspace context is present
      // @ts-ignore
      const workspace = req.workspace;
      if (workspace) {
        const plan = (workspace.plan || 'basic').toLowerCase();
        if (plan === 'enterprise') return 5000;
        if (plan === 'pro') return 1000;
        return 500; // basic plan
      }

      // 7. Generic write operations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return 100;
      }

      // 8. Default: public GETs
      return 1000;
    },
    timeWindow: '1 minute',
    hook: 'preValidation',
    // continueExceeding keeps the block window alive on each subsequent infraction
    continueExceeding: true,
    // Fail-closed if Redis is unavailable — in-memory fallback enforces limits
    skipOnError: false,
    keyGenerator: (req: FastifyRequest) => {
      // @ts-ignore - workspace-level key preferred (SaaS quota)
      const workspaceId = req.workspaceId;
      // @ts-ignore - authenticated user key (prevents sharing limit across IPs)
      const uid = req.user?.uid;
      return workspaceId ? `ws:${workspaceId}` : uid || req.ip;
    },
    onExceeding: (req: FastifyRequest) => {
      fastify.log.warn(
        {
          url: req.url,
          ip: req.ip,
          uid: (req as any).user?.uid || 'anon',
        },
        'SECURITY: Rate limit approaching',
      );
    },
    errorResponseBuilder: function (req, context) {
      fastify.log.warn(
        {
          requestId: req.id,
          url: req.url,
          ip: req.ip,
          user: (req as any).user?.uid || 'guest',
          rateLimitLimit: context.max,
        },
        'SECURITY: Rate limit exceeded — request blocked',
      );

      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `You've reached the request limit for this minute. Please pause for a moment.`,
        requestId: req.id,
        expiresIn: context.after,
      };
    },
  });

  fastify.log.info('Rate Limit security plugin initialized');
});
