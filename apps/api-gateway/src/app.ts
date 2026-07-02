// @ts-nocheck
import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import * as Sentry from '@sentry/node';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
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
import cacheControlPlugin from './plugins/cache-control';
import inngestPlugin from './plugins/inngest';
import eventRoutes from './routes/v1/events';
import checkoutRoutes from './routes/v1/checkout';
import paymentRoutes from './routes/v1/payments';
import hostRoutes from './routes/v1/host';
import scanRoutes from './routes/v1/scan';
import coverChargeRoutes from './routes/v1/cover-charge';
import ticketRoutes from './routes/v1/tickets';
import staffRoutes from './routes/v1/staff';
import userRoutes from './routes/v1/users';
import profileRoutes from './routes/v1/profiles';
import financeRoutes from './routes/v1/finance';
import promoterRoutes from './routes/v1/promoters';
import promoterV2Routes from './routes/v1/promoters-v2';
import analyticsRoutes from './routes/v1/analytics';
import tableRoutes from './routes/v1/tables';
import waitlistRoutes from './routes/v1/waitlist';
import searchRoutes from './routes/v1/search';
import publicRoutes from './routes/v1/public';
import recommendationRoutes from './routes/v1/recommendations';
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
import guestNotificationRoutes from './routes/v1/guest-notifications';
import venueSettingsRoutes from './routes/v1/venue-settings';
import venueRoutes from './routes/v1/venues';
import matchingRoutes from './routes/v1/matching';
import authRoutes from './routes/v1/auth';
import kycRoutes from './routes/v1/kyc';
import adminRoutes from './routes/v1/admin';
import socialRoutes from './routes/v1/social';
import socialLikesRoutes from './routes/v1/social-likes';
import chatRoutes from './routes/v1/chats';
import cronRoutes from './routes/v1/cron';
import guestProfileRoutes from './routes/v1/guest-profiles';
import guestPromoterRoutes from './routes/v1/guest-promoters';
import guestPassRoutes from './routes/v1/guest-passes';
import seoRoutes from './routes/seo';
import openApiRoutes from './routes/openapi';
import discoveryRoutes from './routes/v1/discovery';
import doorRoutes from './routes/v1/door';
import partnersHostRoutes from './routes/v1/partners/hosts';
import partnersVenueRoutes from './routes/v1/partners/venues';
import partnersPromoterRoutes from './routes/v1/partners/promoters';
import partnersFinanceRoutes from './routes/v1/partners/finance';
import supportRoutes from './routes/v1/support';
import { buildErrorResponse } from './lib/api-contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = Fastify({
  trustProxy: process.env.NODE_ENV === 'production',
  bodyLimit: 1048576, // 🛡️ Security: Limit request body to 1MB to prevent OOM attacks
  genReqId: function (req) {
    return (req.headers['x-request-id'] as string) || crypto.randomUUID();
  },
  logger: {
    redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          requestId: request.id,
        };
      },
    },
    // Production: plain JSON lines (readable by Cloud Logging / Datadog / Loki)
    // Development: pino-pretty for human-readable coloured output
    ...(process.env.NODE_ENV !== 'production'
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  },
});

