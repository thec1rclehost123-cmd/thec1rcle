import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';

const DiscoveryQuerySchema = z.object({
    action: z.enum(['list', 'search', 'get', 'discover']),
    partnerId: z.string().optional(),
    role: z.enum(['venue', 'host', 'promoter']).optional(),
    type: z.string().optional(), // For search/discover
    city: z.string().optional(),
    query: z.string().optional(),
    search: z.string().optional(), // Alias for query
});

const DiscoveryPatchSchema = z.object({
    connectionId: z.string(),
    action: z.enum(['approve', 'reject', 'remove']),
    partnerId: z.string(),
    role: z.enum(['venue', 'host', 'promoter']),
});

const DiscoveryPostSchema = z.object({
    requesterId: z.string(),
    requesterType: z.string(),
    requesterName: z.string(),
    targetId: z.string(),
    targetType: z.string(),
    targetName: z.string(),
});

export default async function discoveryRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/discovery
     */
    fastify.get('/', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: DiscoveryQuerySchema })],
    }, async (request: any, reply) => {
        const { action, partnerId, role, type, city, query } = request.query;

        try {
            if (action === 'list' && partnerId) {
                const connections: any[] = [];

                if (role === 'host') {
                    const [partnerSnap, promoterSnap] = await Promise.all([
                        fastify.db.collection('partnerships').where('hostId', '==', partnerId).get().catch(() => ({ docs: [] as any[] })),
                        fastify.db.collection('promoter_connections').where('hostId', '==', partnerId).get().catch(() => ({ docs: [] as any[] })),
                    ]);
                    for (const doc of (partnerSnap as any).docs) {
                        const data = doc.data();
                        connections.push({ id: doc.id, type: 'partnership', status: data.status, initiatedBy: data.initiatedBy || 'host', otherId: data.venueId, otherName: data.venueName || '', city: data.venueCity || data.city || '', photoURL: data.venuePhotoURL || null, createdAt: data.createdAt });
                    }
                    for (const doc of (promoterSnap as any).docs) {
                        const data = doc.data();
                        connections.push({ id: doc.id, type: 'promoter_connection', status: data.status, initiatedBy: data.initiatedBy || 'promoter', otherId: data.promoterId, otherName: data.promoterName || '', city: data.city || '', photoURL: data.promoterPhotoURL || null, createdAt: data.createdAt });
                    }
                } else if (role === 'venue') {
                    const snap = await fastify.db.collection('partnerships').where('venueId', '==', partnerId).get().catch(() => ({ docs: [] as any[] }));
                    for (const doc of (snap as any).docs) {
                        const data = doc.data();
                        connections.push({ id: doc.id, type: 'partnership', status: data.status, initiatedBy: data.initiatedBy || 'host', otherId: data.hostId, otherName: data.hostName || '', city: data.hostCity || data.city || '', photoURL: data.hostPhotoURL || null, createdAt: data.createdAt });
                    }
                } else if (role === 'promoter') {
                    const snap = await fastify.db.collection('promoter_connections').where('promoterId', '==', partnerId).get().catch(() => ({ docs: [] as any[] }));
                    for (const doc of (snap as any).docs) {
                        const data = doc.data();
                        connections.push({ id: doc.id, type: 'promoter_connection', status: data.status, initiatedBy: data.initiatedBy || 'host', otherId: data.hostId, otherName: data.hostName || '', city: data.city || '', photoURL: data.hostPhotoURL || null, createdAt: data.createdAt });
                    }
                }

                return { connections };
            }

            if (action === 'search' || action === 'discover') {
                // Search for potential partners
                let q: any = fastify.db.collection('users');
                const searchType = type || request.query.type;
                const searchVal = query || request.query.search;
                
                if (searchType === 'host') q = q.where('role', '==', 'host');
                else if (searchType === 'promoter') q = q.where('role', '==', 'promoter');
                else if (searchType === 'venue') q = q.where('role', '==', 'venue');
                
                if (city) q = q.where('city', '==', city);
                
                const snap = await q.limit(50).get();
                const partners = snap.docs.map((doc: any) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.displayName || data.name || 'Anonymous',
                        type: data.role || 'host',
                        city: data.city || 'Unknown',
                        bio: data.bio || '',
                        avatar: data.photoURL || data.avatar || null,
                        coverImage: data.coverImage || null,
                        isVerified: data.kycStatus === 'verified',
                        eventsCount: 0,
                        followersCount: 0
                    };
                });

                // Simple in-memory search if query provided
                let results = partners;
                if (searchVal) {
                    const s = searchVal.toLowerCase();
                    results = partners.filter((p: any) => 
                        p.name.toLowerCase().includes(s) || 
                        p.city.toLowerCase().includes(s)
                    );
                }

                return { partners: results };
            }

            return { connections: [], partners: [] };
        } catch (error: any) {
            fastify.log.error(`Discovery GET error: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to fetch discovery data', requestId: request.id }));
        }
    });

    /**
     * PATCH /api/v1/discovery
     */
    fastify.patch('/', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: DiscoveryPatchSchema })],
    }, async (request: any, reply) => {
        const { connectionId, action } = request.body;

        try {
            const statusMap: Record<string, string> = {
                approve: 'active',
                reject: 'rejected',
                remove: 'deleted'
            };

            await fastify.db.collection('partnerships').doc(connectionId).update({
                status: statusMap[action],
                updatedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error: any) {
            return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to update partnership', requestId: request.id }));
        }
    });

    /**
     * POST /api/v1/discovery
     */
    fastify.post('/', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: DiscoveryPostSchema })],
    }, async (request: any, reply) => {
        const data = request.body;

        try {
            const ref = await fastify.db.collection('partnerships').add({
                ...data,
                status: 'pending',
                initiatedBy: data.requesterType,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return { success: true, id: ref.id };
        } catch (error: any) {
            return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to request partnership', requestId: request.id }));
        }
    });
}
