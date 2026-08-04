import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
// @ts-ignore
import {
  getGuestWallet,
  getGuestWalletTicket,
} from '@c1rcle/core/guest-wallet-profile-notification-service';
// @ts-ignore
import {
  createTicketQrForEntitlement,
  getUserTicketWallet,
} from '@c1rcle/core/ticket-checkout-wallet-service';
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: AcceptTransferBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await acceptGuestTransfer(userId, request.body.transferCode, {
          email: request.user?.email || null,
          emailVerified: request.user?.email_verified === true,
        });
        fastify.log.info(
          { requestId: request.id, userId, transferCode: request.body.transferCode },
          'Guest transfer accepted',
        );
        return buildSuccessResponse(result as Record<string, unknown>);
      } catch (error: any) {
        const status =
          error.code === 'TRANSFER_ALREADY_CLAIMED'
            ? 409
            : error.code === 'TRANSFER_RECIPIENT_MISMATCH'
              ? 403
              : 400;
        fastify.log.warn(
          { requestId: request.id, userId, error: error.message },
          'PATCH /tickets/transfer rejected',
        );
        return reply.status(status).send(
          buildErrorResponse({
            code: error.code || (status === 409 ? 'TRANSFER_ALREADY_CLAIMED' : 'BAD_REQUEST'),
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
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

  // Public ticket view / share endpoint.
  //
  // The `:entitlementId` path segment carries one of two very different things:
  //
  //   1. A public share TOKEN (`stk_…`) — an unguessable, per-ticket capability.
  //      Possession of the token is the authorisation, so this path is reachable
  //      anonymously: that is exactly the "share my ticket" link.
  //
  //   2. A raw entitlement ID (`ENT-…`) — deterministic and therefore ENUMERABLE
  //      (`ENT-{orderId}-{tierId}-{index}`). Anyone who can guess an order ID can
  //      derive every ticket ID under it, so a raw ID grants NO anonymous access:
  //      it is honoured only for the authenticated owner of that entitlement.
  //      Everyone else gets an indistinguishable 404, which is what closes the
  //      IDOR — enumeration by ID can no longer confirm a ticket exists, read its
  //      state, or harvest attendance.
  //
  // Holder-specific data (live door state + a scannable QR) is additionally gated
  // to the authenticated owner regardless of how the ticket was located, so a
  // valid share token lets a friend see the ticket but never a working credential.
  fastify.get('/tickets/public/:entitlementId', async (request: any, reply) => {
    const { entitlementId: idOrToken } = request.params;
    const requesterId = request.user?.uid || null;

    // Uniform 404 for "not found" and "found but you may not see it" — never leak
    // which one it was.
    const notFound = () =>
      reply.status(404).send(
        buildErrorResponse({
          code: 'NOT_FOUND',
          message: 'Ticket not found',
          requestId: request.id,
        }),
      );

    try {
      const { PUBLIC_TOKEN_PREFIX } = await import('@c1rcle/core/entitlement-engine');

      let entRef: any = null;
      let entitlement: any = null;

      if (typeof idOrToken === 'string' && idOrToken.startsWith(PUBLIC_TOKEN_PREFIX)) {
        // Token path: the token itself authorises the read. Anonymous is fine.
        const snap = await fastify.db
          .collection('entitlements')
          .where('publicToken', '==', idOrToken)
          .limit(1)
          .get();
        if (!snap.empty) {
          entRef = snap.docs[0].ref;
          entitlement = snap.docs[0].data();
        }
      } else {
        // Raw entitlement ID path: enumerable, so owner-only. We fetch first, then
        // require ownership — a non-owner (or anonymous) request 404s exactly like
        // a miss, so probing an ID reveals nothing about whether it exists.
        const doc = await fastify.db.collection('entitlements').doc(idOrToken).get();
        if (doc.exists) {
          const data = doc.data();
          if (requesterId && data?.ownerUserId === requesterId) {
            entRef = doc.ref;
            entitlement = data;
          }
        }
      }

      if (!entitlement) return notFound();

      const eventDoc = await fastify.db.collection('events').doc(entitlement.eventId).get();
      const event = eventDoc.exists ? eventDoc.data() : null;

      const isOwner = Boolean(requesterId) && requesterId === entitlement.ownerUserId;

      let qrPayload: string | null = null;
      let qrExpiresAt: string | null = null;
      if (isOwner) {
        try {
          const qr = await createTicketQrForEntitlement({
            db: fastify.db,
            userId: requesterId,
            entitlementId: entitlement.id,
          });
          qrPayload = qr.qrPayload;
          qrExpiresAt = qr.qrExpiresAt;
        } catch (error: any) {
          if (error?.code !== 'TICKET_MIGRATION_REQUIRED' && error?.code !== 'NOT_FOUND') {
            throw error;
          }
        }
      }

      // Give the owner a share token to build the shareable link from. Tickets
      // issued before this field existed are lazily backfilled on first owner
      // view (best-effort — a failed write just means we retry next time).
      let shareToken: string | null = isOwner ? (entitlement.publicToken ?? null) : null;
      if (isOwner && !shareToken && entRef) {
        const { generatePublicToken } = await import('@c1rcle/core/entitlement-engine');
        shareToken = generatePublicToken();
        entRef.update({ publicToken: shareToken }).catch(() => {});
      }

      // Never let a shared cache serve one guest's ticket state to another.
      reply.header('Cache-Control', 'private, no-store');

      return {
        success: true,
        ticket: {
          entitlementId: entitlement.id,
          // Live door status is owner-only — a share-token viewer must not be able
          // to see whether the holder has already checked in.
          checkedIn: isOwner
            ? entitlement.checkedIn === true ||
              entitlement.state === 'CONSUMED' ||
              (typeof entitlement.scanCountUsed === 'number' && entitlement.scanCountUsed > 0)
            : false,
          state: isOwner ? entitlement.state : null,
          ticketType: entitlement.metadata?.tierName || entitlement.ticketType || 'Entry',
          entryType: entitlement.metadata?.entryType || 'general',
          quantity: entitlement.scanCountAllowed || 1,
          qrPayload,
          qrExpiresAt,
          // Only the owner receives the share capability.
          shareToken,
          eventTitle: event?.title || entitlement.eventSummary?.title || 'Event',
          eventStartAt:
            event?.startDate || event?.startAt || entitlement.eventSummary?.startAt || null,
          venueName:
            event?.venue ||
            event?.venueName ||
            event?.location ||
            entitlement.eventSummary?.venue ||
            'TBD',
          city: event?.city || entitlement.eventSummary?.city || '',
          posterUrl: event?.image || entitlement.eventSummary?.posterUrl || null,
        },
      };
    } catch (error: any) {
      fastify.log.error(
        { requestId: request.id, idOrToken, error: error.message },
        'GET /tickets/public/:entitlementId failed',
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
}