async function main() {
  // @ts-ignore - Sentry v10 types may have inconsistent dsn property in BaseNodeOptions
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    // 10% trace sampling in production — errors always captured at 100%
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
  });

  // ⚡ REQUEST TRACING & SENTRY CONTEXT
  server.addHook('onRequest', async (request, reply) => {
    Sentry.setTag('request_id', request.id);
    reply.header('x-request-id', request.id);
  });

  // 🛡️ SECURITY HEADERS — applied to every response
  server.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    // HSTS only in production (dev uses plain HTTP)
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    // Minimal CSP — API gateway returns JSON, not HTML, but defence-in-depth
    reply.header('Content-Security-Policy', "default-src 'none'");

    const contentType = String(reply.getHeader('content-type') || '');
    if (reply.statusCode < 400 || !contentType.includes('application/json')) {
      return payload;
    }

    let body: any = payload;
    if (typeof payload === 'string') {
      try {
        body = JSON.parse(payload);
      } catch {
        return payload;
      }
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return payload;
    }

    const defaultCode =
      reply.statusCode === 400
        ? 'BAD_REQUEST'
        : reply.statusCode === 401
          ? 'UNAUTHORIZED'
          : reply.statusCode === 403
            ? 'FORBIDDEN'
            : reply.statusCode === 404
              ? 'NOT_FOUND'
              : reply.statusCode === 409
                ? 'CONFLICT'
                : reply.statusCode >= 500
                  ? 'INTERNAL_ERROR'
                  : 'REQUEST_ERROR';

    if (typeof body.error === 'string') {
      return JSON.stringify(
        buildErrorResponse({
          code: defaultCode,
          message: body.error,
          requestId: request.id,
        }),
      );
    }

    if (body.error && typeof body.error === 'object' && !body.error.requestId) {
      return JSON.stringify(
        buildErrorResponse({
          code: body.error.code || defaultCode,
          message: body.error.message || 'Request failed',
          requestId: request.id,
          details: body.error.details,
        }),
      );
    }

    return payload;
  });

  // ⚡ PERFORMANCE LOGGING: Track request duration
  server.addHook('preHandler', async (request: any) => {
    request.startTime = process.hrtime();
  });

  server.addHook('onResponse', async (request: any, reply: any) => {
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
        cache: reply.getHeader('Cache-Control') || 'no-cache',
      };

      // 🛡️ Reliability: Log Alert for Slow Targets (> 500ms)
      if (duration > 500 && reply.statusCode < 500) {
        server.log.warn(logData, `🔥 SLOW API ALERT: Endpoint ${request.url} exceeded 500ms`);
      } else {
        server.log.info(logData, `Response sent in ${durationMs}ms`);
      }
    }
  });

  // ⚡ GLOBAL ERROR HANDLER
  server.setErrorHandler(function (error: any, request, reply) {
    server.log.error(
      {
        requestId: request.id,
        url: request.url,
        method: request.method,
        error: error.message,
        stack: error.stack,
      },
      'Unhandled Error',
    );

    const isProd = process.env.NODE_ENV === 'production';
    const statusCode = error.statusCode || 500;
    const code = error.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
    const message =
      isProd && statusCode >= 500 ? 'Internal Server Error' : error.message || 'Request failed';
    const details = error.details || undefined;

    reply.status(statusCode).send(
      buildErrorResponse({
        code,
        message,
        requestId: request.id,
        details,
      }),
    );
  });

  // Register Core Plugins
  const allowedOrigins = Array.from(
    new Set(
      config.FRONTEND_URLS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  );
  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true,
  });
  await server.register(compress, {
    threshold: 1024, // Only compress responses larger than 1KB
    encodings: ['gzip', 'deflate', 'br'],
  });
  await server.register(websocket);
  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });
  await server.register(firebasePlugin);
  await server.register(redisPlugin);
  await server.register(cachePlugin);
  await server.register(realtimePlugin);
  await server.register(rbacPlugin);
  await server.register(featureFlagsPlugin);
  await server.register(rateLimitPlugin);
  await server.register(validatePlugin);
  await server.register(cacheControlPlugin);
  await server.register(inngestPlugin);
  await server.register(seoRoutes);
  await server.register(openApiRoutes);

  // Register Static File Hosting
  await server.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/', // Serve at root so /events/xxx.jpg works
  });

  // Register Routes
  await server.register(eventRoutes, { prefix: '/api/v1' });
  await server.register(checkoutRoutes, { prefix: '/api/v1' });
  await server.register(paymentRoutes, { prefix: '/api/v1' });
  await server.register(hostRoutes, { prefix: '/api/v1' });
  await server.register(scanRoutes, { prefix: '/api/v1/scan' });
  await server.register(coverChargeRoutes, { prefix: '/api/v1/cover-charge' });
  await server.register(ticketRoutes, { prefix: '/api/v1' });
  await server.register(userRoutes, { prefix: '/api/v1' });
  await server.register(profileRoutes, { prefix: '/api/v1' });
  await server.register(financeRoutes, { prefix: '/api/v1' });
  await server.register(promoterRoutes, { prefix: '/api/v1' });
  await server.register(promoterV2Routes, { prefix: '/api/v1/promoters' });
  await server.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await server.register(tableRoutes, { prefix: '/api/v1/tables' });
  await server.register(waitlistRoutes, { prefix: '/api/v1/waitlist' });
  await server.register(searchRoutes, { prefix: '/api/v1/search' });
  await server.register(publicRoutes, { prefix: '/api/v1/public' });
  await server.register(recommendationRoutes, { prefix: '/api/v1' });
  await server.register(calendarRoutes, { prefix: '/api/v1/calendar' });
  await server.register(promoRoutes, { prefix: '/api/v1/promos' });

  // Setup Sentry Error Handler (catches all unhandled exceptions)
  Sentry.setupFastifyErrorHandler(server);
  await server.register(cmsRoutes, { prefix: '/api/v1/cms' });
  await server.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  await server.register(orderRoutes, { prefix: '/api/v1/orders' });
  await server.register(partnershipRoutes, { prefix: '/api/v1/partnerships' });
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(kycRoutes, { prefix: '/api/v1/kyc' });
  await server.register(adminRoutes, { prefix: '/api/v1/admin' });
  await server.register(promoterLinksRoutes, { prefix: '/api/v1/promoter-links' });
  await server.register(refundRoutes, { prefix: '/api/v1/refunds' });
  await server.register(registerRoutes, { prefix: '/api/v1/registers' });
  await server.register(promoterConnectionsRoutes, { prefix: '/api/v1/promoter-connections' });
  await server.register(notificationsRoutes, { prefix: '/api/v1/notifications' });
  await server.register(guestNotificationRoutes, { prefix: '/api/v1' });
  await server.register(venueSettingsRoutes, { prefix: '/api/v1/venue-settings' });
  await server.register(venueRoutes, { prefix: '/api/v1' });
  await server.register(matchingRoutes, { prefix: '/api/v1/matching' });
  await server.register(discoveryRoutes, { prefix: '/api/v1/discovery' });
  await server.register(doorRoutes, { prefix: '/api/v1' });
  await server.register(socialRoutes, { prefix: '/api/v1' });
  await server.register(socialLikesRoutes, { prefix: '/api/v1' });
  await server.register(chatRoutes, { prefix: '/api/v1' });
  await server.register(cronRoutes, { prefix: '/api/v1' });
  await server.register(guestProfileRoutes, { prefix: '/api/v1' });
  await server.register(guestPromoterRoutes, { prefix: '/api/v1/public' });
  await server.register(guestPassRoutes, { prefix: '/api/v1' });
  await server.register(staffRoutes, { prefix: '/api/v1' });

  // Unified Partner Domain — new clean API (Phase 1)
  await server.register(partnersHostRoutes, { prefix: '/api/v1' });
  await server.register(partnersVenueRoutes, { prefix: '/api/v1' });
  await server.register(partnersPromoterRoutes, { prefix: '/api/v1' });
  await server.register(partnersFinanceRoutes, { prefix: '/api/v1' });
  await server.register(supportRoutes, { prefix: '/api/v1/support' });

  // Enhanced Database-aware Health Check
  const healthHandler = async (request: any, reply: any) => {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      services: {
        firestore: 'unknown',
        redis: 'unknown',
      },
    };

    try {
      // 1. Check Firestore with a lightweight read-only probe
      await server.db.collection('system_meta').doc('public_discovery').get();
      health.services.firestore = 'healthy';
    } catch (e: any) {
      health.services.firestore = 'unhealthy';
      health.status = 'error';
    }

    // 2. Check Redis — optional service; degraded state does not fail the health check
    if (server.redis && server.redis.status === 'ready') {
      health.services.redis = 'healthy';
    } else {
      health.services.redis = 'degraded';
      if (health.status === 'ok') health.status = 'degraded';
    }

    // 200 for ok/degraded; 503 only when Firestore (primary DB) is unreachable
    const statusCode = health.status === 'error' ? 503 : 200;
    return reply.status(statusCode).send(health);
  };

  server.get('/health', healthHandler);
  // Alias reachable via partner-dashboard catch-all proxy (/api/health → /api/v1/health)
  server.get('/api/v1/health', healthHandler);

  // Graceful Shutdown Handlers
  const gracefulShutdown = async (signal: string) => {
    server.log.info(`Received ${signal}. Shutting down Fastify server gracefully...`);
    try {
      await server.close();
      server.log.info('Server successfully closed.');
      process.exit(0);
    } catch (err: any) {
      server.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Validate optional feature credentials before accepting traffic
  const isProd = process.env.NODE_ENV === 'production';
  const firebaseWebKey =
    process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseWebKey) {
    const msg = 'FIREBASE_WEB_API_KEY is not set — email/password login and registration will fail';
    if (isProd) {
      server.log.error(msg);
      process.exit(1);
    } else server.log.warn(msg);
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    server.log.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google OAuth is disabled');
  }
  if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) {
    server.log.warn(
      'MSG91_AUTH_KEY / MSG91_TEMPLATE_ID not set — phone OTP uses mock codes in development',
    );
  }
  if (!process.env.RESEND_API_KEY) {
    server.log.warn('RESEND_API_KEY not set — email OTP uses mock codes in development');
  }

  // Start Listening
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    server.log.info(`API Gateway listening on http://0.0.0.0:${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
