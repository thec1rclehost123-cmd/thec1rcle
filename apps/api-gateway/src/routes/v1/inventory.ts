import { FastifyInstance } from 'fastify';
import { calculateEffectiveInventory, validatePurchase } from '@c1rcle/core/inventory-engine';
import { hasStaffPermission } from '@c1rcle/core/staff-engine';

export default async function inventoryRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/inventory/:eventId/summary
     */
    fastify.get('/:eventId/summary', async (request: any, reply) => {
        const { eventId } = request.params;
        const actorId = request.user?.uid;

        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return reply.status(404).send({ error: "Event not found" });

        const event = { id: eventDoc.id, ...eventDoc.data() } as any;

        // RBAC Check
        const hasAccess = await hasStaffPermission(fastify.db, event.venueId, actorId, 'viewEvents');
        if (!hasAccess) return reply.status(403).send({ error: "Unauthorized" });

        const tiers = event.ticketCatalog?.tiers || event.tickets || [];
        const results = [];

        for (const tier of tiers) {
            const effective = await calculateEffectiveInventory(tier, event, null, fastify.db);
            const total = tier.inventory?.totalQuantity ?? tier.quantity ?? 0;
            const sold = tier.inventory?.soldQuantity ?? tier.sold ?? 0;
            const locked = tier.lockedQuantity || 0;

            results.push({
                id: tier.id,
                name: tier.name,
                total,
                sold,
                locked,
                available: effective,
                percentSold: total > 0 ? Math.round((sold / total) * 100) : 0
            });
        }

        return {
            success: true,
            eventId,
            summary: {
                tiers: results,
                totalCapacity: results.reduce((sum, r) => sum + r.total, 0),
                totalSold: results.reduce((sum, r) => sum + r.sold, 0),
                totalAvailable: results.reduce((sum, r) => sum + r.available, 0)
            }
        };
    });
}
