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
            let venue: any = null;
            let venueId = id;

            // Check by ID first
            const docSnap = await fastify.db.collection('venues').doc(id).get();
            if (docSnap.exists) {
                venue = { id: docSnap.id, ...docSnap.data() };
            } else {
                // Check by slug
                const slugSnap = await fastify.db.collection('venues')
                    .where('slug', '==', id)
                    .limit(1)
                    .get();
                
                if (!slugSnap.empty) {
                    const d = slugSnap.docs[0];
                    venue = { id: d.id, ...d.data() };
                    venueId = d.id;
                }
            }

            if (!venue) {
                return reply.status(404).send({ error: "Venue not found" });
            }

            const now = new Date().toISOString();
            const [highlightsSnap, gallerySnap, menuSnap, facilitiesSnap, eventsSnap] = await Promise.all([
                fastify.db.collection("venue_highlights")
                    .where("venueId", "==", venueId)
                    .where("isActive", "==", true)
                    .orderBy("order", "asc")
                    .get().catch(() => ({ docs: [] as any[] })),
                fastify.db.collection("venue_gallery")
                    .where("venueId", "==", venueId)
                    .orderBy("order", "asc")
                    .limit(9)
                    .get().catch(() => ({ docs: [] as any[] })),
                fastify.db.collection("venue_menu")
                    .where("venueId", "==", venueId)
                    .orderBy("order", "asc")
                    .get().catch(() => ({ docs: [] as any[] })),
                fastify.db.collection("venue_facilities")
                    .where("venueId", "==", venueId)
                    .where("isEnabled", "==", true)
                    .orderBy("order", "asc")
                    .get().catch(() => ({ docs: [] as any[] })),
                fastify.db.collection("events")
                    .where("venueId", "==", venueId)
                    .where("startDate", ">=", now)
                    .orderBy("startDate", "asc")
                    .limit(10)
                    .get().catch(() => ({ docs: [] as any[] })),
            ]);

            return {
                venue,
                highlights: highlightsSnap.docs.map((item: any) => ({ id: item.id, ...item.data() })),
                gallery: gallerySnap.docs.map((item: any) => ({ id: item.id, ...item.data() })),
                menu: menuSnap.docs.map((item: any) => ({ id: item.id, ...item.data() })),
                facilities: facilitiesSnap.docs.map((item: any) => ({ id: item.id, ...item.data() })),
                upcomingEvents: eventsSnap.docs.map((item: any) => ({ id: item.id, ...item.data() }))
            };
        } catch (error: any) {
            fastify.log.error(`Error in GET /venues/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
