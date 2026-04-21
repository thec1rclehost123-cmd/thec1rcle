import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
    acceptGuestTransfer,
    assignGuestPartner,
    cancelGuestPartnerSlot,
    cancelGuestShareBundle,
    cancelGuestTransfer,
    claimGuestPartnerSlot,
    claimGuestShareBundle,
    createGuestPartnerClaimLink,
    createGuestShareBundle,
    generateGuestTicketDownload,
    getGuestCoverWallet,
    getGuestCoupleStatus,
    getGuestPendingTransfers,
    getGuestShareState,
    getGuestWallet,
    getGuestWalletTicket,
    initiateGuestTransfer,
    previewGuestPairClaim,
    previewGuestShareBundle,
    reclaimGuestShareSlot,
    transferGuestCoupleTicket,
} from '../../services/guest-gp5';

const TicketIdParam = z.object({
    ticketId: z.string(),
}).strict();

const TransferBody = z.object({
    ticketId: z.string(),
    recipientEmail: z.string().email().optional().nullable(),
}).strict();

const AcceptTransferBody = z.object({
    transferCode: z.string(),
}).strict();

const ShareBundleBody = z.object({
    orderId: z.string(),
    eventId: z.string(),
    quantity: z.number().int().positive(),
    tierId: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
}).strict();

const ShareBundleQuery = z.object({
    orderId: z.string(),
}).strict();

const ShareBundleDeleteBody = z.object({
    bundleId: z.string(),
    slotIndex: z.number().int().optional(),
}).strict();

const ClaimPreviewQuery = z.object({
    token: z.string(),
}).strict();

const ClaimShareBody = z.object({
    token: z.string(),
}).strict();

const TransferQuery = z.object({
    code: z.string(),
}).strict();

const PairPreviewQuery = z.object({
    token: z.string().optional(),
    bundleId: z.string().optional(),
}).strict();

const PairClaimBody = z.object({
    token: z.string(),
}).strict();

const PairCancelBody = z.object({
    bundleId: z.string(),
}).strict();

const PairLinkBody = z.object({
    ticketId: z.string(),
    eventId: z.string(),
}).strict();

const PairAssignBody = z.object({
    ticketId: z.string(),
    partnerUserId: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
}).strict();

const PairTransferBody = z.object({
    ticketId: z.string(),
    newOwnerId: z.string(),
}).strict();

const CoverWalletQuery = z.object({
    orderId: z.string(),
}).strict();

const DownloadQuery = z.object({
    orderId: z.string(),
}).strict();

function requireUser(reply: any, request: any) {
    const userId = request.user?.uid;
    if (!userId) {
        reply.status(401).send({ error: 'Unauthorized' });
        return null;
    }
    return userId;
}

function buildSharePreview(bundle: any) {
    const event = bundle?.event || null;
    return {
        ...bundle,
        eventTitle: event?.title || null,
        eventImage: event?.image || null,
        eventDate: event?.date || event?.startDate || null,
        eventLocation: event?.location || event?.venue || null,
        availableSlots: Array.isArray(bundle?.slots)
            ? bundle.slots.filter((slot: any) => slot.claimStatus === 'unclaimed').length
            : bundle?.remainingSlots ?? 0,
    };
}

