import { z } from 'zod';
const RequestBody = z.object({
    hostId: z.string(),
    venueId: z.string(),
    hostName: z.string().optional(),
    venueName: z.string().optional()
}).strict();
const PartnershipsQuery = z.object({
    hostId: z.string().optional(),
    venueId: z.string().optional(),
    status: z.string().optional()
}).strict();
const PartnershipIdParam = z.object({
    id: z.string()
}).strict();
const UpdateActionBody = z.object({
    action: z.enum(['approve', 'reject', 'block']),
    reason: z.string().optional()
}).strict();
const CheckQuery = z.object({
    hostId: z.string(),
    venueId: z.string()
}).strict();
export default async function partnershipRoutes(fastify) {
    /**
     * POST /api/v1/partnerships/request
     */
    fastify.post('/request', {
        preHandler: [fastify.validate({ body: RequestBody })]
    }, async (request, reply) => {
        const { hostId, venueId, hostName, venueName } = request.body;
        const db = fastify.db;
        const existing = await db.collection('partnerships')
            .where('hostId', '==', hostId)
            .where('venueId', '==', venueId)
            .limit(1).get();
        if (!existing.empty) {
            return reply.status(409).send({ error: 'Partnership already requested or active' });
        }
        const ref = await db.collection('partnerships').add({
            hostId, venueId, hostName, venueName,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return { success: true, id: ref.id };
    });
    /**
     * GET /api/v1/partnerships
     */
    fastify.get('/', {
        preHandler: [fastify.validate({ querystring: PartnershipsQuery })]
    }, async (request, reply) => {
        const { hostId, venueId, status } = request.query;
        let query = fastify.db.collection('partnerships');
        if (hostId)
            query = query.where('hostId', '==', hostId);
        if (venueId)
            query = query.where('venueId', '==', venueId);
        if (status)
            query = query.where('status', '==', status);
        const snap = await query.get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
    /**
     * PATCH /api/v1/partnerships/:id
     */
    fastify.patch('/:id', {
        preHandler: [fastify.validate({ params: PartnershipIdParam, body: UpdateActionBody })]
    }, async (request, reply) => {
        const { id } = request.params;
        const { action, reason } = request.body;
        const statusMap = {
            approve: 'active',
            reject: 'rejected',
            block: 'blocked'
        };
        const newStatus = statusMap[action];
        if (!newStatus)
            return reply.status(400).send({ error: 'Invalid action' });
        await fastify.db.collection('partnerships').doc(id).update({
            status: newStatus,
            ...(reason ? { rejectReason: reason } : {}),
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    });
    /**
     * GET /api/v1/partnerships/check
     */
    fastify.get('/check', {
        preHandler: [fastify.validate({ querystring: CheckQuery })]
    }, async (request, reply) => {
        const { hostId, venueId } = request.query;
        const snap = await fastify.db.collection('partnerships')
            .where('hostId', '==', hostId)
            .where('venueId', '==', venueId)
            .where('status', '==', 'active')
            .limit(1).get();
        return { isPartner: !snap.empty };
    });
}
//# sourceMappingURL=partnerships.js.map