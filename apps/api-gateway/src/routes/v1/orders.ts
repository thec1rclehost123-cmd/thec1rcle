import { FastifyInstance } from "fastify";
import { hasStaffPermission } from "@c1rcle/core/staff-engine";

export default async function orderRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/orders/event/:eventId
   */
  fastify.get("/event/:eventId", async (request: any, reply) => {
    const { eventId } = request.params;
    const { limit = 100 } = request.query as any;
    const actorId = request.user?.uid;

    // 1. Fetch Event to get venueId
    const eventDoc = await fastify.db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return reply.status(404).send({ error: "Event not found" });
    const eventData = eventDoc.data();
    if (!eventData) return reply.status(404).send({ error: "Event data missing" });

    // 2. RBAC Check
    const hasAccess = await hasStaffPermission(
      fastify.db,
      eventData.venueId,
      actorId,
      "viewEvents",
    );
    if (!hasAccess) return reply.status(403).send({ error: "Unauthorized" });

    // 3. Fetch Orders and RSVPs
    const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
      fastify.db.collection("orders").where("eventId", "==", eventId).limit(Number(limit)).get(),
      fastify.db
        .collection("rsvp_orders")
        .where("eventId", "==", eventId)
        .limit(Number(limit))
        .get(),
    ]);

    const orders = ordersSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const rsvps = rsvpsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      isRSVP: true,
    }));

    const allOrders = [...orders, ...rsvps].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { success: true, orders: allOrders.slice(0, Number(limit)) };
  });

  /**
   * GET /api/v1/orders/stats/:eventId
   */
  fastify.get("/stats/:eventId", async (request: any, reply) => {
    const { eventId } = request.params;
    const actorId = request.user?.uid;

    const eventDoc = await fastify.db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return reply.status(404).send({ error: "Event not found" });
    const eventData = eventDoc.data();
    if (!eventData) return reply.status(404).send({ error: "Event data missing" });

    const hasAccess = await hasStaffPermission(
      fastify.db,
      eventData.venueId,
      actorId,
      "viewFinance",
    );
    if (!hasAccess) return reply.status(403).send({ error: "Unauthorized" });

    const ordersSnapshot = await fastify.db
      .collection("orders")
      .where("eventId", "==", eventId)
      .where("status", "==", "confirmed")
      .get();

    const stats = {
      totalOrders: ordersSnapshot.size,
      totalRevenue: 0,
      ticketsSold: 0,
    };

    ordersSnapshot.docs.forEach((doc: any) => {
      const order = doc.data();
      stats.totalRevenue += order.totalAmount || 0;
      (order.tickets || []).forEach((t: any) => {
        stats.ticketsSold += t.quantity || 0;
      });
    });

    return { success: true, stats };
  });
}