export default async function ticketRoutes(fastify: FastifyInstance) {
    fastify.get('/tickets', async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            return await getGuestWallet(userId);
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /tickets failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.post('/tickets/transfer', {
        preHandler: [fastify.validate({ body: TransferBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const transfer = await initiateGuestTransfer(userId, request.body.ticketId, request.body.recipientEmail ?? null);
            fastify.log.info({ requestId: request.id, userId, ticketId: request.body.ticketId, transferId: transfer.id }, 'Guest transfer initiated');
            return { success: true, transfer };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            fastify.log.warn({ requestId: request.id, userId, error: error.message }, 'POST /tickets/transfer rejected');
            return reply.status(status).send({ error: error.message || 'Transfer failed' });
        }
    });

    fastify.patch('/tickets/transfer', {
        preHandler: [fastify.validate({ body: AcceptTransferBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const result = await acceptGuestTransfer(userId, request.body.transferCode);
            fastify.log.info({ requestId: request.id, userId, transferCode: request.body.transferCode }, 'Guest transfer accepted');
            return { success: true, ...result };
        } catch (error: any) {
            const status = error.message?.includes('already') ? 409 : 400;
            fastify.log.warn({ requestId: request.id, userId, error: error.message }, 'PATCH /tickets/transfer rejected');
            return reply.status(status).send({ error: error.message || 'Transfer failed' });
        }
    });

    fastify.delete('/tickets/transfer', async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        const transferId = request.body?.transferId || request.query?.transferId;
        if (!transferId) return reply.status(400).send({ error: 'transferId is required' });

        try {
            const result = await cancelGuestTransfer(userId, transferId);
            fastify.log.info({ requestId: request.id, userId, transferId }, 'Guest transfer cancelled');
            return { success: true, ...result };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            return reply.status(status).send({ error: error.message || 'Transfer failed' });
        }
    });

    fastify.get('/tickets/transfer/pending', async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const transfers = await getGuestPendingTransfers(userId, request.user?.email || null);
            return { success: true, transfers };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /tickets/transfer/pending failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.post('/tickets/share', {
        preHandler: [fastify.validate({ body: ShareBundleBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const bundle = await createGuestShareBundle(userId, request.body);
            fastify.log.info({ requestId: request.id, userId, bundleId: bundle.id, orderId: bundle.orderId }, 'Guest share bundle created');
            return { success: true, bundle };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to create share bundle' });
        }
    });

    fastify.get('/tickets/share', {
        preHandler: [fastify.validate({ querystring: ShareBundleQuery })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const state = await getGuestShareState(request.query.orderId);
            if (!state) return reply.status(404).send({ error: 'Order not found' });
            if (state.order.userId !== userId) return reply.status(403).send({ error: 'Unauthorized' });
            return { success: true, bundles: state.bundles, assignments: state.assignments };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /tickets/share failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.delete('/tickets/share', {
        preHandler: [fastify.validate({ body: ShareBundleDeleteBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            if (request.body.slotIndex !== undefined) {
                await reclaimGuestShareSlot(userId, request.body.bundleId, request.body.slotIndex);
            } else {
                await cancelGuestShareBundle(userId, request.body.bundleId);
            }
            fastify.log.info({ requestId: request.id, userId, bundleId: request.body.bundleId }, 'Guest share bundle updated');
            return { success: true };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to update share bundle' });
        }
    });

    fastify.get('/tickets/claim', {
        preHandler: [fastify.validate({ querystring: ClaimPreviewQuery })],
    }, async (request: any, reply) => {
        try {
            const preview = await previewGuestShareBundle(request.query.token, request.user?.uid || null);
            if (!preview) return reply.status(404).send({ error: 'Invalid or expired share link' });
            return { success: true, bundle: buildSharePreview(preview) };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, error: error.message }, 'GET /tickets/claim failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.post('/tickets/claim/share', {
        preHandler: [fastify.validate({ body: ClaimShareBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const result = await claimGuestShareBundle(userId, request.body.token);
            fastify.log.info({ requestId: request.id, userId, token: request.body.token }, 'Guest share bundle claimed');
            return { success: true, ...result };
        } catch (error: any) {
            const status = error.message?.includes('already') ? 409 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to claim ticket' });
        }
    });

    fastify.get('/tickets/pair', {
        preHandler: [fastify.validate({ querystring: PairPreviewQuery })],
    }, async (request: any, reply) => {
        const { token, bundleId } = request.query as any;

        try {
            if (token) {
                const preview = await previewGuestPairClaim(fastify.db, token);
                if (!preview) return reply.status(404).send({ error: 'Invalid or expired claim link' });
                return { success: true, claim: preview };
            }

            const userId = requireUser(reply, request);
            if (!userId) return;
            if (!bundleId) return reply.status(400).send({ error: 'token or bundleId is required' });

            const status = await getGuestCoupleStatus(fastify.db, userId, bundleId);
            if (!status) return reply.status(404).send({ error: 'Couple ticket not found' });
            return { success: true, ...status };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to load pair state' });
        }
    });

    fastify.post('/tickets/pair', {
        preHandler: [fastify.validate({ body: PairClaimBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const result = await claimGuestPartnerSlot(userId, request.body.token);
            fastify.log.info({ requestId: request.id, userId, token: request.body.token }, 'Guest pair slot claimed');
            return { success: true, ...result };
        } catch (error: any) {
            const status = error.message?.includes('already') ? 409 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to claim pair slot' });
        }
    });

    fastify.delete('/tickets/pair', {
        preHandler: [fastify.validate({ body: PairCancelBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const result = await cancelGuestPartnerSlot(userId, request.body.bundleId);
            fastify.log.info({ requestId: request.id, userId, bundleId: request.body.bundleId }, 'Guest pair slot cancelled');
            return { success: true, ...result };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to cancel pair slot' });
        }
    });

    fastify.post('/tickets/pair/link', {
        preHandler: [fastify.validate({ body: PairLinkBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            return await createGuestPartnerClaimLink(userId, request.body.ticketId, request.body.eventId);
        } catch (error: any) {
            return reply.status(400).send({ error: error.message || 'Failed to create pair link' });
        }
    });

    fastify.post('/tickets/pair/assign', {
        preHandler: [fastify.validate({ body: PairAssignBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const result = await assignGuestPartner(userId, request.body.ticketId, request.body.partnerUserId, request.body.metadata || {});
            return { success: true, assignment: result };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to assign partner' });
        }
    });

    fastify.post('/tickets/pair/transfer', {
        preHandler: [fastify.validate({ body: PairTransferBody })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const result = await transferGuestCoupleTicket(userId, request.body.ticketId, request.body.newOwnerId);
            return { success: true, ...result };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 400;
            return reply.status(status).send({ error: error.message || 'Failed to transfer couple ticket' });
        }
    });

    fastify.get('/tickets/cover-wallet', {
        preHandler: [fastify.validate({ querystring: CoverWalletQuery })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const wallets = await getGuestCoverWallet(fastify.db, userId, request.query.orderId);
            if (wallets === null) return reply.status(404).send({ error: 'Order not found' });
            return { wallets };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /tickets/cover-wallet failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/tickets/download', {
        preHandler: [fastify.validate({ querystring: DownloadQuery })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const result = await generateGuestTicketDownload(userId, request.query.orderId);
            if (!result) return reply.status(404).send({ error: 'Order not found' });

            reply
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', `attachment; filename="${result.filename}"`)
                .header('Cache-Control', 'private, max-age=3600');

            return reply.send(result.buffer);
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /tickets/download failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/transfer', {
        preHandler: [fastify.validate({ querystring: TransferQuery })],
    }, async (request: any, reply) => {
        try {
            const snapshot = await fastify.db.collection('transfers')
                .where('token', '==', request.query.code)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return reply.status(404).send({ error: 'Transfer not found or expired' });
            }

            const transfer = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;

            let event: any = null;
            if (transfer.eventId) {
                const eventDoc = await fastify.db.collection('events').doc(transfer.eventId).get();
                if (eventDoc.exists) {
                    const eventData = eventDoc.data() as any;
                    event = {
                        title: eventData.title,
                        date: eventData.startDate || eventData.date,
                        venue: eventData.venue || eventData.location,
                        posterUrl: eventData.image || eventData.posterUrl,
                    };
                }
            }

            return { success: true, transfer: { ...transfer, event } };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, error: error.message }, 'GET /transfer failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/tickets/:ticketId', {
        preHandler: [fastify.validate({ params: TicketIdParam })],
    }, async (request: any, reply) => {
        const userId = requireUser(reply, request);
        if (!userId) return;

        try {
            const ticket = await getGuestWalletTicket(userId, request.params.ticketId);
            if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });
            return { success: true, ticket };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /tickets/:ticketId failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
