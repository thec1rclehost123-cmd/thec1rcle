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
  createCoverWalletQrToken,
  hashSupervisorPin,
} from '@c1rcle/core/cover-charge-engine';
import { validateScannerSession } from '../../lib/scannerSessions';
import { resolvePartnerContext } from '../../lib/partner-context.js';
import { getPermissionsForRole, normalizePartnerRole } from '../../lib/rbac-permissions.js';

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
    supervisorPin: z.string().regex(/^\d{4,12}$/),
  })
  .strict();

const TopUpBody = z
  .object({
    walletId: z.string().min(1),
    amountPaise: z.number().int().safe().positive(),
    reason: z.string().min(3),
    idempotencyKey: z.string().uuid(),
    supervisorPin: z.string().regex(/^\d{4,12}$/),
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
    reason: z.string().min(3).optional(),
  })
  .strict();

const SupervisorPinBody = z
  .object({
    pin: z.string().regex(/^\d{4,12}$/),
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

function isWalletExpired(wallet: any): boolean {
  const terminationMs = Number.isSafeInteger(wallet?.terminationAtMs)
    ? wallet.terminationAtMs
    : new Date(wallet?.rules?.terminationTime || '').getTime();
  return !Number.isFinite(terminationMs) || terminationMs <= Date.now();
}

function guestWalletDto(id: string, wallet: any) {
  const showBalance = wallet.rules?.showBalanceToGuest ?? true;
  return {
    id,
    orderId: wallet.orderId,
    eventId: wallet.eventId,
    venueId: wallet.venueId,
    tierId: wallet.tierId || null,
    unitIndex: wallet.unitIndex || 1,
    state: wallet.state,
    terminationTime: wallet.rules?.terminationTime || null,
    showBalanceToGuest: showBalance,
    showTransactionHistory: wallet.rules?.showTransactionHistory ?? true,
    ...(showBalance
      ? {
          currentBalancePaise: wallet.currentBalancePaise,
          openingBalancePaise: wallet.openingBalancePaise,
          totalDebitedPaise: wallet.totalDebitedPaise || 0,
          totalCreditedPaise: wallet.totalCreditedPaise || 0,
          totalReversedPaise: wallet.totalReversedPaise || 0,
          txnCount: wallet.txnCount || 0,
        }
      : {}),
  };
}

async function loadWalletTransactions(fastify: FastifyInstance, walletId: string, limit = 20) {
  const snapshot = await fastify.db
    .collection('cover_wallets')
    .doc(walletId)
    .collection('txns')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((document: any) => ({ id: document.id, ...document.data() }));
}

// =============================================================================
// Scanner session token validation (C3 — scanner is a no-Firebase-auth route)
// =============================================================================

async function requireChargeSession(fastify: FastifyInstance, request: any): Promise<any | null> {
  const authHeader = (request.headers.authorization as string) || '';
  const scannerHeader = (request.headers['x-scanner-code'] as string) || '';
  if (authHeader && scannerHeader) return null;
  const token = (authHeader || scannerHeader).replace(/^Bearer\s+/i, '').trim();
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

async function requireVenueSettingsAuthority(fastify: FastifyInstance, request: any) {
  await fastify.enrichAuthContext(request);
  const context = await resolvePartnerContext(fastify.db, request).catch(() => null);
  if (!context || context.type !== 'venue') {
    return { ok: false as const, status: 404, code: 'VENUE_NOT_FOUND' };
  }
  const membership = (request.authContext?.memberships || []).find(
    (candidate: any) =>
      String(candidate.partnerId) === String(context.partnerId) &&
      (candidate.isActive === true || candidate.status === 'active') &&
      String(candidate.status || 'active').toLowerCase() !== 'removed',
  );
  const fallbackRole = context.roles.includes('venue_owner') ? 'OWNER' : '';
  const role = normalizePartnerRole(membership?.role || fallbackRole);
  if (!getPermissionsForRole('venue', role).includes('MANAGE_SETTINGS')) {
    return { ok: false as const, status: 403, code: 'PERMISSION_REQUIRED' };
  }
  return { ok: true as const, context, role };
}

// =============================================================================
// Route Registration
// =============================================================================

export default async function coverChargeRoutes(fastify: FastifyInstance) {
  // ── PUT /api/v1/cover-charge/supervisor-pin ────────────────────────────

  fastify.put(
    '/supervisor-pin',
    {
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: SupervisorPinBody })],
    },
    async (request: any, reply) => {
      const authority = await requireVenueSettingsAuthority(fastify, request);
      if (!authority.ok) {
        return reply.status(authority.status).send({
          success: false,
          code: authority.code,
          message:
            authority.code === 'PERMISSION_REQUIRED'
              ? 'MANAGE_SETTINGS permission is required'
              : 'Venue not found',
        });
      }

      const supervisorPinHash = hashSupervisorPin(request.body.pin);
      const changedAt = new Date().toISOString();
      const settingsRef = fastify.db
        .collection('platform_settings')
        .doc(`venue_${authority.context.partnerId}`);
      const auditRef = fastify.db.collection('audit_logs').doc();
      const batch = fastify.db.batch();
      batch.set(
        settingsRef,
        {
          supervisorPinHash,
          supervisorPinVersion: 'scrypt-v1',
          supervisorPinUpdatedAt: changedAt,
          supervisorPinUpdatedBy: request.user.uid,
        },
        { merge: true },
      );
      batch.set(auditRef, {
        action: 'cover_charge.supervisor_pin_rotated',
        actorId: request.user.uid,
        actorRole: authority.role,
        partnerId: authority.context.partnerId,
        partnerType: 'venue',
        requestId: request.id || null,
        createdAt: changedAt,
      });
      await batch.commit();

      return {
        success: true,
        configured: true,
        updatedAt: changedAt,
      };
    },
  );

  // ── GET /api/v1/cover-charge/me ────────────────────────────────────────

  fastify.get(
    '/me',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const authenticatedUid = request.user?.uid;
      if (!authenticatedUid) return reply.status(401).send({ error: 'Unauthorized' });

      const snapshot = await fastify.db
        .collection('cover_wallets')
        .where('userId', '==', authenticatedUid)
        .limit(100)
        .get();
      const walletRows = snapshot.docs
        .map((document: any) => ({
          id: document.id,
          data: document.data(),
        }))
        .sort(
          (left: any, right: any) =>
            new Date(right.data.issuedAt || 0).getTime() -
            new Date(left.data.issuedAt || 0).getTime(),
        );

      const wallets = walletRows.map(({ id, data }: any) => guestWalletDto(id, data));
      const transactionPairs = await Promise.all(
        walletRows.map(async ({ id, data }: any) => [
          id,
          (data.rules?.showTransactionHistory ?? true)
            ? await loadWalletTransactions(fastify, id)
            : [],
        ]),
      );
      const transactionsByWallet = Object.fromEntries(transactionPairs);
      const primaryWallet = wallets[0] || null;

      reply.header('Cache-Control', 'private, no-store');
      return {
        wallets,
        transactionsByWallet,
        // Compatibility envelope for the currently deployed Mobile wallet.
        wallet: primaryWallet,
        transactions: primaryWallet ? transactionsByWallet[primaryWallet.id] || [] : [],
      };
    },
  );

  // ── GET /api/v1/cover-charge/wallet/:walletId/qr-jwt ───────────────────

  fastify.get(
    '/wallet/:walletId/qr-jwt',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: WalletParams })],
    },
    async (request: any, reply) => {
      const { walletId } = request.params as z.infer<typeof WalletParams>;
      const authenticatedUid = request.user?.uid;
      if (!authenticatedUid) return reply.status(401).send({ error: 'Unauthorized' });

      const walletDoc = await fastify.db.collection('cover_wallets').doc(walletId).get();
      if (!walletDoc.exists) return reply.status(404).send({ error: 'Wallet not found' });
      const wallet = { id: walletDoc.id, ...walletDoc.data() } as any;
      if (wallet.userId !== authenticatedUid) {
        return reply.status(404).send({ error: 'Wallet not found' });
      }
      if (wallet.state !== 'ACTIVE') {
        return reply
          .status(wallet.state === 'FROZEN' ? 423 : 410)
          .send({ error: `Wallet is ${String(wallet.state).toLowerCase()}` });
      }
      if (isWalletExpired(wallet)) {
        return reply.status(410).send({ error: 'Wallet has expired' });
      }

      const signed = createCoverWalletQrToken(wallet);
      reply.header('Cache-Control', 'private, no-store');
      return {
        jwt: signed.token,
        expiresAt: signed.expiresAt,
        walletId: wallet.id,
      };
    },
  );

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
        .limit(51)
        .get();
      const scopedWallets = snap.docs.filter((document: any) => {
        const wallet = document.data();
        return (
          wallet.state === 'ACTIVE' &&
          String(wallet.eventId) === String(session.sessionData.eventId) &&
          String(wallet.venueId) === String(session.sessionData.venueId)
        );
      });
      if (scopedWallets.length === 0) {
        return reply.status(404).send({ error: 'No active wallet for this order' });
      }
      if (scopedWallets.length > 1) {
        return reply.status(409).send({
          error: 'This order has multiple Cover Wallets. Scan the guest rotating wallet QR.',
          code: 'WALLET_SELECTION_REQUIRED',
        });
      }

      const doc = scopedWallets[0];
      const w = doc.data() as any;
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
        return reply.status(401).send({
          success: false,
          code: 'CHARGE_SESSION_REQUIRED',
          message: 'Charge session required',
        });
      }

      try {
        // Exact rolling-window device limit. Redis failure is fail-closed so
        // an offline/degraded scanner can never create a double-spend window.
        let velocityOk = false;
        try {
          velocityOk = await checkAndIncrementVelocity(
            fastify.redis,
            session.sessionData.deviceId,
            body.walletId,
            3,
            body.idempotencyKey,
          );
        } catch (error: any) {
          fastify.log.error(
            { error: error?.message, deviceId: session.sessionData.deviceId },
            '[CoverCharge] velocity authority unavailable',
          );
          return reply.status(503).send({
            success: false,
            code: 'VELOCITY_UNAVAILABLE',
            message: 'Cover Charge is temporarily unavailable. No debit was recorded.',
          });
        }
        if (!velocityOk) {
          return reply.status(429).send({
            success: false,
            code: 'VELOCITY_EXCEEDED',
            message: 'This device has reached the maximum of 3 debits in 60 seconds.',
          });
        }

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
                      : result.code === 'IDEMPOTENCY_CONFLICT'
                        ? 409
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
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
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
          supervisorPin: body.supervisorPin,
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
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
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
          supervisorPin: body.supervisorPin,
          operatorId: authority.operator.id,
          operatorRole: authority.operator.role,
        });

        if (!result.success) {
          const statusCode =
            result.code === 'INSUFFICIENT_ROLE' || result.code === 'TOP_UP_POLICY_DENIED'
              ? 403
              : result.code === 'INVALID_SUPERVISOR_PIN' ||
                  result.code === 'SUPERVISOR_PIN_REQUIRED'
                ? 401
                : result.code === 'WALLET_NOT_FOUND'
                  ? 404
                  : result.code === 'WALLET_EXPIRED'
                    ? 410
                    : result.code === 'IDEMPOTENCY_CONFLICT'
                      ? 409
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
      if (!result.success) {
        return reply.status(result.code === 'WALLET_NOT_FOUND' ? 404 : 422).send(result);
      }
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
      const result = await unfreezeWallet(
        body.walletId,
        authority.operator.id,
        body.reason || 'SUPERVISOR_UNFREEZE',
      );
      if (!result.success) {
        return reply
          .status(
            result.code === 'WALLET_NOT_FOUND' ? 404 : result.code === 'WALLET_EXPIRED' ? 410 : 422,
          )
          .send(result);
      }
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

      const txns = await loadWalletTransactions(fastify, walletId);

      // Redact transaction history for guests if disabled
      const showHistory = wallet.rules?.showTransactionHistory ?? true;
      const showBalance = wallet.rules?.showBalanceToGuest ?? true;

      if (!isVenueStaff && !showBalance) {
        reply.header('Cache-Control', 'private, no-store');
        return {
          wallet: guestWalletDto(walletDoc.id, wallet),
          transactions: showHistory ? txns : [],
        };
      }

      reply.header('Cache-Control', 'private, no-store');
      return {
        wallet: {
          id: walletDoc.id,
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
      await fastify.enrichAuthContext(request);
      const membership = request.authContext?.memberships?.find(
        (candidate: any) =>
          String(candidate.partnerId) === String(venueId) &&
          (candidate.isActive === true || candidate.status === 'active'),
      );
      const permissions = getPermissionsForRole(
        membership?.partnerType || 'venue',
        membership?.role || '',
      );
      if (!permissions.includes('VIEW_FINANCIALS')) {
        return reply.status(403).send({
          error: 'VIEW_FINANCIALS permission is required',
          code: 'PERMISSION_REQUIRED',
        });
      }
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists || String(eventDoc.data()?.venueId) !== String(venueId)) {
        return reply.status(404).send({ error: 'Reconciliation not found' });
      }

      // Recompute on demand. A previously persisted report is evidence/history,
      // never a live financial cache.
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
