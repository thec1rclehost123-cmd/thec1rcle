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
import matchingRoutes from './routes/v1/matching';
import authRoutes from './routes/v1/auth';
import adminRoutes from './routes/v1/admin';
const server = Fastify({
    genReqId: function (req) {
        return req.headers['x-request-id'] || crypto.randomUUID();
    },
    // ... (logger remains same)
    logger: {
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
    // ⚡ Initialize Sentry
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
            // Log metrics for performance auditing
            server.log.info({
                requestId: request.id,
                url: request.url,
                route: request.routeOptions?.url || 'unknown_route',
                method: request.method,
                statusCode: reply.statusCode,
                durationMs,
                cache: reply.getHeader('Cache-Control') || 'no-cache'
            }, `Response sent in ${durationMs}ms`);
        }
    });
    // ⚡ ERROR LOGGING
    server.addHook('onError', async (request, reply, error) => {
        server.log.error({
            requestId: request.id,
            url: request.url,
            method: request.method,
            error: error.message,
            stack: error.stack
        }, 'Unhandled Error');
    });
    // Register Core Plugins
    await server.register(cors, { origin: true });
    await server.register(compress);
    await server.register(websocket);
    await server.register(firebasePlugin);
    await server.register(redisPlugin);
    await server.register(cachePlugin);
    await server.register(realtimePlugin);
    await server.register(rbacPlugin);
    await server.register(rateLimitPlugin);
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
    await server.register(matchingRoutes, { prefix: '/api/v1/matching' });
    // Basic Health Check
    server.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });
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