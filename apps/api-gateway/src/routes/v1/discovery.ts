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
                // Fetch connections for this partner
                let q: any = fastify.db.collection('partnerships');
                if (role === 'venue') q = q.where('venueId', '==', partnerId);
                else if (role === 'host') q = q.where('hostId', '==', partnerId);
                else if (role === 'promoter') q = q.where('promoterId', '==', partnerId);
                
                const snap = await q.get();
                const connections = snap.docs.map((doc: any) => {
                    const data = doc.data();
                    const isVenue = role === 'venue';
                    return {
                        id: doc.id,
                        status: data.status,
                        initiatedBy: data.initiatedBy || (isVenue ? 'host' : 'venue'),
                        otherId: isVenue ? (data.hostId || data.promoterId) : data.venueId,
                        otherName: isVenue ? (data.hostName || data.promoterName) : data.venueName,
                        otherType: isVenue ? (data.hostId ? 'host' : 'promoter') : 'venue',
                        createdAt: data.createdAt,
                    };
                });

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
