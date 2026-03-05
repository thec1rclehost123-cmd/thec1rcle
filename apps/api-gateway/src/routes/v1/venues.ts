import { FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * Venue Discovery Routes
 */
export default async function venueRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/venues
     * List venues with optional sorting and limit
     */
    fastify.get('/venues', async (request: any, reply) => {
        try {
            const { sort = 'Popular', limit = 12 } = request.query as any;
            let q: any = fastify.db.collection('venues');
            
            // Apply sorting logic
            if (sort === 'Popular') {
                q = q.orderBy('heatScore', 'desc');
            } else if (sort === 'new') {
                q = q.orderBy('createdAt', 'desc');
            }
            
            q = q.limit(Number(limit));
            
            const snapshot = await q.get();
            const venues = snapshot.docs.map((d: any) => ({ 
                id: d.id, 
                ...d.data() 
            }));

            return { venues };
        } catch (error: any) {
            fastify.log.error(`Error in GET /venues: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * GET /api/v1/venues/:id
     * Fetch a specific venue by ID or slug
     */
    fastify.get('/venues/:id', async (request: any, reply) => {
        const { id } = request.params as any;
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
        } catch (error: any) {
            fastify.log.error(`Error in GET /venues/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
