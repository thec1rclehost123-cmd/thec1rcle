import { FastifyInstance } from "fastify";
import {
  getVenueAnalytics,
  getHostAnalytics,
  getPromoterFunnel,
} from "@c1rcle/core/analytics-engine";

export default async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/analytics/venue/:id
   * Gets performance analytics for a venue
   */
  fastify.get("/venue/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { range } = request.query as { range?: string };

    try {
      const stats = await getVenueAnalytics(id, range);
      return stats;
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/v1/analytics/host/:id
   * Gets performance analytics for a host
   */
  fastify.get("/host/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const stats = await getHostAnalytics(id);
      return stats;
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/v1/analytics/promoter/:id
   * Gets funnel analytics for a promoter
   */
  fastify.get("/promoter/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const funnel = await getPromoterFunnel(id);
      return funnel;
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/v1/analytics/:type/:id/:subCategory
   */
  fastify.get("/:type/:id/:subCategory", async (request, reply) => {
    const { type, id, subCategory } = request.params as any;
    try {
      const engine = await import("@c1rcle/core/analytics-engine");
      const methodName = `get${type.charAt(0).toUpperCase() + type.slice(1)}${subCategory.charAt(0).toUpperCase() + subCategory.slice(1)}Analytics`;

      if (typeof (engine as any)[methodName] === "function") {
        return await (engine as any)[methodName](fastify.db, id);
      }

      // Fallback for overview if named different
      if (subCategory === "overview") {
        const overviewMethod = `get${type.charAt(0).toUpperCase() + type.slice(1)}OverviewStats`;
        if (typeof (engine as any)[overviewMethod] === "function") {
          return await (engine as any)[overviewMethod](fastify.db, id);
        }
      }

      reply
        .status(404)
        .send({ error: `Analytics subcategory ${subCategory} not found for ${type}` });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });
}
