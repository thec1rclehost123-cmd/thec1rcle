import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance, FastifyRequest } from 'fastify';
// @ts-ignore
import { checkAdaptiveRateLimit } from '@c1rcle/core/rate-limiter';

/**
 * 🛡️ Dynamic Rate Limiting Plugin
 * 
 * Enforces API rate limits based on endpoint sensitivity and user authentication state.
 */

export default fp(async (fastify: FastifyInstance) => {
    // 🛡️ Layer 1: Fail-Closed Security for Sensitive Ghost Bridge Routes
    // These endpoints MUST NOT operate if the security system (Redis) is down.
    fastify.addHook('preHandler', async (request, reply) => {
        const isHandshake = request.url.includes('/api/v1/tickets/') && request.url.includes('/handshake');
        const isMatching  = request.url.startsWith('/api/v1/matching');
        const isProfile   = request.url.startsWith('/api/v1/profiles/');

        if (isHandshake || isMatching || isProfile) {
            // @ts-ignore
            const identifier = request.user?.uid || request.ip;
            
            try {
                const { success, reset } = await checkAdaptiveRateLimit(
                    `sensitive:${identifier}`,
                    30, 
                    60, 
                    'ip', 
                    request.ip,
                    true // 🔒 failClosed: true
                );

                if (!success) {
                    reply.code(429).send({
                        error: 'Too Many Requests',
                        message: 'Security threshold exceeded or security system unavailable. Critical routes are locked for protection.',
                        retryAfter: reset
                    });
                    return;
                }
            } catch (error) {
                fastify.log.error({ err: error, url: request.url }, 'Fail-closed security check triggered');
                reply.code(503).send({
                    error: 'Service Unavailable',
                    message: 'Security system is currently offline. Critical operations are suspended.'
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

            // 2. Auth Routes: Strict limit to prevent brute force
            if (req.url.startsWith('/api/v1/auth')) {
                return 15;
            }

            // 3. Handshake & Matching: Strict protection for identity reveal
            if (req.url.includes('/api/v1/tickets/') || 
                req.url.includes('/api/v1/profiles/') ||
                req.url.startsWith('/api/v1/matching')) {
                return 30;
            }

            // 4. Admin & Search: Moderate protection
            if (req.url.startsWith('/api/v1/admin') || req.url.startsWith('/api/v1/search')) {
                return 50;
            }

            // 4. SaaS Dynamic Quotas (Plan-based)
            // @ts-ignore
            const workspace = req.workspace;
            if (workspace) {
                // Return limit based on subscription plan
                const plan = (workspace.plan || 'basic').toLowerCase();
                if (plan === 'enterprise') return 5000;
                if (plan === 'pro') return 1000;
                return 150; // Basic plan limit
            }

            // 5. Sensitive Mutations (POST/PUT/PATCH/DELETE)
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                return 30;
            }

            // 6. Default Public GET routes
            return 150;
        },
        timeWindow: '1 minute',
        hook: 'preValidation',
        continueExceeding: true, // ⚠️ Performance: Allow burst over limit without immediate blocking
        skipOnError: true, // 🛡️ Reliability: Bypass rate limiting if Redis/Logic fails
        keyGenerator: (req: FastifyRequest) => {
            // @ts-ignore - prioritize workspace-level limiting
            const workspaceId = req.workspaceId;
            // @ts-ignore - extract user if authenticated
            const uid = req.user?.uid;

            return workspaceId ? `ws:${workspaceId}` : (uid || req.ip);
        },
        errorResponseBuilder: function (req, context) {
            fastify.log.warn({
                requestId: req.id,
                url: req.url,
                ip: req.ip,
                user: (req as any).user?.uid || 'guest',
                rateLimitLimit: context.max,
            }, 'Rate limit exceeded');

            return {
                statusCode: 429,
                error: 'Too Many Requests',
                message: `You've reached the request limit for this minute. Please pause for a moment.`,
                requestId: req.id,
                expiresIn: context.after
            };
        }
    });

    fastify.log.info('Rate Limit security plugin initialized');
});
