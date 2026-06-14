import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import websocket from "@fastify/websocket";
import { config } from "./config";
import firebasePlugin from "./plugins/firebase";
import cachePlugin from "./plugins/cache";
import redisPlugin from "./plugins/redis";
import realtimePlugin from "./plugins/realtime";
import eventRoutes from "./routes/v1/events";
import checkoutRoutes from "./routes/v1/checkout";
import paymentRoutes from "./routes/v1/payments";
import hostRoutes from "./routes/v1/host";
import scanRoutes from "./routes/v1/scan";
import ticketRoutes from "./routes/v1/tickets";
import staffRoutes from "./routes/v1/staff";
import profileRoutes from "./routes/v1/profiles";
import financeRoutes from "./routes/v1/finance";
import promoterRoutes from "./routes/v1/promoters";
import analyticsRoutes from "./routes/v1/analytics";
import tableRoutes from "./routes/v1/tables";
import waitlistRoutes from "./routes/v1/waitlist";
import searchRoutes from "./routes/v1/search";
import calendarRoutes from "./routes/v1/calendar";
import promoRoutes from "./routes/v1/promos";
import cmsRoutes from "./routes/v1/cms";
import inventoryRoutes from "./routes/v1/inventory";
import orderRoutes from "./routes/v1/orders";
import partnershipRoutes from "./routes/v1/partnerships";
import promoterLinksRoutes from "./routes/v1/promoter-links";
import refundRoutes from "./routes/v1/refunds";
import registerRoutes from "./routes/v1/registers";
import promoterConnectionsRoutes from "./routes/v1/promoter-connections";
import notificationsRoutes from "./routes/v1/notifications";
import venueSettingsRoutes from "./routes/v1/venue-settings";
import matchingRoutes from "./routes/v1/matching";

const server = Fastify({
  // ... (logger remains same)
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

async function main() {
  // ⚡ PERFORMANCE LOGGING: Track request duration
  server.addHook("preHandler", async (request: any) => {
    request.startTime = process.hrtime();
  });

  server.addHook("onResponse", async (request: any, reply: any) => {
    if (request.startTime) {
      const hrtime = process.hrtime(request.startTime);
      const durationMs = (hrtime[0] * 1e3 + hrtime[1] * 1e-6).toFixed(2);

      // Log metrics for performance auditing
      server.log.info(
        {
          url: request.url,
          method: request.method,
          statusCode: reply.statusCode,
          durationMs,
          cache: reply.getHeader("Cache-Control") || "no-cache",
        },
        `Response sent in ${durationMs}ms`,
      );
    }
  });

  // Register Core Plugins
  await server.register(cors, { origin: true });
  await server.register(compress);
  await server.register(websocket);
  await server.register(firebasePlugin);
  await server.register(redisPlugin);
  await server.register(cachePlugin);
  await server.register(realtimePlugin);

  // Register Routes
  await server.register(eventRoutes, { prefix: "/api/v1" });
  await server.register(checkoutRoutes, { prefix: "/api/v1" });
  await server.register(paymentRoutes, { prefix: "/api/v1" });
  await server.register(hostRoutes, { prefix: "/api/v1" });
  await server.register(scanRoutes, { prefix: "/api/v1/scan" });
  await server.register(ticketRoutes, { prefix: "/api/v1" });
  await server.register(staffRoutes, { prefix: "/api/v1" });
  await server.register(profileRoutes, { prefix: "/api/v1" });
  await server.register(financeRoutes, { prefix: "/api/v1" });
  await server.register(promoterRoutes, { prefix: "/api/v1" });
  await server.register(analyticsRoutes, { prefix: "/api/v1/analytics" });
  await server.register(tableRoutes, { prefix: "/api/v1/tables" });
  await server.register(waitlistRoutes, { prefix: "/api/v1/waitlist" });
  await server.register(searchRoutes, { prefix: "/api/v1/search" });
  await server.register(calendarRoutes, { prefix: "/api/v1/calendar" });
  await server.register(promoRoutes, { prefix: "/api/v1/promos" });
  await server.register(cmsRoutes, { prefix: "/api/v1/cms" });
  await server.register(inventoryRoutes, { prefix: "/api/v1/inventory" });
  await server.register(orderRoutes, { prefix: "/api/v1/orders" });
  await server.register(partnershipRoutes, { prefix: "/api/v1/partnerships" });
  await server.register(promoterLinksRoutes, { prefix: "/api/v1/promoter-links" });
  await server.register(refundRoutes, { prefix: "/api/v1/refunds" });
  await server.register(registerRoutes, { prefix: "/api/v1/registers" });
  await server.register(promoterConnectionsRoutes, { prefix: "/api/v1/promoter-connections" });
  await server.register(notificationsRoutes, { prefix: "/api/v1/notifications" });
  await server.register(venueSettingsRoutes, { prefix: "/api/v1/venue-settings" });
  await server.register(matchingRoutes, { prefix: "/api/v1/matching" });

  // Basic Health Check
  server.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Start Listening
  try {
    await server.listen({ port: config.PORT, host: "0.0.0.0" });
    server.log.info(`API Gateway listening on http://0.0.0.0:${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
