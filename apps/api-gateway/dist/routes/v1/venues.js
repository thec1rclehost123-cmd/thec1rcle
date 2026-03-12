/**
 * Venue Discovery Routes
 */
export default async function venueRoutes(fastify) {
    /**
     * GET /api/v1/venues
     * List venues with optional sorting and limit
     */
    fastify.get('/venues', async (request, reply) => {
        try {
            const { sort = 'Popular', limit = 12 } = request.query;
            let q = fastify.db.collection('venues');
            // Apply sorting logic
            if (sort === 'Popular') {
                q = q.orderBy('heatScore', 'desc');
            }
            else if (sort === 'new') {
                q = q.orderBy('createdAt', 'desc');
            }
            q = q.limit(Number(limit));
            const snapshot = await q.get();
            const venues = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data()
            }));
            return { venues };
        }
        catch (error) {
            fastify.log.error(`Error in GET /venues: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * GET /api/v1/venues/:id
     * Fetch a specific venue by ID or slug
     */
    fastify.get('/venues/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            // Check by ID first
            const doc = await fastify.db.collection('venues').doc(id).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            // Check by slug
            const slugSnap = await fastify.db.collection('venues')
                .where('slug', '==', id)
                .limit(1)
                .get();
            if (!slugSnap.empty) {
                const d = slugSnap.docs[0];
                return { id: d.id, ...d.data() };
            }
            return reply.status(404).send({ error: "Venue not found" });
        }
        catch (error) {
            fastify.log.error(`Error in GET /venues/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=venues.js.map