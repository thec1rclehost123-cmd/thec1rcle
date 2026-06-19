import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
// @ts-ignore
import {
  getGuestWallet,
  getGuestWalletTicket,
} from '@c1rcle/core/guest-wallet-profile-notification-service';
// @ts-ignore
import { getUserTicketWallet } from '@c1rcle/core/ticket-checkout-wallet-service';
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
  getGuestCoverWalletsByOrderIds,
  getGuestCoupleStatus,
  getGuestPendingTransfers,
  getGuestShareState,
  initiateGuestTransfer,
  previewGuestPairClaim,
  previewGuestShareBundle,
  reclaimGuestShareSlot,
  transferGuestCoupleTicket,
} from '../../services/guest-gp5';

const TicketIdParam = z
  .object({
    ticketId: z.string(),
  })
  .strict();

const TransferBody = z
  .object({
    ticketId: z.string(),
    recipientEmail: z.string().email().optional().nullable(),
  })
  .strict();

const AcceptTransferBody = z
  .object({
    transferCode: z.string(),
  })
  .strict();

const ShareBundleBody = z
  .object({
    orderId: z.string(),
    eventId: z.string(),
    quantity: z.number().int().positive(),
    tierId: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
  })
  .strict();

const GroupTransferParam = z
  .object({
    id: z.string(),
  })
  .strict();

const GroupClaimBody = z
  .object({
    transferToken: z.string(),
  })
  .strict();

const ShareBundleQuery = z
  .object({
    orderId: z.string(),
  })
  .strict();

const ShareBundleDeleteBody = z
  .object({
    bundleId: z.string(),
    slotIndex: z.number().int().optional(),
  })
  .strict();

const ClaimPreviewQuery = z
  .object({
    token: z.string(),
  })
  .strict();

const ClaimShareBody = z
  .object({
    token: z.string(),
  })
  .strict();

const TransferQuery = z
  .object({
    code: z.string(),
  })
  .strict();

const PairPreviewQuery = z
  .object({
    token: z.string().optional(),
    bundleId: z.string().optional(),
  })
  .strict();

const PairClaimBody = z
  .object({
    token: z.string(),
  })
  .strict();

const PairCancelBody = z
  .object({
    bundleId: z.string(),
  })
  .strict();

const PairLinkBody = z
  .object({
    ticketId: z.string(),
    eventId: z.string(),
  })
  .strict();

