/**
 * Cover Charge Wallet — Fastify API Routes
 *
 * All monetary values in requests/responses are in integer PAISE.
 * All mutations require Firebase Auth token (staff or admin).
 * Offline debits are hard-rejected (no offline queue in v1).
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHmac } from 'node:crypto';
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
import { getQrSecret } from '../../lib/scannerSessions';

// =============================================================================
// Zod Schemas
// =============================================================================

const DebitBody = z
  .object({
    walletId: z.string().min(1),
    presetItemId: z.string().optional(),
    customAmountPaise: z.number().int().positive().optional(),
    quantity: z.number().int().min(1).max(10).optional().default(1),
    idempotencyKey: z.string().uuid('idempotencyKey must be a UUID'),
    operatorId: z.string().min(1),
    operatorName: z.string().optional().default(''),
    scannerSessionId: z.string().optional(),
    deviceId: z.string().min(1),
    eventCodeId: z.string().min(1),
    isOnline: z.boolean(), // client must declare connectivity state
  })
  .strict()
  .refine((data) => data.presetItemId || data.customAmountPaise, {
    message: 'Either presetItemId or customAmountPaise is required',
  });

const ReverseBody = z
  .object({
    walletId: z.string().min(1),
    transactionId: z.string().min(1),
    reason: z.string().min(3),
    supervisorPin: z.string().min(1),
    operatorId: z.string().min(1),
    deviceId: z.string().min(1),
    eventCodeId: z.string().min(1),
  })
  .strict();

const TopUpBody = z
  .object({
    walletId: z.string().min(1),
    amountPaise: z.number().int().positive(),
    reason: z.string().min(3),
    idempotencyKey: z.string().uuid(),
    operatorId: z.string().min(1),
  })
  .strict();

const FreezeBody = z
  .object({
    walletId: z.string().min(1),
    reason: z.string().min(3),
    frozenBy: z.string().min(1),
  })
  .strict();

const UnfreezeBody = z
  .object({
    walletId: z.string().min(1),
    unfrozenBy: z.string().min(1),
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
// Helpers
// =============================================================================

function base64Url(value: unknown): string {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64Url({ alg: 'HS256', typ: 'JWT', kid: 'wallet-v1' });
  const body = base64Url(payload);
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

// =============================================================================
// Scanner session token validation (C3 — scanner is a no-Firebase-auth route)
// =============================================================================

async function validateScannerToken(fastify: FastifyInstance, request: any): Promise<boolean> {
  const authHeader = (request.headers.authorization as string) || '';
  const token = authHeader.replace('Bearer ', '').trim();

  // Also support X-Scanner-Code header for scanner-app compat
  const scannerCode = (request.headers['x-scanner-code'] as string) || '';

  if (!token && !scannerCode) return false;

  // Try Firebase ID token first (staff also logged in as guest user)
  if (token) {
    try {
      await (fastify as any).firebase.auth().verifyIdToken(token);
      return true;
    } catch {}
  }

  // Try scanner session token (Bearer)
  if (token) {
    const session = await validateScannerSession(fastify, token);
    if (session.authorized) {
      request.scannerCodeId = session.codeDoc.id;
      request.scannerCodeData = session.codeData;
      return true;
    }
  }

  // Try X-Scanner-Code header — look up event_code directly
  if (scannerCode) {
    const codeSnap = await fastify.db
      .collection('event_codes')
      .where('code', '==', scannerCode.toUpperCase().trim())
      .limit(1)
      .get();
    if (!codeSnap.empty) {
      const codeDoc = codeSnap.docs[0];
      const codeData = codeDoc.data();
      if (!codeData.isRevoked) {
        request.scannerCodeId = codeDoc.id;
        request.scannerCodeData = codeData;
        return true;
      }
    }
  }

  return false;
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
      const isAuthorized = await validateScannerToken(fastify, request);
      if (!isAuthorized) return reply.status(401).send({ error: 'Unauthorized' });

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

  // ── GET /api/v1/cover-charge/me ─────────────────────────────────────────
  // Returns the current user's active cover wallet (for the Wallet tab).

  fastify.get('/me', async (request: any, reply) => {
    const authenticatedUid = request.user?.uid;
    if (!authenticatedUid) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const snap = await (fastify as any).db
      .collection('cover_wallets')
      .where('userId', '==', authenticatedUid)
      .orderBy('issuedAt', 'desc')
      .limit(5)
      .get();

    const activeWallet = snap.docs.find(
      (d: any) => d.data().state === 'PENDING' || d.data().state === 'ACTIVE',
    );

    if (!activeWallet) {
      return { wallet: null };
    }

    const doc = activeWallet;
    const w = doc.data() as any;

    // Fetch last 20 transactions
    const txnsSnap = await fastify.db
      .collection('cover_wallets')
      .doc(doc.id)
      .collection('txns')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const txns = txnsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    return {
      wallet: {
        id: doc.id,
        orderId: w.orderId,
        eventId: w.eventId,
        venueId: w.venueId,
        state: w.state,
        currentBalancePaise: w.currentBalancePaise,
        openingBalancePaise: w.openingBalancePaise,
        totalDebitedPaise: w.totalDebitedPaise || 0,
        totalCreditedPaise: w.totalCreditedPaise || 0,
        txnCount: w.txnCount || 0,
        issuedAt: w.issuedAt,
        activatedAt: w.activatedAt || null,
        terminationTime: w.rules?.terminationTime || null,
      },
      transactions: txns,
    };
  });

  // ── POST /api/v1/cover-charge/debit ────────────────────────────────────

  fastify.post(
    '/debit',
    {
      preHandler: [fastify.validate({ body: DebitBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof DebitBody>;

      // Hard block offline debits — v1 policy
      if (!body.isOnline) {
        return reply.status(503).send({
          success: false,
          code: 'OFFLINE_NOT_SUPPORTED',
          message:
            'Cover Wallet charges require a live connection. Connect to venue Wi-Fi or mobile data.',
        });
      }

      // C3: Accept scanner session token OR Firebase auth
      const isScannerAuthorized = await validateScannerToken(fastify, request);
      if (!isScannerAuthorized) {
        return reply
          .status(401)
          .send({ success: false, code: 'UNAUTHENTICATED', message: 'Authentication required' });
      }

      // SECURITY: Derive operatorRole from auth context, not client body
      let operatorRole: string;
      const authenticatedUid = request.user?.uid;
      if (authenticatedUid) {
        // Firebase user — role from token claims
        operatorRole = request.user?.role || 'staff';
        if (authenticatedUid !== body.operatorId) {
          return reply.status(403).send({
            success: false,
            code: 'OPERATOR_MISMATCH',
            message: 'operatorId must match authenticated user',
          });
        }
      } else {
        // Scanner session — role is door_staff
        operatorRole = 'door_staff';
      }

      // Read the wallet to enforce venueId/eventId matching
      const walletDoc = await fastify.db.collection('cover_wallets').doc(body.walletId).get();
      if (!walletDoc.exists) {
        return reply
          .status(404)
          .send({ success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });
      }
      const walletData = walletDoc.data() as any;
      const codeVenueId = request.scannerCodeData?.venueId || null;
      const codeEventId = request.scannerCodeData?.eventId || null;
      if (codeVenueId && walletData.venueId && codeVenueId !== walletData.venueId) {
        return reply.status(403).send({
          success: false,
          code: 'VENUE_MISMATCH',
          message: "Scanner is not authorized for this wallet's venue",
        });
      }
      if (codeEventId && walletData.eventId && codeEventId !== walletData.eventId) {
        return reply.status(403).send({
          success: false,
          code: 'EVENT_MISMATCH',
          message: "Scanner is not authorized for this wallet's event",
        });
      }

      // Verify the event_code is of type 'charge' (or use scanner code from request)
      const codeDataFromRequest = request.scannerCodeData || null;
      let codeData: any = codeDataFromRequest;

      if (!codeData && body.eventCodeId) {
        const codeSnap = await fastify.db.collection('event_codes').doc(body.eventCodeId).get();
        if (!codeSnap.exists) {
          return reply
            .status(403)
            .send({ success: false, code: 'INVALID_CHARGE_CODE', message: 'Event code not found' });
        }
        codeData = codeSnap.data() as any;
      }

      if (!codeData) {
        return reply
          .status(403)
          .send({ success: false, code: 'INVALID_CHARGE_CODE', message: 'Event code not found' });
      }

      if (codeData.isRevoked) {
        return reply.status(403).send({
          success: false,
          code: 'CHARGE_CODE_REVOKED',
          message: 'Event charge code has been revoked',
        });
      }
      if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) {
        return reply.status(403).send({
          success: false,
          code: 'CHARGE_CODE_EXPIRED',
          message: 'Event charge code has expired',
        });
      }

      const scannerSessionId =
        body.scannerSessionId || request.scannerSessionId || request.scannerCodeId || body.deviceId;

      try {
        const result = await debitWallet({
          walletId: body.walletId,
          presetItemId: body.presetItemId,
          customAmountPaise: body.customAmountPaise,
          quantity: body.quantity,
          idempotencyKey: body.idempotencyKey,
          operatorId: body.operatorId,
          operatorName: body.operatorName || '',
          operatorRole,
          deviceId: body.deviceId,
          eventCodeId: body.eventCodeId,
          scannerSessionId,
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

        // SECURITY: Only increment velocity counter on successful debit
        // This prevents DoS via failed spam burning velocity slots
        const velocityKey = `cwv:${scannerSessionId}:${body.walletId}:${Math.floor(Date.now() / 60000)}`;
        const velCount = await fastify.redis.incr(velocityKey);
        if (velCount === 1) {
          await fastify.redis.expire(velocityKey, 90);
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
      preHandler: [fastify.validate({ body: ReverseBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof ReverseBody>;

      // SECURITY: Reverse requires Firebase auth. Scanner sessions cannot reverse.
      const authenticatedUid = request.user?.uid;
      if (!authenticatedUid) {
        return reply.status(401).send({
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Firebase authentication required for reversals',
        });
      }
      if (authenticatedUid !== body.operatorId) {
        return reply.status(403).send({
          success: false,
          code: 'OPERATOR_MISMATCH',
          message: 'operatorId must match authenticated user',
        });
      }

      // SECURITY: Derive role from Firebase token claims, not client body
      const operatorRole = request.user?.role || 'staff';

      try {
        const result = await reverseTransaction({
          walletId: body.walletId,
          transactionId: body.transactionId,
          reason: body.reason,
          supervisorPin: body.supervisorPin,
          operatorId: body.operatorId,
          operatorRole,
          deviceId: body.deviceId,
          eventCodeId: body.eventCodeId,
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
      preHandler: [fastify.validate({ body: TopUpBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof TopUpBody>;

      // SECURITY: Top-up requires Firebase auth
      const authenticatedUid = request.user?.uid;
      if (!authenticatedUid) {
        return reply.status(401).send({
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Firebase authentication required for top-up',
        });
      }
      if (authenticatedUid !== body.operatorId) {
        return reply.status(403).send({
          success: false,
          code: 'OPERATOR_MISMATCH',
          message: 'operatorId must match authenticated user',
        });
      }

      // SECURITY: Derive role from Firebase token claims, not client body
      const operatorRole = request.user?.role || 'staff';

      try {
        const result = await topUpWallet({
          walletId: body.walletId,
          amountPaise: body.amountPaise,
          reason: body.reason,
          idempotencyKey: body.idempotencyKey,
          operatorId: body.operatorId,
          operatorRole,
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
      preHandler: [fastify.validate({ body: FreezeBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof FreezeBody>;
      // Admin/manager only
      const role = request.user?.role;
      if (!['admin', 'manager', 'super'].includes(role)) {
        return reply.status(403).send({ success: false, code: 'INSUFFICIENT_ROLE' });
      }
      const result = await freezeWallet(body.walletId, body.reason, body.frozenBy);
      return result;
    },
  );

  // ── POST /api/v1/cover-charge/unfreeze ─────────────────────────────────

  fastify.post(
    '/unfreeze',
    {
      preHandler: [fastify.validate({ body: UnfreezeBody })],
    },
    async (request: any, reply) => {
      const body = request.body as z.infer<typeof UnfreezeBody>;
      const role = request.user?.role;
      if (!['admin', 'manager', 'super'].includes(role)) {
        return reply.status(403).send({ success: false, code: 'INSUFFICIENT_ROLE' });
      }
      const result = await unfreezeWallet(body.walletId, body.unfrozenBy);
      if (!result.success) return reply.status(422).send(result);
      return result;
    },
  );

  // ── GET /api/v1/cover-charge/wallet/:walletId ──────────────────────────

  fastify.get(
    '/wallet/:walletId',
    {
      preHandler: [fastify.validate({ params: WalletParams })],
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
      const isAdmin = request.user?.role === 'admin' || request.user?.admin === true;
      const isStaff =
        request.user?.role && ['staff', 'manager', 'host'].includes(request.user.role);

      if (!isOwner && !isAdmin && !isStaff) {
        return reply.status(403).send({ error: 'Forbidden' });
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

      if (!isAdmin && !isStaff && !showBalance) {
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
        transactions: isAdmin || isStaff || showHistory ? txns : [],
      };
    },
  );

  // ── GET /api/v1/cover-charge/wallet/:walletId/qr-jwt ──────────────────
  // Returns a short-lived signed JWT for the "Pay at Bar" QR code (60s expiry).
  // The scanner app decodes this JWT to get the walletId and verify it hasn't been screenshot-replayed.

  fastify.get(
    '/wallet/:walletId/qr-jwt',
    {
      preHandler: [fastify.validate({ params: WalletParams })],
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

      // Guests can only read their own wallet's QR
      if (
        wallet.userId !== authenticatedUid &&
        !['admin', 'staff', 'manager', 'host'].includes(request.user?.role)
      ) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const now = Math.floor(Date.now() / 1000);
      const qrSecret = getQrSecret();
      const jwt = signJwt(
        {
          iss: 'the-c1rcle',
          aud: 'c1rcle-scanner',
          typ: 'wallet',
          walletId,
          userId: wallet.userId,
          iat: now,
          nbf: now,
          exp: now + 60,
        },
        qrSecret,
      );

      return {
        jwt,
        expiresAt: new Date((now + 60) * 1000).toISOString(),
        walletId,
        currentBalancePaise: wallet.currentBalancePaise,
      };
    },
  );

  // ── GET /api/v1/cover-charge/reconciliation ────────────────────────────

  fastify.get(
    '/reconciliation',
    {
      preHandler: [fastify.validate({ querystring: ReconciliationQuery })],
    },
    async (request: any, reply) => {
      const { eventId, venueId } = request.query as any;

      const isAdmin = request.user?.admin === true || request.user?.role === 'admin';
      const isHost = request.user?.role === 'host' || request.user?.role === 'manager';
      if (!isAdmin && !isHost) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Check if a cached reconciliation already exists
      const existing = await fastify.db
        .collection('cover_wallet_reconciliations')
        .doc(eventId)
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
