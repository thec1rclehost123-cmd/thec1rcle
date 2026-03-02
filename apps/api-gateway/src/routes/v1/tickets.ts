import { FastifyInstance } from 'fastify';
import { signTicketId, generateSecureToken, validateBundle, validateTransfer } from '@c1rcle/core/ticket-engine';
import { z } from 'zod';

const TransferBody = z.object({
    ticketId: z.string(),
    recipientEmail: z.string().email().optional()
}).strict();

const ClaimBody = z.object({
    transferToken: z.string()
}).strict();

const TransferQuery = z.object({
    code: z.string()
}).strict();

export default async function ticketRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/v1/tickets/transfer
     * Initiate a ticket transfer
     */
    fastify.post('/transfer', {
        preHandler: [fastify.validate({ body: TransferBody })]
    }, async (request: any, reply) => {
        const { ticketId, recipientEmail } = request.body;
        const senderId = request.user?.uid;

        if (!senderId) return reply.status(401).send({ error: "Unauthorized" });
        if (!ticketId) return reply.status(400).send({ error: "ticketId is required" });

        // Implementation logic for initiation (simplified for now as we're migrating logic)
        // In a real scenario, this would check ownership from Firestore
        const token = generateSecureToken(20);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const transfer = {
            ticketId,
            senderId,
            recipientEmail: recipientEmail?.toLowerCase() || null,
            status: 'pending',
            token,
            createdAt: new Date().toISOString(),
            expiresAt
        };

        await fastify.db.collection('transfers').add(transfer);

        // Notify sender their transfer is ready/pending
        fastify.broadcast({
            type: 'TICKET_TRANSFER_INITIATED',
            payload: { ticketId, status: 'pending' }
        }, `user:${senderId}`);

        return { success: true, transfer };
    });

    /**
     * POST /api/v1/tickets/claim
     * Accept a ticket transfer
     */
    fastify.post('/claim', {
        preHandler: [fastify.validate({ body: ClaimBody })]
    }, async (request: any, reply) => {
        const { transferToken } = request.body;
        const recipientId = request.user?.uid;

        if (!recipientId) return reply.status(401).send({ error: "Unauthorized" });
        if (!transferToken) return reply.status(400).send({ error: "transferToken is required" });

        const transferSnapshot = await fastify.db.collection('transfers')
            .where("token", "==", transferToken)
            .where("status", "==", "pending")
            .limit(1)
            .get();

        if (transferSnapshot.empty) {
            return reply.status(404).send({ error: "Transfer not found or already claimed" });
        }

        const transferDoc = transferSnapshot.docs[0];
        const transferData = transferDoc.data();

        const validation = validateTransfer(transferData, recipientId);
        if (!validation.valid) {
            return reply.status(400).send({ error: validation.reason });
        }

        // Atomic Handoff Logic
        await fastify.db.runTransaction(async (transaction) => {
            // Update transfer record
            transaction.update(transferDoc.ref, {
                status: 'accepted',
                recipientId,
                acceptedAt: new Date().toISOString()
            });

            // Note: In real implementation, we would also update ticket_assignments 
            // or create a new assignment for the recipient.
        });

        // Notify both parties of the atomic handoff success
        fastify.broadcast({
            type: 'TICKET_CLAIMED',
            payload: { ticketId: transferData.ticketId, status: 'accepted' }
        }, `user:${transferData.senderId}`);

        fastify.broadcast({
            type: 'TICKET_RECEIVED',
            payload: { ticketId: transferData.ticketId, status: 'accepted' }
        }, `user:${recipientId}`);

        return { success: true, message: "Ticket claimed successfully" };
    });

    /**
     * GET /api/v1/tickets/my-tickets
     */
    fastify.get('/my-tickets', async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        // 1. Direct tickets from orders
        const ordersSnapshot = await fastify.db.collection('orders')
            .where("userId", "==", userId)
            .where("status", "==", "confirmed")
            .get();

        // 2. Claimed assignments
        const assignmentsSnapshot = await fastify.db.collection('ticket_assignments')
            .where("redeemerId", "==", userId)
            .where("status", "==", "active")
            .get();

        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const assignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { orders, assignments };
    });

    /**
     * GET /api/v1/transfer?code=[token]
     * Fetch transfer details + event preview for the acceptance page
     */
    fastify.get('/transfer', {
        preHandler: [fastify.validate({ querystring: TransferQuery })]
    }, async (request: any, reply) => {
        const { code } = request.query as any;
        if (!code) return reply.status(400).send({ error: 'Transfer code is required' });

        const snapshot = await fastify.db.collection('transfers')
            .where('token', '==', code)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return reply.status(404).send({ error: 'Transfer not found or expired' });
        }

        const transfer = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;

        // Enrich with event metadata
        let event: any = null;
        if (transfer.eventId) {
            const eventDoc = await fastify.db.collection('events').doc(transfer.eventId).get();
            if (eventDoc.exists) {
                const ed = eventDoc.data() as any;
                event = {
                    title: ed.title,
                    date: ed.startDate || ed.date,
                    venue: ed.venue || ed.location,
                    posterUrl: ed.image || ed.posterUrl
                };
            }
        }

        return { success: true, transfer: { ...transfer, event } };
    });
}