const PairAssignBody = z
  .object({
    ticketId: z.string(),
    partnerUserId: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

const PairTransferBody = z
  .object({
    ticketId: z.string(),
    newOwnerId: z.string(),
  })
  .strict();

const CoverWalletQuery = z
  .object({
    orderId: z.string(),
  })
  .strict();

const CoverWalletBatchBody = z
  .object({
    orderIds: z.array(z.string()).min(1).max(50),
  })
  .strict();

const DownloadQuery = z
  .object({
    orderId: z.string(),
  })
  .strict();

function requireUser(reply: any, request: any) {
  const userId = request.user?.uid;
  if (!userId) {
    reply.status(401).send(
      buildErrorResponse({
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        requestId: request.id,
      }),
    );
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
      : (bundle?.remainingSlots ?? 0),
  };
}

export default async function ticketRoutes(fastify: FastifyInstance) {
  fastify.get('/tickets', async (request: any, reply) => {
    const userId = requireUser(reply, request);
    if (!userId) return;

    try {
      const wallet = await getGuestWallet(fastify.db, fastify.auth, userId);
      // Keep top-level wallet fields for backward compat; add canonical data envelope
      return { success: true, data: wallet, ...wallet };
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /tickets failed',
      );
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.get('/tickets/me', async (request: any, reply) => {
    const userId = requireUser(reply, request);
    if (!userId) return;

    try {
      const { getUserTicketsFromCollection } = await import('@c1rcle/core/ticket-engine');
      const data = await getUserTicketsFromCollection(userId);
      return buildSuccessResponse(data);
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /tickets/me failed',
      );
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.get('/tickets/my-wallet', async (request: any, reply) => {
    const userId = requireUser(reply, request);
    if (!userId) return;

    try {
      const wallet = await getUserTicketWallet({ db: fastify.db, userId });
      return {
        success: true,
        data: wallet,
        orders: wallet.orders,
        tickets: wallet.tickets,
        qrTtlSeconds: wallet.qrTtlSeconds,
      };
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /tickets/my-wallet failed',
      );
      return reply.status(error.code === 'UNAUTHORIZED' ? 401 : 500).send(
        buildErrorResponse({
          code: error.code === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
          message: error.code === 'UNAUTHORIZED' ? 'Unauthorized' : 'Internal server error',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.post(
    '/:id/transfer',
    {
      preHandler: [fastify.validate({ params: GroupTransferParam })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const { initiateGroupTransfer } = await import('@c1rcle/core/ticket-engine');
        const data = await initiateGroupTransfer(userId, request.params.id);

        fastify.log.info(
          { requestId: request.id, userId, ticketId: request.params.id },
          'Group transfer initiated',
        );
        return buildSuccessResponse(data);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /:id/transfer failed',
        );
        return reply.status(error.message.includes('Unauthorized') ? 403 : 400).send(
          buildErrorResponse({
            code: error.message.includes('Unauthorized') ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/claim',
    {
      preHandler: [fastify.validate({ body: GroupClaimBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const { claimGroupTransfer } = await import('@c1rcle/core/ticket-engine');
        const data = await claimGroupTransfer(userId, request.body.transferToken);

        fastify.log.info(
          { requestId: request.id, userId, ticketId: data.ticketId },
          'Group transfer claimed',
        );
        return buildSuccessResponse(data);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /claim failed',
        );
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/tickets/transfer',
    {
      preHandler: [fastify.validate({ body: TransferBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const transfer = await initiateGuestTransfer(
          userId,
          request.body.ticketId,
          request.body.recipientEmail ?? null,
        );
        fastify.log.info(
          {
            requestId: request.id,
            userId,
            ticketId: request.body.ticketId,
            transferId: transfer.id,
          },
          'Guest transfer initiated',
        );
        return { success: true, transfer };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        fastify.log.warn(
          { requestId: request.id, userId, error: error.message },
          'POST /tickets/transfer rejected',
        );
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Transfer failed',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.patch(
    '/tickets/transfer',
    {
      preHandler: [fastify.validate({ body: AcceptTransferBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await acceptGuestTransfer(userId, request.body.transferCode);
        fastify.log.info(
          { requestId: request.id, userId, transferCode: request.body.transferCode },
          'Guest transfer accepted',
        );
        return buildSuccessResponse(result as Record<string, unknown>);
      } catch (error: any) {
        const status = error.message?.includes('already') ? 409 : 400;
        fastify.log.warn(
          { requestId: request.id, userId, error: error.message },
          'PATCH /tickets/transfer rejected',
        );
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message: error.message || 'Transfer failed',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.delete('/tickets/transfer', async (request: any, reply) => {
    const userId = requireUser(reply, request);
    if (!userId) return;

    const transferId = request.query?.transferId;
    if (!transferId)
      return reply.status(400).send(
        buildErrorResponse({
          code: 'BAD_REQUEST',
          message: 'transferId query param is required',
          requestId: request.id,
        }),
      );

    try {
      const result = await cancelGuestTransfer(userId, transferId);
      fastify.log.info({ requestId: request.id, userId, transferId }, 'Guest transfer cancelled');
      return { success: true, ...result };
    } catch (error: any) {
      const status = error.message?.includes('Unauthorized') ? 403 : 400;
      return reply.status(status).send(
        buildErrorResponse({
          code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
          message: error.message || 'Transfer failed',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.get('/tickets/transfer/pending', async (request: any, reply) => {
    const userId = requireUser(reply, request);
    if (!userId) return;

    try {
      const transfers = await getGuestPendingTransfers(userId, request.user?.email || null);
      return { success: true, transfers };
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, userId, error: error.message },
        'GET /tickets/transfer/pending failed',
      );
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.post(
    '/tickets/share',
    {
      preHandler: [fastify.validate({ body: ShareBundleBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const bundle = await createGuestShareBundle(userId, request.body);
        fastify.log.info(
          { requestId: request.id, userId, bundleId: bundle.id, orderId: bundle.orderId },
          'Guest share bundle created',
        );
        return { success: true, bundle };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Failed to create share bundle',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/tickets/share',
    {
      preHandler: [fastify.validate({ querystring: ShareBundleQuery })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const state = await getGuestShareState(request.query.orderId);
        if (!state)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );
        if (state.order.userId !== userId)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Unauthorized',
              requestId: request.id,
            }),
          );
        return { success: true, bundles: state.bundles, assignments: state.assignments };
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /tickets/share failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.delete(
    '/tickets/share',
    {
      preHandler: [fastify.validate({ body: ShareBundleDeleteBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        if (request.body.slotIndex !== undefined) {
          await reclaimGuestShareSlot(userId, request.body.bundleId, request.body.slotIndex);
        } else {
          await cancelGuestShareBundle(userId, request.body.bundleId);
        }
        fastify.log.info(
          { requestId: request.id, userId, bundleId: request.body.bundleId },
          'Guest share bundle updated',
        );
        return { success: true };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Failed to update share bundle',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/tickets/claim',
    {
      preHandler: [fastify.validate({ querystring: ClaimPreviewQuery })],
    },
    async (request: any, reply) => {
      try {
        const preview = await previewGuestShareBundle(
          request.query.token,
          request.user?.uid || null,
        );
        if (!preview)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Invalid or expired share link',
              requestId: request.id,
            }),
          );
        return { success: true, bundle: buildSharePreview(preview) };
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, error: error.message },
          'GET /tickets/claim failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/tickets/claim/share',
    {
      preHandler: [fastify.validate({ body: ClaimShareBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await claimGuestShareBundle(userId, request.body.token);
        fastify.log.info(
          { requestId: request.id, userId, token: request.body.token },
          'Guest share bundle claimed',
        );
        return { success: true, ...result };
      } catch (error: any) {
        const status = error.message?.includes('already') ? 409 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message: error.message || 'Failed to claim ticket',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/tickets/pair',
    {
      preHandler: [fastify.validate({ querystring: PairPreviewQuery })],
    },
    async (request: any, reply) => {
      const { token, bundleId } = request.query as any;

      try {
        if (token) {
          const preview = await previewGuestPairClaim(fastify.db, token);
          if (!preview)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Invalid or expired claim link',
                requestId: request.id,
              }),
            );
          return { success: true, claim: preview };
        }

        const userId = requireUser(reply, request);
        if (!userId) return;
        if (!bundleId)
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'token or bundleId is required',
              requestId: request.id,
            }),
          );

        const status = await getGuestCoupleStatus(fastify.db, userId, bundleId);
        if (!status)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Couple ticket not found',
              requestId: request.id,
            }),
          );
        return { success: true, ...status };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Failed to load pair state',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/tickets/pair',
    {
      preHandler: [fastify.validate({ body: PairClaimBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await claimGuestPartnerSlot(userId, request.body.token);
        fastify.log.info(
          { requestId: request.id, userId, token: request.body.token },
          'Guest pair slot claimed',
        );
        return { success: true, ...result };
      } catch (error: any) {
        const status = error.message?.includes('already') ? 409 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message: error.message || 'Failed to claim pair slot',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.delete(
    '/tickets/pair',
    {
      preHandler: [fastify.validate({ body: PairCancelBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await cancelGuestPartnerSlot(userId, request.body.bundleId);
        fastify.log.info(
          { requestId: request.id, userId, bundleId: request.body.bundleId },
          'Guest pair slot cancelled',
        );
        return { success: true, ...result };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Failed to cancel pair slot',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/tickets/pair/link',
    {
      preHandler: [fastify.validate({ body: PairLinkBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await createGuestPartnerClaimLink(
          userId,
          request.body.ticketId,
          request.body.eventId,
        );
        return { success: true, ...result };
      } catch (error: any) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: error.message || 'Failed to create pair link',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/tickets/pair/assign',
    {
      preHandler: [fastify.validate({ body: PairAssignBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await assignGuestPartner(
          userId,
          request.body.ticketId,
          request.body.partnerUserId,
          request.body.metadata || {},
        );
        return { success: true, assignment: result };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Failed to assign partner',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/tickets/pair/transfer',
    {
      preHandler: [fastify.validate({ body: PairTransferBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await transferGuestCoupleTicket(
          userId,
          request.body.ticketId,
          request.body.newOwnerId,
        );
        return { success: true, ...result };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Failed to transfer couple ticket',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/tickets/cover-wallet',
    {
      preHandler: [fastify.validate({ querystring: CoverWalletQuery })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const wallets = await getGuestCoverWallet(fastify.db, userId, request.query.orderId);
        if (wallets === null)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );
        return { success: true, wallets };
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /tickets/cover-wallet failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/tickets/cover-wallets',
    {
      preHandler: [fastify.validate({ body: CoverWalletBatchBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const walletsByOrder = await getGuestCoverWalletsByOrderIds(
          fastify.db,
          userId,
          request.body.orderIds,
        );
        return buildSuccessResponse({ walletsByOrder });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /tickets/cover-wallets failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/tickets/download',
    {
      preHandler: [fastify.validate({ querystring: DownloadQuery })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await generateGuestTicketDownload(userId, request.query.orderId);
        if (!result)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );

        reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .header('Cache-Control', 'private, max-age=3600');

        return reply.send(result.buffer);
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /tickets/download failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/transfer',
    {
      preHandler: [fastify.validate({ querystring: TransferQuery })],
    },
    async (request: any, reply) => {
      try {
        const snapshot = await fastify.db
          .collection('transfers')
          .where('token', '==', request.query.code)
          .limit(1)
          .get();

        if (snapshot.empty) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Transfer not found or expired',
              requestId: request.id,
            }),
          );
        }

        const doc = snapshot.docs[0];
        const transferData = doc.data() as any;

        let event: any = null;
        if (transferData.eventId) {
          const eventDoc = await fastify.db.collection('events').doc(transferData.eventId).get();
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

        // 🛡️ Privacy: Redact sensitive UID and Email from public preview
        return {
          success: true,
          transfer: {
            id: doc.id,
            status: transferData.status,
            createdAt: transferData.createdAt,
            expiresAt: transferData.expiresAt,
            ticketType: transferData.ticketType || 'Pass',
            event,
          },
        };
      } catch (error: any) {
        fastify.log.error({ requestId: request.id, error: error.message }, 'GET /transfer failed');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/tickets/:ticketId',
    {
      preHandler: [fastify.validate({ params: TicketIdParam })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const ticket = await getGuestWalletTicket(
          fastify.db,
          fastify.auth,
          userId,
          request.params.ticketId,
        );
        if (!ticket)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Ticket not found',
              requestId: request.id,
            }),
          );
        return { success: true, ticket };
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'GET /tickets/:ticketId failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /tickets/:ticketId/refresh-qr
   * Generate a fresh QR code JWT for a ticket.
   * Used after transfer to invalidate the old QR.
   * The QR encodes: { orderId, ticketId, eventId, userId, iat, exp }
   * and is signed so door scanners can validate it.
   */
  fastify.post(
    '/tickets/:ticketId/refresh-qr',
    {
      preHandler: [fastify.validate({ params: TicketIdParam })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      const { ticketId } = request.params;

      try {
        const ticket = await getGuestWalletTicket(fastify.db, fastify.auth, userId, ticketId);
        if (!ticket)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Ticket not found',
              requestId: request.id,
            }),
          );

        // Generate fresh QR data as a signed JWT
        const { sign } = await import('jsonwebtoken');
        const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET;
        if (!QR_SECRET) {
          return reply.status(500).send(
            buildErrorResponse({
              code: 'INTERNAL_ERROR',
              message: 'QR signing key not configured',
              requestId: request.id,
            }),
          );
        }

        const qrPayload = {
          orderId: ticket.orderId,
          ticketId: ticket.id || ticketId,
          eventId: ticket.eventId,
          userId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300, // 5-minute TTL
        };

        const qrData = sign(qrPayload, QR_SECRET, { algorithm: 'HS256' });

        fastify.log.info({ requestId: request.id, userId, ticketId }, 'QR code refreshed');

        return buildSuccessResponse({ qrData, qrTtlSeconds: 300 });
      } catch (error: any) {
        fastify.log.error(
          { requestId: request.id, userId, error: error.message },
          'POST /tickets/:ticketId/refresh-qr failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );
}
