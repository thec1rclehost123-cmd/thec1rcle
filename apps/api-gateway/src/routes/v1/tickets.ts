import { FastifyInstance } from 'fastify';
import { signTicketId, generateSecureToken, validateBundle, validateTransfer } from '@c1rcle/core/ticket-engine';
import { z } from 'zod';

const TransferBody = z.object({
    ticketId: z.string(),
    recipientEmail: z.string().email().optional()
}).strict();

const AcceptTransferBody = z.object({
    transferCode: z.string()
}).strict();

const CancelTransferQuery = z.object({
    transferId: z.string()
}).strict();

const ClaimBody = z.object({
    transferToken: z.string()
}).strict();

const TransferQuery = z.object({
    code: z.string()
}).strict();

const ShareBundleBody = z.object({
    orderId: z.string(),
    eventId: z.string(),
    quantity: z.number().int().positive(),
    tierId: z.string().optional(),
    expiresAt: z.string().optional(),
});

const ShareBundleQuery = z.object({
    orderId: z.string()
}).strict();

const ShareBundleDeleteBody = z.object({
    bundleId: z.string(),
    slotIndex: z.number().int().optional(),
});

const ClaimPreviewQuery = z.object({
    token: z.string()
}).strict();

const ClaimShareBody = z.object({
    token: z.string()
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
     * PATCH /api/v1/tickets/transfer
     * Accept a pending formal ticket transfer
     */
    fastify.patch('/transfer', {
        preHandler: [fastify.validate({ body: AcceptTransferBody })]
    }, async (request: any, reply) => {
        const { transferCode } = request.body;
        const recipientId = request.user?.uid;
        if (!recipientId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const snapshot = await fastify.db.collection('transfers')
                .where('token', '==', transferCode)
                .where('status', '==', 'pending')
                .limit(1)
                .get();

            if (snapshot.empty) return reply.status(404).send({ error: 'Transfer not found or already claimed' });

            const transferDoc = snapshot.docs[0];
            const transfer = transferDoc.data() as any;

            if (new Date(transfer.expiresAt) < new Date()) {
                return reply.status(400).send({ error: 'Transfer has expired' });
            }
            if (transfer.senderId === recipientId) {
                return reply.status(400).send({ error: 'Cannot accept your own transfer' });
            }

            const now = new Date().toISOString();
            await fastify.db.runTransaction(async (tx) => {
                tx.update(transferDoc.ref, { status: 'accepted', recipientId, acceptedAt: now });
                // Create ticket assignment for the recipient
                const assignRef = fastify.db.collection('ticket_assignments').doc();
                tx.set(assignRef, {
                    ticketId: transfer.ticketId,
                    redeemerId: recipientId,
                    originalOwnerId: transfer.senderId,
                    eventId: transfer.eventId || null,
                    source: 'transfer',
                    status: 'active',
                    createdAt: now,
                });
            });

            fastify.broadcast({ type: 'TICKET_TRANSFER_ACCEPTED', payload: { ticketId: transfer.ticketId } }, `user:${transfer.senderId}`);
            fastify.broadcast({ type: 'TICKET_RECEIVED', payload: { ticketId: transfer.ticketId } }, `user:${recipientId}`);

            return { success: true, message: 'Transfer accepted. Ticket is now yours.' };
        } catch (error: any) {
            fastify.log.error(`PATCH /tickets/transfer failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * DELETE /api/v1/tickets/transfer
     * Cancel a pending transfer (sender only)
     */
    fastify.delete('/transfer', {
        preHandler: [fastify.validate({ querystring: CancelTransferQuery })]
    }, async (request: any, reply) => {
        const { transferId } = request.query as any;
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const transferDoc = await fastify.db.collection('transfers').doc(transferId).get();
            if (!transferDoc.exists) return reply.status(404).send({ error: 'Transfer not found' });

            const transfer = transferDoc.data() as any;
            if (transfer.senderId !== userId) return reply.status(403).send({ error: 'You can only cancel your own transfers' });
            if (transfer.status !== 'pending') return reply.status(409).send({ error: `Transfer is already ${transfer.status}` });

            await transferDoc.ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
            return { success: true, message: 'Transfer cancelled.' };
        } catch (error: any) {
            fastify.log.error(`DELETE /tickets/transfer failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/v1/tickets/transfer/pending
     * List all pending outbound transfers for the current user
     */
    fastify.get('/transfer/pending', async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const snapshot = await fastify.db.collection('transfers')
                .where('senderId', '==', userId)
                .where('status', '==', 'pending')
                .get();

            const transfers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            return { success: true, transfers };
        } catch (error: any) {
            fastify.log.error(`GET /tickets/transfer/pending failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * POST /api/v1/tickets/share
     * Create a share bundle (link-based ticket sharing)
     */
    fastify.post('/share', {
        preHandler: [fastify.validate({ body: ShareBundleBody })]
    }, async (request: any, reply) => {
        const { orderId, eventId, quantity, tierId = null, expiresAt: customExpiresAt } = request.body;
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            // Verify order ownership
            const orderDoc = await fastify.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) return reply.status(404).send({ error: 'Order not found' });
            const order = orderDoc.data() as any;
            if (order.userId !== userId) return reply.status(403).send({ error: 'Unauthorized' });

            const token = generateSecureToken(32);
            const expiresAt = customExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const now = new Date().toISOString();

            const slots = Array.from({ length: quantity }, () => ({ status: 'unclaimed', claimedBy: null, claimedAt: null }));

            const bundleRef = fastify.db.collection('ticket_shares').doc();
            await bundleRef.set({
                orderId,
                ownerId: userId,
                eventId,
                tierId,
                quantity,
                slots,
                token,
                status: 'active',
                expiresAt,
                createdAt: now,
            });

            return {
                success: true,
                bundle: { id: bundleRef.id, token, expiresAt, quantity, slots },
            };
        } catch (error: any) {
            fastify.log.error(`POST /tickets/share failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/v1/tickets/share?orderId=...
     * List share bundles + assignments for an order
     */
    fastify.get('/share', {
        preHandler: [fastify.validate({ querystring: ShareBundleQuery })]
    }, async (request: any, reply) => {
        const { orderId } = request.query as any;
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const [bundlesSnap, assignmentsSnap] = await Promise.all([
                fastify.db.collection('ticket_shares').where('orderId', '==', orderId).where('ownerId', '==', userId).get(),
                fastify.db.collection('ticket_assignments').where('orderId', '==', orderId).get(),
            ]);

            const bundles = bundlesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            const assignments = assignmentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

            return { success: true, bundles, assignments };
        } catch (error: any) {
            fastify.log.error(`GET /tickets/share failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * DELETE /api/v1/tickets/share
     * Reclaim a slot or cancel entire share bundle
     */
    fastify.delete('/share', {
        preHandler: [fastify.validate({ body: ShareBundleDeleteBody })]
    }, async (request: any, reply) => {
        const { bundleId, slotIndex } = request.body;
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const bundleRef = fastify.db.collection('ticket_shares').doc(bundleId);
            const bundleDoc = await bundleRef.get();
            if (!bundleDoc.exists) return reply.status(404).send({ error: 'Share bundle not found' });

            const bundle = bundleDoc.data() as any;
            if (bundle.ownerId !== userId) return reply.status(403).send({ error: 'Unauthorized' });

            if (slotIndex !== undefined) {
                // Reclaim a specific unclaimed slot
                const slots = [...(bundle.slots || [])];
                if (!slots[slotIndex] || slots[slotIndex].status !== 'unclaimed') {
                    return reply.status(400).send({ error: 'Slot is not reclaimable' });
                }
                slots[slotIndex] = { status: 'reclaimed', claimedBy: null, claimedAt: null };
                await bundleRef.update({ slots });
            } else {
                // Cancel entire bundle
                await bundleRef.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
            }

            return { success: true };
        } catch (error: any) {
            fastify.log.error(`DELETE /tickets/share failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/v1/tickets/claim?token=...
     * Preview a share bundle by token (public — no auth required)
     */
    fastify.get('/claim', {
        config: { skipAuth: true },
        preHandler: [fastify.validate({ querystring: ClaimPreviewQuery })]
    }, async (request: any, reply) => {
        const { token } = request.query as any;

        try {
            const snapshot = await fastify.db.collection('ticket_shares')
                .where('token', '==', token)
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (snapshot.empty) return reply.status(404).send({ error: 'Invalid or expired share link' });

            const bundle = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
            if (new Date(bundle.expiresAt) < new Date()) {
                return reply.status(400).send({ error: 'Share link has expired' });
            }

            // Enrich with event metadata
            let event: any = null;
            if (bundle.eventId) {
                const eventDoc = await fastify.db.collection('events').doc(bundle.eventId).get();
                if (eventDoc.exists) {
                    const ed = eventDoc.data() as any;
                    event = { title: ed.title, image: ed.image, startDate: ed.startDate, venue: ed.venue };
                }
            }

            const availableSlots = (bundle.slots || []).filter((s: any) => s.status === 'unclaimed').length;

            return {
                success: true,
                bundle: {
                    id: bundle.id,
                    eventId: bundle.eventId,
                    quantity: bundle.quantity,
                    availableSlots,
                    expiresAt: bundle.expiresAt,
                    eventTitle: event?.title,
                    eventImage: event?.image,
                    eventDate: event?.startDate,
                    eventLocation: event?.venue,
                },
            };
        } catch (error: any) {
            fastify.log.error(`GET /tickets/claim failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * POST /api/v1/tickets/claim (share bundle claim)
     * Claim a slot from a share bundle token
     */
    fastify.post('/claim/share', {
        preHandler: [fastify.validate({ body: ClaimShareBody })]
    }, async (request: any, reply) => {
        const { token } = request.body;
        const redeemerId = request.user?.uid;
        if (!redeemerId) return reply.status(401).send({ error: 'Authentication required to claim ticket' });

        try {
            const snapshot = await fastify.db.collection('ticket_shares')
                .where('token', '==', token)
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (snapshot.empty) return reply.status(404).send({ error: 'Invalid or expired share link' });

            const bundleDoc = snapshot.docs[0];
            const bundle = bundleDoc.data() as any;

            if (new Date(bundle.expiresAt) < new Date()) return reply.status(400).send({ error: 'Share link has expired' });
            if (bundle.ownerId === redeemerId) return reply.status(400).send({ error: 'Cannot claim your own share link' });

            const slots = [...(bundle.slots || [])];
            const availableIdx = slots.findIndex((s: any) => s.status === 'unclaimed');
            if (availableIdx === -1) return reply.status(409).send({ error: 'No tickets left in this share bundle' });

            const now = new Date().toISOString();
            slots[availableIdx] = { status: 'claimed', claimedBy: redeemerId, claimedAt: now };

            const assignRef = fastify.db.collection('ticket_assignments').doc();

            await fastify.db.runTransaction(async (tx) => {
                tx.update(bundleDoc.ref, { slots });
                tx.set(assignRef, {
                    bundleId: bundleDoc.id,
                    orderId: bundle.orderId,
                    eventId: bundle.eventId,
                    tierId: bundle.tierId,
                    redeemerId,
                    originalOwnerId: bundle.ownerId,
                    source: 'share_bundle',
                    status: 'active',
                    createdAt: now,
                });
            });

            return { success: true, assignmentId: assignRef.id, message: 'Ticket claimed successfully.' };
        } catch (error: any) {
            fastify.log.error(`POST /tickets/claim/share failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
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

