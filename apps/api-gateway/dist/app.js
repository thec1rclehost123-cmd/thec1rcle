// @ts-nocheck
import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import websocket from '@fastify/websocket';
import * as Sentry from '@sentry/node';
import crypto from 'crypto';
import { config } from './config';
import firebasePlugin from './plugins/firebase';
import cachePlugin from './plugins/cache';
import redisPlugin from './plugins/redis';
import realtimePlugin from './plugins/realtime';
import rbacPlugin from './plugins/rbac';
import rateLimitPlugin from './plugins/rate-limit';
import validatePlugin from './plugins/validate';
import featureFlagsPlugin from './plugins/feature-flags';
import eventRoutes from './routes/v1/events';
import checkoutRoutes from './routes/v1/checkout';
import paymentRoutes from './routes/v1/payments';
import hostRoutes from './routes/v1/host';
import scanRoutes from './routes/v1/scan';
import ticketRoutes from './routes/v1/tickets';
import staffRoutes from './routes/v1/staff';
import profileRoutes from './routes/v1/profiles';
import financeRoutes from './routes/v1/finance';
import promoterRoutes from './routes/v1/promoters';
import analyticsRoutes from './routes/v1/analytics';
import tableRoutes from './routes/v1/tables';
import waitlistRoutes from './routes/v1/waitlist';
import searchRoutes from './routes/v1/search';
import calendarRoutes from './routes/v1/calendar';
import promoRoutes from './routes/v1/promos';
import cmsRoutes from './routes/v1/cms';
import inventoryRoutes from './routes/v1/inventory';
import orderRoutes from './routes/v1/orders';
import partnershipRoutes from './routes/v1/partnerships';
import promoterLinksRoutes from './routes/v1/promoter-links';
import refundRoutes from './routes/v1/refunds';
import registerRoutes from './routes/v1/registers';
import promoterConnectionsRoutes from './routes/v1/promoter-connections';
import notificationsRoutes from './routes/v1/notifications';
import venueSettingsRoutes from './routes/v1/venue-settings';
import venueRoutes from './routes/v1/venues';
import matchingRoutes from './routes/v1/matching';
import authRoutes from './routes/v1/auth';
import adminRoutes from './routes/v1/admin';
const server = Fastify({
    trustProxy: process.env.NODE_ENV === 'production',
    bodyLimit: 1048576, // 🛡️ Security: Limit request body to 1MB to prevent OOM attacks
    genReqId: function (req) {
        return req.headers['x-request-id'] || crypto.randomUUID();
    },
    // ... (logger remains same)
    logger: {
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
        serializers: {
            req(request) {
                return {
                    method: request.method,
                    url: request.url,
                    requestId: request.id
                };
            }
        },
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
});
async function main() {
    // @ts-ignore - Sentry v10 types may have inconsistent dsn property in BaseNodeOptions
    Sentry.init({
        dsn: process.env.SENTRY_DSN || "",
        tracesSampleRate: 1.0,
        environment: process.env.NODE_ENV || "development",
    });
    // ⚡ REQUEST TRACING & SENTRY CONTEXT
    server.addHook('onRequest', async (request, reply) => {
        Sentry.setTag("request_id", request.id);
        reply.header('x-request-id', request.id);
    });
    // ⚡ PERFORMANCE LOGGING: Track request duration
    server.addHook('preHandler', async (request) => {
        request.startTime = process.hrtime();
    });
    server.addHook('onResponse', async (request, reply) => {
        if (request.startTime) {
            const hrtime = process.hrtime(request.startTime);
            const durationMs = (hrtime[0] * 1e3 + hrtime[1] * 1e-6).toFixed(2);
            const duration = parseFloat(durationMs);
            // 📊 Observability: Tag performance metrics
            const logData = {
                requestId: request.id,
                url: request.url,
                route: request.routeOptions?.url || 'unknown_route',
                method: request.method,
                statusCode: reply.statusCode,
                durationMs: duration,
                cache: reply.getHeader('Cache-Control') || 'no-cache'
            };
            // 🛡️ Reliability: Log Alert for Slow Targets (> 500ms)
            if (duration > 500 && reply.statusCode < 500) {
                server.log.warn(logData, `🔥 SLOW API ALERT: Endpoint ${request.url} exceeded 500ms`);
            }
            else {
                server.log.info(logData, `Response sent in ${durationMs}ms`);
            }
        }
    });
    // ⚡ GLOBAL ERROR HANDLER
    server.setErrorHandler(function (error, request, reply) {
        server.log.error({
            requestId: request.id,
            url: request.url,
            method: request.method,
            error: error.message,
            stack: error.stack
        }, 'Unhandled Error');
        const isProd = process.env.NODE_ENV === 'production';
        const statusCode = error.statusCode || 500;
        if (isProd && statusCode >= 500) {
            reply.status(statusCode).send({ error: 'Internal Server Error', requestId: request.id });
        }
        else {
            reply.status(statusCode).send(error);
        }
    });
    // Register Core Plugins
    const allowedOrigins = config.FRONTEND_URLS ? config.FRONTEND_URLS.split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
    await server.register(cors, {
        origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
        credentials: true
    });
    await server.register(compress, {
        threshold: 1024, // Only compress responses larger than 1KB
        encodings: ['gzip', 'deflate', 'br']
    });
    await server.register(websocket);
    await server.register(firebasePlugin);
    await server.register(redisPlugin);
    await server.register(cachePlugin);
    await server.register(realtimePlugin);
    await server.register(rbacPlugin);
    await server.register(featureFlagsPlugin);
    await server.register(rateLimitPlugin);
    await server.register(validatePlugin);
    // Register Routes
    await server.register(eventRoutes, { prefix: '/api/v1' });
    await server.register(checkoutRoutes, { prefix: '/api/v1' });
    await server.register(paymentRoutes, { prefix: '/api/v1' });
    await server.register(hostRoutes, { prefix: '/api/v1' });
    await server.register(scanRoutes, { prefix: '/api/v1/scan' });
    await server.register(ticketRoutes, { prefix: '/api/v1' });
    await server.register(staffRoutes, { prefix: '/api/v1' });
    await server.register(profileRoutes, { prefix: '/api/v1' });
    await server.register(financeRoutes, { prefix: '/api/v1' });
    await server.register(promoterRoutes, { prefix: '/api/v1' });
    await server.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
    await server.register(tableRoutes, { prefix: '/api/v1/tables' });
    await server.register(waitlistRoutes, { prefix: '/api/v1/waitlist' });
    await server.register(searchRoutes, { prefix: '/api/v1/search' });
    await server.register(calendarRoutes, { prefix: '/api/v1/calendar' });
    await server.register(promoRoutes, { prefix: '/api/v1/promos' });
    // Setup Sentry Error Handler (catches all unhandled exceptions)
    Sentry.setupFastifyErrorHandler(server);
    await server.register(cmsRoutes, { prefix: '/api/v1/cms' });
    await server.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
    await server.register(orderRoutes, { prefix: '/api/v1/orders' });
    await server.register(partnershipRoutes, { prefix: '/api/v1/partnerships' });
    await server.register(authRoutes, { prefix: '/api/v1/auth' });
    await server.register(adminRoutes, { prefix: '/api/v1/admin' });
    await server.register(promoterLinksRoutes, { prefix: '/api/v1/promoter-links' });
    await server.register(refundRoutes, { prefix: '/api/v1/refunds' });
    await server.register(registerRoutes, { prefix: '/api/v1/registers' });
    await server.register(promoterConnectionsRoutes, { prefix: '/api/v1/promoter-connections' });
    await server.register(notificationsRoutes, { prefix: '/api/v1/notifications' });
    await server.register(venueSettingsRoutes, { prefix: '/api/v1/venue-settings' });
    await server.register(venueRoutes, { prefix: '/api/v1' });
    await server.register(matchingRoutes, { prefix: '/api/v1/matching' });
    // Enhanced Database-aware Health Check
    server.get('/health', async (request, reply) => {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptimeSeconds: process.uptime(),
            services: {
                firestore: 'unknown',
                redis: 'unknown'
            }
        };
        try {
            // 1. Check Firestore
            const startStr = Date.now().toString();
            await server.db.collection('health_checks').doc('ping').set({
                timestamp: new Date().toISOString(),
                id: startStr
            });
            health.services.firestore = 'healthy';
        }
        catch (e) {
            health.services.firestore = 'unhealthy';
            health.status = 'error';
        }
        // 2. Check Redis
        if (server.redis && server.redis.status === 'ready') {
            health.services.redis = 'healthy';
        }
        else {
            health.services.redis = 'unhealthy';
            health.status = 'error';
        }
        const statusCode = health.status === 'ok' ? 200 : 503;
        return reply.status(statusCode).send(health);
    });
    // Graceful Shutdown Handlers
    const gracefulShutdown = async (signal) => {
        server.log.info(`Received ${signal}. Shutting down Fastify server gracefully...`);
        try {
            await server.close();
            server.log.info('Server successfully closed.');
            process.exit(0);
        }
        catch (err) {
            server.log.error(err, 'Error during shutdown');
            process.exit(1);
        }
    };
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    // Start Listening
    try {
        await server.listen({ port: config.PORT, host: '0.0.0.0' });
        server.log.info(`API Gateway listening on http://0.0.0.0:${config.PORT}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=app.js.map