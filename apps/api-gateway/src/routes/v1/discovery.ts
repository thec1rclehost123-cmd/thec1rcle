import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';

const DiscoveryQuerySchema = z.object({
    action: z.enum(['list', 'search', 'get', 'discover']),
    partnerId: z.string().optional(),
    role: z.enum(['venue', 'host', 'promoter']).optional(),
    type: z.string().optional(),
    city: z.string().optional(),
    query: z.string().optional(),
    search: z.string().optional(),
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
    const PARTNERSHIPS_COL = 'partnerships';
    const PROMOTER_CONNECTIONS_COL = 'promoter_connections';

    /**
     * GET /api/v1/discovery
     */
    fastify.get('/', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: DiscoveryQuerySchema })],
    }, async (request: any, reply) => {
        const { action, partnerId, role, type, city, query } = request.query;

        try {
            if (action === 'list' && partnerId) {
                // Verify the authenticated user actually belongs to the requested partner entity.
                try { await fastify.verifyPartnerAccess(request, partnerId); }
                catch { return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Access denied to this partner', requestId: request.id })); }

                const connections: any[] = [];

                if (role === 'host') {
                    const [partnerSnap, promoterSnap] = await Promise.all([
                        fastify.db.collection(PARTNERSHIPS_COL).where('hostId', '==', partnerId).get().catch(() => ({ docs: [] as any[] })),
                        fastify.db.collection(PROMOTER_CONNECTIONS_COL).where('hostId', '==', partnerId).get().catch(() => ({ docs: [] as any[] })),
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
                    const snap = await fastify.db.collection(PARTNERSHIPS_COL).where('venueId', '==', partnerId).get().catch(() => ({ docs: [] as any[] }));
                    for (const doc of (snap as any).docs) {
                        const data = doc.data();
                        connections.push({ id: doc.id, type: 'partnership', status: data.status, initiatedBy: data.initiatedBy || 'host', otherId: data.hostId, otherName: data.hostName || '', city: data.hostCity || data.city || '', photoURL: data.hostPhotoURL || null, createdAt: data.createdAt });
                    }
                } else if (role === 'promoter') {
                    const snap = await fastify.db.collection(PROMOTER_CONNECTIONS_COL).where('promoterId', '==', partnerId).get().catch(() => ({ docs: [] as any[] }));
                    for (const doc of (snap as any).docs) {
                        const data = doc.data();
                        connections.push({ id: doc.id, type: 'promoter_connection', status: data.status, initiatedBy: data.initiatedBy || 'host', otherId: data.hostId, otherName: data.hostName || '', city: data.city || '', photoURL: data.hostPhotoURL || null, createdAt: data.createdAt });
                    }
                }

                return { connections };
            }

            if (action === 'search' || action === 'discover') {
                let q: any = fastify.db.collection('users');
                const { search } = request.query;

                if (type === 'host') q = q.where('role', '==', 'host');
                else if (type === 'promoter') q = q.where('role', '==', 'promoter');
                else if (type === 'venue') q = q.where('role', '==', 'venue');

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

                let results = partners;
                const searchVal = query || search;
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
        const { connectionId, action, partnerId } = request.body;

        try {
            // Read the connection document first and verify the caller owns one side of it.
            const connDoc = await fastify.db.collection(PARTNERSHIPS_COL).doc(connectionId).get();
            if (!connDoc.exists) {
                return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Connection not found', requestId: request.id }));
            }
            const conn = connDoc.data() as any;
            const callerIsParty = conn.hostId === partnerId || conn.venueId === partnerId || conn.promoterId === partnerId;
            if (!callerIsParty) {
                return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Not a party to this connection', requestId: request.id }));
            }
            // Verify the authenticated user actually belongs to the partnerId they claim.
            try { await fastify.verifyPartnerAccess(request, partnerId); }
            catch { return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Access denied to this partner', requestId: request.id })); }

            const statusMap: Record<string, string> = {
                approve: 'active',
                reject: 'rejected',
                remove: 'deleted'
            };

            await fastify.db.collection(PARTNERSHIPS_COL).doc(connectionId).update({
                status: statusMap[action],
                updatedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error: any) {
            if ((error as any).statusCode) throw error;
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
            // Verify the caller actually belongs to the entity they claim to represent.
            try { await fastify.verifyPartnerAccess(request, data.requesterId); }
            catch { return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Cannot submit partnership request on behalf of another partner', requestId: request.id })); }

            const ref = await fastify.db.collection(PARTNERSHIPS_COL).add({
                ...data,
                status: 'pending',
                initiatedBy: data.requesterType,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return { success: true, id: ref.id };
        } catch (error: any) {
            if ((error as any).statusCode) throw error;
            return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to request partnership', requestId: request.id }));
        }
    });
}
