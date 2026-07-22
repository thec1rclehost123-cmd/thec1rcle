import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHmac } from 'crypto';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { getQrSecret } from '../../lib/scannerSessions';
// @ts-ignore
import {
  getGuestWallet,
  getGuestWalletTicket,
} from '@c1rcle/core/guest-wallet-profile-notification-service';
// @ts-ignore
import { getUserTicketWallet } from '@c1rcle/core/ticket-checkout-wallet-service';
// @ts-ignore - JS module with runtime exports
import { isPremiumRequiredError } from '@c1rcle/core/subscription-service';
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
  previewGuestTransfer,
  reclaimGuestShareSlot,
  revokeGuestShareSlot,
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
    idempotencyKey: z.string().optional(),
  })
  .strict();

const AcceptTransferBody = z
  .object({
    transferCode: z.string(),
    idempotencyKey: z.string().optional(),
  })
  .strict();

const ShareBundleBody = z
  .object({
    orderId: z.string(),
    eventId: z.string(),
    quantity: z.number().int().positive(),
    tierId: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    idempotencyKey: z.string().optional(),
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

const ShareRevokeBody = z
  .object({
    bundleId: z.string(),
    slotIndex: z.number().int().positive(),
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
    idempotencyKey: z.string().optional(),
  })
  .strict();

const TransferQuery = z
  .object({
    code: z.string(),
  })
  .strict();

const DeleteTransferQuery = z
  .object({
    transferId: z.string().min(1),
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
  if (!bundle) return null;
  const event = bundle?.event || null;
  const tier = Array.isArray(event?.tickets)
    ? event.tickets.find(
        (ticket: any) =>
          ticket?.id === bundle.tierId ||
          ticket?.ticketId === bundle.tierId ||
          ticket?.tierId === bundle.tierId,
      )
    : null;
  return {
    id: bundle.id,
    orderId: bundle.orderId,
    eventId: bundle.eventId,
    tierId: bundle.tierId,
    tierName: tier?.name || tier?.tierName || tier?.title || null,
    mode: bundle.mode,
    totalSlots: bundle.totalSlots,
    remainingSlots: bundle.remainingSlots,
    genderRequirement: bundle.genderRequirement,
    isCouple: bundle.isCouple,
    status: bundle.status,
    createdAt: bundle.createdAt,
    expiresAt: bundle.expiresAt,
    isOwnerClaimed:
      bundle.slots?.some(
        (s: any) => s.slotType === 'owner_locked' && s.claimStatus === 'claimed',
      ) || false,
    isCoupleComplete: bundle.isCouple
      ? bundle.slots?.filter((s: any) => s.slotType === 'shareable' && s.claimStatus === 'claimed')
          .length >= 1
      : false,
    eventTitle: event?.title || null,
    eventImage: event?.image || event?.poster || event?.coverImage || event?.posterUrl || null,
    eventDate: event?.date || event?.startDate || null,
    eventLocation: event?.location || event?.venue || null,
    availableSlots: Array.isArray(bundle?.slots)
      ? bundle.slots.filter((slot: any) => slot.claimStatus === 'unclaimed').length
      : (bundle?.remainingSlots ?? 0),
  };
}

function base64Url(value: unknown): string {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signTicketJwt(payload: Record<string, unknown>): string {
  const header = base64Url({ alg: 'HS256', typ: 'JWT', kid: 'ticket-v1' });
  const body = base64Url(payload);
  const secret = getQrSecret();
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

export default async function ticketRoutes(fastify: FastifyInstance) {
  const requireVerifiedPhone =
    (fastify as any).requireVerifiedPhone || (fastify as any).requireAuth;
  fastify.get(
    '/tickets',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const wallet = await getGuestWallet(fastify.db, fastify.auth, userId);
        return buildSuccessResponse(wallet);
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
    },
  );

  fastify.get(
    '/tickets/me',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone],
    },
    async (request: any, reply) => {
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
    },
  );

  fastify.get(
    '/tickets/my-wallet',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const cached = await fastify.cache.get('ticket-wallet:v2', userId);
        if (cached) {
          reply.header('x-c1rcle-cache', 'HIT');
          return buildSuccessResponse(cached);
        }
        const wallet = await getUserTicketWallet({ db: fastify.db, userId });
        await fastify.cache.set('ticket-wallet:v2', userId, wallet, 30);
        reply.header('x-c1rcle-cache', 'MISS');
        return buildSuccessResponse(wallet);
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
    },
  );

  fastify.post(
    '/:id/transfer',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ params: GroupTransferParam })],
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
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: GroupClaimBody })],
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: TransferBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      const idempotencyKey =
        (request.headers['x-idempotency-key'] as string) || request.body.idempotencyKey;

      const work = async () => {
        return await initiateGuestTransfer(
          userId,
          request.body.ticketId,
          request.body.recipientEmail ?? null,
        );
      };

      try {
        let transfer;
        if (idempotencyKey && fastify.idempotencyService?.executeOnce) {
          const result = await fastify.idempotencyService.executeOnce(idempotencyKey, userId, work);
          if (result.cached) return result.body;
          transfer = result;
        } else {
          if (idempotencyKey) {
            request.log.warn(
              { idempotencyKey, route: request.routeOptions?.url },
              'Idempotency key provided but idempotency service not configured',
            );
          }
          transfer = await work();
        }

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
        if (error.statusCode === 403) {
          return reply.status(403).send(
            buildErrorResponse({
              code: error.code || 'GENDER_RESTRICTION',
              message: error.message || 'Gender restriction prevents this transfer',
              requestId: request.id,
            }),
          );
        }
        if (isPremiumRequiredError(error)) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'PREMIUM_REQUIRED',
              message: error.message || 'C1RCLE Premium required',
              details: error.details || null,
              requestId: request.id,
            }),
          );
        }
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: AcceptTransferBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      const idempotencyKey =
        (request.headers['x-idempotency-key'] as string) || request.body.idempotencyKey;

      const work = async () => {
        return await acceptGuestTransfer(
          userId,
          request.body.transferCode,
          request.user?.email || null,
        );
      };

      try {
        let result;
        if (idempotencyKey && fastify.idempotencyService?.executeOnce) {
          const cached = await fastify.idempotencyService.executeOnce(idempotencyKey, userId, work);
          if (cached.cached) return cached.body;
          result = cached;
        } else {
          if (idempotencyKey) {
            request.log.warn(
              { idempotencyKey, route: request.routeOptions?.url },
              'Idempotency key provided but idempotency service not configured',
            );
          }
          result = await work();
        }

        fastify.log.info(
          { requestId: request.id, userId },
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

  fastify.delete(
    '/tickets/transfer',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ querystring: DeleteTransferQuery })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      const transferId = request.query.transferId;

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
    },
  );

  fastify.get(
    '/tickets/transfer/pending',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone],
    },
    async (request: any, reply) => {
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
    },
  );

  fastify.post(
    '/tickets/share',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: ShareBundleBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      const idempotencyKey =
        (request.headers['x-idempotency-key'] as string) || request.body.idempotencyKey;

      const work = async () => {
        return await createGuestShareBundle(userId, request.body);
      };

      try {
        let bundle;
        if (idempotencyKey && fastify.idempotencyService?.executeOnce) {
          const result = await fastify.idempotencyService.executeOnce(idempotencyKey, userId, work);
          if (result.cached) return result.body;
          bundle = result;
        } else {
          if (idempotencyKey) {
            request.log.warn(
              { idempotencyKey, route: request.routeOptions?.url },
              'Idempotency key provided but idempotency service not configured',
            );
          }
          bundle = await work();
        }

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
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ querystring: ShareBundleQuery })],
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: ShareBundleDeleteBody })],
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

  fastify.post(
    '/tickets/share/revoke',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: ShareRevokeBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await revokeGuestShareSlot(
          userId,
          request.body.bundleId,
          request.body.slotIndex,
        );
        fastify.log.info(
          {
            requestId: request.id,
            userId,
            bundleId: request.body.bundleId,
            slotIndex: request.body.slotIndex,
          },
          'Guest share slot revoked',
        );
        return { success: true, ...result };
      } catch (error: any) {
        const status = error.message?.includes('Unauthorized') ? 403 : 400;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
            message: error.message || 'Failed to revoke claimed ticket',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/tickets/claim',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: ClaimShareBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      const idempotencyKey =
        (request.headers['x-idempotency-key'] as string) || request.body.idempotencyKey;

      const work = async () => {
        return await claimGuestShareBundle(userId, request.body.token);
      };

      try {
        let result;
        if (idempotencyKey && fastify.idempotencyService?.executeOnce) {
          const cached = await fastify.idempotencyService.executeOnce(idempotencyKey, userId, work);
          if (cached.cached) return cached.body;
          result = cached;
        } else {
          if (idempotencyKey) {
            request.log.warn(
              { idempotencyKey, route: request.routeOptions?.url },
              'Idempotency key provided but idempotency service not configured',
            );
          }
          result = await work();
        }

        fastify.log.info(
          { requestId: request.id, userId },
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
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: PairClaimBody })],
    },
    async (request: any, reply) => {
      const userId = requireUser(reply, request);
      if (!userId) return;

      try {
        const result = await claimGuestPartnerSlot(userId, request.body.token);
        fastify.log.info(
          { requestId: request.id, userId },
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: PairCancelBody })],
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: PairLinkBody })],
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: PairAssignBody })],
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: PairTransferBody })],
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
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ querystring: CoverWalletQuery })],
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
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ body: CoverWalletBatchBody })],
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireVerifiedPhone, fastify.validate({ querystring: DownloadQuery })],
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
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: TransferQuery })],
    },
    async (request: any, reply) => {
      try {
        const transfer = await previewGuestTransfer(fastify.db, request.query.code);

        if (!transfer) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Transfer not found or expired',
              requestId: request.id,
            }),
          );
        }

        return { success: true, transfer };
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
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
   * Return the canonical ticket QR payload.
   * Only active tickets can get fresh QR codes.
   */
  fastify.post(
    '/tickets/:ticketId/refresh-qr',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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

        // SECURITY: Reject non-active or revoked tickets from fetching fresh QR codes
        const status = String(ticket?.status || '').toLowerCase();
        if (status !== 'active') {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'TICKET_NOT_ACTIVE',
              message: `Ticket is not active (status: ${status}). QR refresh denied.`,
              requestId: request.id,
            }),
          );
        }

        const ticketIdValue = ticket.id || ticket.ticketId || ticketId;
        const now = Math.floor(Date.now() / 1000);
        const jwt = signTicketJwt({
          iss: 'the-c1rcle',
          aud: 'c1rcle-scanner',
          typ: 'ticket',
          ticketId: ticketIdValue,
          bookingCode: ticket.bookingCode || null,
          userId,
          iat: now,
          nbf: now,
          exp: now + 120,
        });

        fastify.log.info({ requestId: request.id, userId, ticketId }, 'QR code refreshed');

        return buildSuccessResponse({
          qrData: jwt,
          qrPayload: jwt,
          bookingCode: ticket.bookingCode || null,
          qrMode: 'jwt',
          qrTtlSeconds: 120,
        });
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
