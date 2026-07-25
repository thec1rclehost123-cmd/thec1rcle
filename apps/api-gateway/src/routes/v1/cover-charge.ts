/**
 * Cover Charge Wallet — Fastify API Routes
 *
 * All monetary values in requests/responses are in integer PAISE.
 * All mutations require Firebase Auth token (staff or admin).
 * Offline debits are hard-rejected (no offline queue in v1).
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  debitWallet,
  reverseTransaction,
  topUpWallet,
  freezeWallet,
  unfreezeWallet,
  checkAndIncrementVelocity,
  generateReconciliation,
} from '@c1rcle/core/cover-charge-engine';
import { validateScannerSession } from '../../lib/scannerSessions';
import { resolvePartnerContext } from '../../lib/partner-context.js';
import { normalizePartnerRole } from '../../lib/rbac-permissions.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const DebitBody = z
  .object({
    walletId: z.string().min(1),
    presetItemId: z.string().min(1),
    quantity: z.number().int().min(1).max(10),
    idempotencyKey: z.string().uuid('idempotencyKey must be a UUID'),
  })
  .strict();

const ReverseBody = z
  .object({
    walletId: z.string().min(1),
    transactionId: z.string().min(1),
    reason: z.string().min(3),
    supervisorPinHash: z.string().min(1),
  })
  .strict();

const TopUpBody = z
  .object({
    walletId: z.string().min(1),
    amountPaise: z.number().int().positive(),
    reason: z.string().min(3),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const FreezeBody = z
  .object({
    walletId: z.string().min(1),
    reason: z.string().min(3),
  })
  .strict();

const UnfreezeBody = z
  .object({
    walletId: z.string().min(1),
  })
  .strict();

const WalletParams = z
  .object({
    walletId: z.string().min(1),
  })
  .strict();

const WalletByOrderParams = z
  .object({
    orderId: z.string().min(1),
  })
  .strict();

const ReconciliationQuery = z
  .object({
    eventId: z.string().min(1),
    venueId: z.string().min(1),
  })
  .strict();

// =============================================================================
// Scanner session token validation (C3 — scanner is a no-Firebase-auth route)
// =============================================================================

async function requireChargeSession(fastify: FastifyInstance, request: any): Promise<any | null> {
  const authHeader = (request.headers.authorization as string) || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const session = await validateScannerSession(fastify, token);
  if (!session.authorized) return null;
  if (
    session.sessionData?.codeType !== 'charge' ||
    session.codeData?.type !== 'charge' ||
    session.sessionData?.codeId !== session.codeDoc.id ||
    !session.sessionData?.eventId ||
    !session.sessionData?.venueId ||
    !session.sessionData?.deviceId
  ) {
    return null;
  }
  const boundDevice = await fastify.db
    .collection('bound_devices')
    .doc(`${session.sessionData.venueId}_${session.sessionData.deviceId}`)
    .get();
  if (
    !boundDevice.exists ||
    boundDevice.data()?.bound !== true ||
    boundDevice.data()?.status !== 'active'
  ) {
    return null;
  }
  request.scannerCodeId = session.codeDoc.id;
  request.scannerCodeData = session.codeData;
  return session;
}

async function requireVenueWalletAuthority(
  fastify: FastifyInstance,
  request: any,
  walletId: string,
  supervisorOnly = false,
) {
  const walletDoc = await fastify.db.collection('cover_wallets').doc(walletId).get();
  if (!walletDoc.exists) return { ok: false as const, status: 404, code: 'WALLET_NOT_FOUND' };
  const wallet = walletDoc.data() as any;
  const context = await resolvePartnerContext(fastify.db, request).catch(() => null);
  if (
    !context ||
    context.type !== 'venue' ||
    String(context.partnerId) !== String(wallet.venueId)
  ) {
    return { ok: false as const, status: 404, code: 'WALLET_NOT_FOUND' };
  }
  const membership = (request.authContext?.memberships || []).find(
    (candidate: any) =>
      candidate.partnerId === context.partnerId &&
      (candidate.isActive === true || candidate.status === 'active'),
  );
  const role = normalizePartnerRole(
    membership?.role ||
      (context.roles.some((item: string) => item.endsWith('_owner')) ? 'OWNER' : ''),
  );
  if (supervisorOnly && !['OWNER', 'MANAGER'].includes(role)) {
    return { ok: false as const, status: 403, code: 'SUPERVISOR_REQUIRED' };
  }
  return {
    ok: true as const,
    wallet,
    walletDoc,
    context,
    operator: {
      id: request.user.uid,
      name: request.user.name || request.user.email || 'Venue operator',
      role: role.toLowerCase(),
    },
  };
}

// =============================================================================
// Route Registration
// =============================================================================

export default async function coverChargeRoutes(fastify: FastifyInstance) {
  // ── POST /api/v1/cover-charge/debit ────────────────────────────────────

  // ── GET /api/v1/cover-charge/wallet/by-order/:orderId ──────────────────
  // H3: QR only contains orderId — look up wallet by orderId

  fastify.get(
    '/wallet/by-order/:orderId',
    {
      preHandler: [fastify.validate({ params: WalletByOrderParams })],
    },
    async (request: any, reply) => {
      const session = await requireChargeSession(fastify, request);
      if (!session) return reply.status(401).send({ error: 'Charge session required' });

      const { orderId } = request.params as any;
      const snap = await (fastify as any).db
        .collection('cover_wallets')
        .where('orderId', '==', orderId)
        .where('state', '==', 'ACTIVE')
        .limit(1)
        .get();

      if (snap.empty) return reply.status(404).send({ error: 'No active wallet for this order' });

      const doc = snap.docs[0];
      const w = doc.data() as any;
      if (
        String(w.eventId) !== String(session.sessionData.eventId) ||
        String(w.venueId) !== String(session.sessionData.venueId)
      ) {
        return reply.status(404).send({ error: 'No active wallet for this order' });
      }
      return {
        wallet: {
          id: doc.id,
          orderId: w.orderId,
          currentBalancePaise: w.currentBalancePaise,
          openingBalancePaise: w.openingBalancePaise,
          totalDebitedPaise: w.totalDebitedPaise || 0,
          guestFirstName: w.guestFirstName || 'Guest',
          state: w.state,
          terminationTime: w.rules?.terminationTime || null,
          rules: {
            allowedPresetItems: w.rules?.allowedPresetItems || [],
            showBalanceToGuest: w.rules?.showBalanceToGuest ?? true,
            maxChargeAmountPaise: w.rules?.maxChargeAmountPaise || 0,
            minChargeAmountPaise: w.rules?.minChargeAmountPaise || 0,
          },
        },
      };
    },
  );

  // ── POST /api/v1/cover-charge/debit ────────────────────────────────────

  fastify.post(
    '/debit',
    {
      preHandler: [fastify.validate({ body: DebitBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof DebitBody>;

      const session = await requireChargeSession(fastify, request);
      if (!session) {
        return reply
          .status(401)
          .send({
            success: false,
            code: 'CHARGE_SESSION_REQUIRED',
            message: 'Charge session required',
          });
      }

      // Velocity check (Redis-backed)
      const velocityOk = await checkAndIncrementVelocity(
        fastify.redis,
        session.sessionData.deviceId,
        body.walletId,
        3, // default max debits per minute per device
      );
      if (!velocityOk) {
        return reply.status(429).send({
          success: false,
          code: 'VELOCITY_EXCEEDED',
          message: 'Too many charges from this device in the past minute. Please wait.',
        });
      }

      try {
        const result = await debitWallet({
          walletId: body.walletId,
          presetItemId: body.presetItemId,
          quantity: body.quantity,
          idempotencyKey: body.idempotencyKey,
          operatorId: session.sessionData.userId || `charge_session_${session.sessionId}`,
          operatorName: session.sessionData.userName || 'Charge operator',
          operatorRole: 'charge_operator',
          deviceId: session.sessionData.deviceId,
          eventCodeId: session.codeDoc.id,
          authorizedEventId: session.sessionData.eventId,
          authorizedVenueId: session.sessionData.venueId,
          scannerSessionId: session.sessionId,
        });

        if (!result.success) {
          const statusCode =
            result.code === 'WALLET_NOT_FOUND'
              ? 404
              : result.code === 'INSUFFICIENT_BALANCE'
                ? 402
                : result.code === 'WALLET_TERMINATED' || result.code === 'WALLET_EXPIRED'
                  ? 410
                  : result.code === 'WALLET_FROZEN'
                    ? 423
                    : result.code === 'TXN_LIMIT_REACHED'
                      ? 429
                      : 422;
          return reply.status(statusCode).send(result);
        }

        return result;
      } catch (err: any) {
        fastify.log.error(`[CoverCharge] debit error: ${err.message}`);
        return reply
          .status(500)
          .send({ success: false, code: 'INTERNAL_ERROR', message: 'Internal server error' });
      }
    },
  );

  // ── POST /api/v1/cover-charge/reverse ──────────────────────────────────

  fastify.post(
    '/reverse',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: ReverseBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof ReverseBody>;
      const authority = await requireVenueWalletAuthority(fastify, request, body.walletId, true);
      if (!authority.ok)
        return reply.status(authority.status).send({ success: false, code: authority.code });

      try {
        const result = await reverseTransaction({
          walletId: body.walletId,
          transactionId: body.transactionId,
          reason: body.reason,
          supervisorPinHash: body.supervisorPinHash,
          operatorId: authority.operator.id,
          operatorRole: authority.operator.role,
          deviceId: 'supervisor_console',
          eventCodeId: 'supervisor_approval',
        });

        if (!result.success) {
          const statusCode =
            result.code === 'INSUFFICIENT_ROLE'
              ? 403
              : result.code === 'INVALID_SUPERVISOR_PIN'
                ? 401
                : result.code === 'WALLET_NOT_FOUND' || result.code === 'TRANSACTION_NOT_FOUND'
                  ? 404
                  : result.code === 'ALREADY_REVERSED'
                    ? 409
                    : 422;
          return reply.status(statusCode).send(result);
        }

        return result;
      } catch (err: any) {
        fastify.log.error(`[CoverCharge] reverse error: ${err.message}`);
        return reply
          .status(500)
          .send({ success: false, code: 'INTERNAL_ERROR', message: 'Internal server error' });
      }
    },
  );

  // ── POST /api/v1/cover-charge/top-up ───────────────────────────────────

  fastify.post(
    '/top-up',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: TopUpBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof TopUpBody>;
      const authority = await requireVenueWalletAuthority(fastify, request, body.walletId, true);
      if (!authority.ok)
        return reply.status(authority.status).send({ success: false, code: authority.code });

      try {
        const result = await topUpWallet({
          walletId: body.walletId,
          amountPaise: body.amountPaise,
          reason: body.reason,
          idempotencyKey: body.idempotencyKey,
          operatorId: authority.operator.id,
          operatorRole: authority.operator.role,
        });

        if (!result.success) {
          const statusCode =
            result.code === 'INSUFFICIENT_ROLE'
              ? 403
              : result.code === 'WALLET_NOT_FOUND'
                ? 404
                : result.code === 'TOP_UP_DISABLED'
                  ? 422
                  : 422;
          return reply.status(statusCode).send(result);
        }

        return result;
      } catch (err: any) {
        fastify.log.error(`[CoverCharge] top-up error: ${err.message}`);
        return reply
          .status(500)
          .send({ success: false, code: 'INTERNAL_ERROR', message: 'Internal server error' });
      }
    },
  );

  // ── POST /api/v1/cover-charge/freeze ───────────────────────────────────

  fastify.post(
    '/freeze',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: FreezeBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof FreezeBody>;
      const authority = await requireVenueWalletAuthority(fastify, request, body.walletId, true);
      if (!authority.ok)
        return reply.status(authority.status).send({ success: false, code: authority.code });
      const result = await freezeWallet(body.walletId, body.reason, authority.operator.id);
      return result;
    },
  );

  // ── POST /api/v1/cover-charge/unfreeze ─────────────────────────────────

  fastify.post(
    '/unfreeze',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: UnfreezeBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof UnfreezeBody>;
      const authority = await requireVenueWalletAuthority(fastify, request, body.walletId, true);
      if (!authority.ok)
        return reply.status(authority.status).send({ success: false, code: authority.code });
      const result = await unfreezeWallet(body.walletId, authority.operator.id);
      if (!result.success) return reply.status(422).send(result);
      return result;
    },
  );

  // ── GET /api/v1/cover-charge/wallet/:walletId ──────────────────────────

  fastify.get(
    '/wallet/:walletId',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: WalletParams })],
    },
    async (request: any, reply) => {
      const { walletId } = request.params as any;
      const authenticatedUid = request.user?.uid;
      if (!authenticatedUid) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const walletDoc = await fastify.db.collection('cover_wallets').doc(walletId).get();
      if (!walletDoc.exists) return reply.status(404).send({ error: 'Wallet not found' });

      const wallet = walletDoc.data() as any;

      // Guests can only read their own wallet
      const isOwner = wallet.userId === authenticatedUid;
      let isVenueStaff = false;
      if (!isOwner) {
        const authority = await requireVenueWalletAuthority(fastify, request, walletId);
        if (!authority.ok) return reply.status(404).send({ error: 'Wallet not found' });
        isVenueStaff = true;
      }

      // Fetch last 20 txns
      const txnsSnap = await fastify.db
        .collection('cover_wallets')
        .doc(walletId)
        .collection('txns')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const txns = txnsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      // Redact transaction history for guests if disabled
      const showHistory = wallet.rules?.showTransactionHistory ?? true;
      const showBalance = wallet.rules?.showBalanceToGuest ?? true;

      if (!isVenueStaff && !showBalance) {
        return { wallet: { id: wallet.id, state: wallet.state, eventId: wallet.eventId } };
      }

      return {
        wallet: {
          id: wallet.id,
          state: wallet.state,
          eventId: wallet.eventId,
          venueId: wallet.venueId,
          currentBalancePaise: wallet.currentBalancePaise,
          openingBalancePaise: wallet.openingBalancePaise,
          terminationTime: wallet.rules?.terminationTime,
          txnCount: wallet.txnCount,
        },
        transactions: isVenueStaff || showHistory ? txns : [],
      };
    },
  );

  // ── GET /api/v1/cover-charge/reconciliation ────────────────────────────

  fastify.get(
    '/reconciliation',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: ReconciliationQuery })],
    },
    async (request: any, reply) => {
      const { eventId, venueId } = request.query as any;

      const context = await resolvePartnerContext(fastify.db, request).catch(() => null);
      if (!context || context.type !== 'venue' || context.partnerId !== venueId) {
        return reply.status(404).send({ error: 'Reconciliation not found' });
      }
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists || String(eventDoc.data()?.venueId) !== String(venueId)) {
        return reply.status(404).send({ error: 'Reconciliation not found' });
      }

      // Check if a cached reconciliation already exists
      const existing = await fastify.db
        .collection('cover_wallet_reconciliations')
        .doc(`${venueId}_${eventId}`)
        .get();
      if (existing.exists) {
        return existing.data();
      }

      // Generate on demand
      try {
        const recon = await generateReconciliation(eventId, venueId);
        return recon;
      } catch (err: any) {
        fastify.log.error(`[CoverCharge] reconciliation error: ${err.message}`);
        return reply.status(500).send({ error: 'Failed to generate reconciliation' });
      }
    },
  );
}
