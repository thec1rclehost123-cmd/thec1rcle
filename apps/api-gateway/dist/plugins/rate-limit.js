import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
/**
 * 🛡️ Dynamic Rate Limiting Plugin
 *
 * Enforces API rate limits based on endpoint sensitivity and user authentication state.
 */
export default fp(async (fastify) => {
    await fastify.register(rateLimit, {
        global: true,
        max: (req) => {
            // Internal network / health checks bypass limits
            if (req.url.startsWith('/health') || req.url.startsWith('/metrics')) {
                return 0; // 0 = unlimited
            }
            // Auth Routes: Strict limit to prevent brute force (e.g. login, onboarding)
            if (req.url.startsWith('/api/v1/auth')) {
                return 10;
            }
            // Sensitive Mutations (POST/PUT/PATCH/DELETE): Tighter limits
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                return 30;
            }
            // Default Public GET routes: Moderate limit
            return 150;
        },
        timeWindow: '1 minute',
        hook: 'preValidation',
        keyGenerator: (req) => {
            // @ts-ignore - extract user if authenticated
            if (req.user && req.user.uid) {
                // @ts-ignore
                return req.user.uid;
            }
            // Fallback to IP for unauthenticated requests
            return req.ip;
        },
        errorResponseBuilder: function (req, context) {
            fastify.log.warn({
                requestId: req.id,
                url: req.url,
                ip: req.ip,
                user: req.user?.uid || 'guest',
                rateLimitLimit: context.max,
            }, 'Rate limit exceeded');
            return {
                statusCode: 429,
                error: 'Too Many Requests',
                message: `I'm sorry, you've hit the rate limit. Please try again in a minute.`,
                requestId: req.id,
                expiresIn: context.after
            };
        }
    });
    fastify.log.info('Rate Limit security plugin initialized');
});
//# sourceMappingURL=rate-limit.js.map