import { FastifyInstance } from 'fastify';
import {
  verifyScanSignature,
  validateScannerDevice,
  recordScanAttempt,
} from '@c1rcle/core/scan-engine';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { resolvePartnerContext, canManageVenue } from '../../lib/partner-context';
import { z } from 'zod';
import {
  createScannerSession,
  getQrSecret,
  validateScannerSession,
  touchScannerSession,
  hashScannerSessionToken,
} from '../../lib/scannerSessions';
import {
  getScannerSummarySnapshot,
  recordScannerLiveEvent,
  updateScannerSummary,
  upsertScannerDeviceState,
} from '../../lib/scannerLiveState';
import { commitInventory } from '@c1rcle/core/inventory-engine';
import { writePartnerLedgerInTransaction } from '@c1rcle/core/partner-ledger-service';
import { publishTicketPurchaseSync } from '../../lib/ticketPurchaseSync';
import { createTicketQrForEntitlement } from '@c1rcle/core/ticket-checkout-wallet-service';
import { verifyCoverWalletQrToken } from '@c1rcle/core/cover-charge-engine';
import { getPermissionsForRole } from '../../lib/rbac-permissions';

const ScanBody = z
  .object({
    qrData: z.any().optional(),
    ticketPayload: z.any().optional(), // Legacy web proxy compat
    eventId: z.string(),
    eventCode: z.string().optional(),
    deviceId: z.string().min(16).max(128),
    venueId: z.string(),
    gate: z.string().optional(),
  })
  .strict();

const ConfirmCoupleScanBody = z
  .object({
    confirmationToken: z.string().min(32),
    eventId: z.string(),
    venueId: z.string(),
    deviceId: z.string().min(16).max(128),
    eventCode: z.string().optional(),
    gate: z.string().optional(),
  })
  .strict();

const HistoryQuery = z
  .object({
    eventId: z.string(),
    limit: z.string().optional(),
  })
  .strict();

const CodesQuery = z
  .object({
    eventId: z.string(),
  })
  .strict();

const CodesBody = z
  .object({
    eventId: z.string(),
    type: z.enum(['full', 'scan_only', 'charge']).optional().default('full'),
    gate: z.string().optional(),
    expiresAt: z.string().nullable().optional(),
    createdBy: z
      .union([z.string(), z.object({ uid: z.string(), name: z.string().optional() })])
      .optional(),
  })
  .strict();

const CodeIdParam = z.object({ id: z.string() }).strict();
const DeleteCodesBody = z.object({ revokedBy: z.string().optional() }).strict();

const AuthBody = z.object({ code: z.string() }).strict();
const StatsQuery = z
  .object({ code: z.string().optional(), eventId: z.string().optional() })
  .strict();
const GuestlistQuery = z.object({ eventId: z.string(), eventCode: z.string().optional() }).strict();

const StaffLoginBody = z
  .object({
    idToken: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().optional(),
  })
  .strict();
const StaffEventsQuery = z.object({ venueId: z.string(), date: z.string().optional() }).strict();
const StaffSessionBody = z
  .object({
    eventId: z.string(),
    venueId: z.string(),
    deviceId: z.string().min(16).max(128),
    deviceName: z.string().trim().min(1).max(120).optional(),
    gate: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const DoorEntryBody = z
  .object({
    eventCode: z.string(),
    eventId: z.string(),
    guestName: z.string().min(2),
    guestPhone: z.string().optional(),
    tierId: z.string(),
    tierName: z.string().optional(),
    entryType: z.string().optional(),
    quantity: z.number().int().min(1).max(20).optional(),
    // SECURITY: unitPrice and totalAmount are NOT accepted from the client.
    // Prices are always recalculated server-side from the event's ticket catalog.
    paymentMethod: z.string().optional(),
    gate: z.string().optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const DoorEntryQuery = z.object({ eventId: z.string(), eventCode: z.string().optional() }).strict();

const WalkInBody = z
  .object({
    eventCode: z.string(),
    eventId: z.string(),
    venueId: z.string(),
    guestName: z.string(),
    age: z.number().int().min(0).max(120).optional().default(0),
    contact: z.string().optional(),
    gender: z.string().optional(),
    totalGuests: z.number().int().min(1).max(100).optional().default(1),
    gate: z.string().optional(),
  })
  .strict();

const WalkInQuery = z
  .object({
    eventId: z.string(),
    eventCode: z.string(),
    limit: z.string().optional(),
  })
  .strict();

const DineInBody = z
  .object({
    eventCode: z.string(),
    eventId: z.string(),
    venueId: z.string(),
    guestName: z.string(),
    age: z.number().int().min(0).max(120).optional().default(0),
    contact: z.string().optional(),
    gender: z.string().optional().default('male'),
    totalGuests: z.number().int().min(1).max(100).optional().default(1),
    gate: z.string().optional(),
  })
  .strict();

const DineInQuery = z
  .object({
    eventId: z.string(),
    eventCode: z.string(),
    limit: z.string().optional(),
  })
  .strict();

const DeviceBody = z
  .object({
    deviceId: z.string(),
    venueId: z.string(),
    deviceName: z.string().optional(),
    eventId: z.string().optional(),
    eventCode: z.string().optional(),
    gate: z.string().optional(),
  })
  .strict();

const HeartbeatBody = z
  .object({
    deviceId: z.string(),
    eventId: z.string().optional(),
    eventCode: z.string().optional(),
    venueId: z.string().optional(),
    gate: z.string().optional(),
    deviceName: z.string().optional(),
  })
  .strict();

const EntitlementsParam = z.object({ id: z.string() }).strict();

const StaffDenyBody = z
  .object({
    qrData: z.string(),
    eventId: z.string(),
    eventCode: z.string(),
    gate: z.string().optional(),
    reason: z.string().optional(),
  })
  .strict();

const ManualCheckInBody = z
  .object({
    orderId: z.string(),
    eventCode: z.string(),
    eventId: z.string(),
  })
  .strict();

const CoverWalletQrBody = z
  .object({
    qrData: z.string().min(32),
    eventId: z.string().min(1),
    eventCode: z.string().min(1),
    venueId: z.string().min(1),
    deviceId: z.string().min(16).max(128),
    gate: z.string().optional(),
  })
  .strict();

const QR_SECRET = getQrSecret();

type ScannerAuthResult = {
  authorized: boolean;
  usingFirebase: boolean;
  operator?: {
    uid: string;
    name: string;
    role: string;
  };
  codeDoc?: any;
  codeData?: any;
  sessionRef?: any;
  sessionData?: any;
};

function sumOrderEntryCount(order: any): number {
  const ticketQty = Array.isArray(order?.tickets)
    ? order.tickets.reduce((sum: number, ticket: any) => sum + Number(ticket?.quantity || 0), 0)
    : 0;
  return ticketQty > 0 ? ticketQty : 1;
}

async function validateScannerAccess(
  fastify: FastifyInstance,
  request: any,
): Promise<ScannerAuthResult> {
  const authHeader =
    (request.headers.authorization as string) ||
    (request.headers['x-scanner-code'] as string) ||
    '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { authorized: false, usingFirebase: false };

  let decoded: any = null;
  try {
    decoded = await (fastify as any).auth.verifyIdToken(token, true);
  } catch {
    decoded = null;
  }

  if (decoded) {
    const eventId = request.body?.eventId || request.query?.eventId || null;
    const requestedVenueId =
      request.body?.venueId || request.query?.venueId || request.headers?.['x-venue-id'] || null;

    let event: Record<string, any> | null = null;
    if (eventId) {
      const eventDoc = await fastify.db.collection('events').doc(String(eventId)).get();
      if (!eventDoc.exists || eventDoc.data()?.isDeleted) {
        return { authorized: false, usingFirebase: true };
      }
      event = eventDoc.data() || {};
    }

    const venueId = String(event?.venueId || requestedVenueId || '');
    if (!venueId || (requestedVenueId && String(requestedVenueId) !== venueId)) {
      return { authorized: false, usingFirebase: true };
    }

    const staffSnapshot = await fastify.db
      .collection('venue_staff')
      .where('venueId', '==', venueId)
      .where('userId', '==', decoded.uid)
      .limit(2)
      .get();
    if (staffSnapshot.size !== 1) {
      return { authorized: false, usingFirebase: true };
    }

    const staffDoc = staffSnapshot.docs[0];
    const staff = staffDoc.data() || {};
    const role = String(staff.role || '').toUpperCase();
    const roleCanScan = ['OWNER', 'MANAGER', 'FLOOR_MANAGER', 'OPS', 'SECURITY', 'DOOR'].includes(
      role,
    );
    const active =
      staff.isActive === true &&
      staff.status !== 'removed' &&
      (staff.verified === true || staff.isVerified === true);
    const canScan = staff.permissions?.scanTickets === true || roleCanScan;
    if (!active || !canScan) {
      return { authorized: false, usingFirebase: true };
    }

    request.user = { ...(request.user || {}), ...decoded };
    const codeData = {
      code: 'STAFF',
      eventId: eventId ? String(eventId) : null,
      venueId,
      deviceId: request.body?.deviceId || null,
      type: 'scan_only',
      isStaffSession: true,
      userId: decoded.uid,
      role: role.toLowerCase(),
    };
    return {
      authorized: true,
      usingFirebase: true,
      operator: {
        uid: decoded.uid,
        name: String(staff.name || decoded.name || decoded.email || 'Venue Staff'),
        role: role.toLowerCase(),
      },
      codeDoc: staffDoc,
      codeData,
    };
  }

  const session = await validateScannerSession(fastify, token);
  if (!session.authorized) return { authorized: false, usingFirebase: false };

  request.scannerCodeId = session.codeDoc.id;
  request.scannerCodeData = session.codeData;
  request.scannerSessionId = session.sessionId;

  return {
    authorized: true,
    usingFirebase: false,
    operator: {
      uid: String(session.sessionData?.userId || session.sessionId),
      name: String(session.sessionData?.userName || 'Scanner'),
      role: String(session.sessionData?.role || 'door').toLowerCase(),
    },
    codeDoc: session.codeDoc,
    codeData: session.codeData,
    sessionRef: session.sessionRef,
    sessionData: session.sessionData,
  };
}

function scannerSessionError(reply: any) {
  return reply
    .status(401)
    .send({ error: 'Scanner session expired or invalid', result: 'session_expired' });
}

function matchesScannerContext(
  auth: ScannerAuthResult,
  {
    eventId,
    eventCode,
    venueId,
    deviceId,
  }: { eventId?: string; eventCode?: string; venueId?: string; deviceId?: string },
): boolean {
  if (!auth.codeData) return false;

  const normalizedCode = eventCode?.toUpperCase().trim();
  if (normalizedCode && auth.codeData.code !== normalizedCode) return false;
  if (eventId && auth.codeData.eventId !== eventId) return false;
  if (venueId && auth.codeData.venueId && auth.codeData.venueId !== venueId) return false;
  if (deviceId && auth.codeData.deviceId && auth.codeData.deviceId !== deviceId) return false;

  return true;
}

async function requireEventManagementAccess(
  fastify: FastifyInstance,
  request: any,
  eventId: string,
): Promise<{ allowed: true; event: any } | { allowed: false; status: number; error: string }> {
  if (!request.user?.uid) {
    return { allowed: false, status: 401, error: 'Authentication required' };
  }

  const eventDoc = await fastify.db.collection('events').doc(eventId).get();
  if (!eventDoc.exists) {
    return { allowed: false, status: 404, error: 'Event not found' };
  }

  const event = eventDoc.data() || {};
  const partnerId = event.venueId || event.hostId || event.partnerId;
  if (!partnerId) {
    return { allowed: false, status: 403, error: 'Event is missing partner context' };
  }

  try {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (ctx && (ctx.partnerId === partnerId || ctx.venueIds.includes(partnerId))) {
      return { allowed: true, event };
    }

    // Fallback to strict dashboard admin check if resolvePartnerContext didn't match
    await (fastify as any).verifyPartnerAccess(request, partnerId);
    return { allowed: true, event };
  } catch {
    return { allowed: false, status: 403, error: 'Forbidden' };
  }
}

function getOperatorDetails(scannedBy: any) {
  return {
    operatorUid: scannedBy?.uid || null,
    operatorName: scannedBy?.name || 'Scanner',
    operatorRole: scannedBy?.role || 'door_staff',
  };
}

export default async function scanRoutes(fastify: FastifyInstance) {
  // ── Cover Wallet QR Processing ───────────────────────────────────────────

  fastify.post(
    '/wallet-qr',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: CoverWalletQrBody })],
    },
    async (request: any, reply) => {
      const { qrData, eventId, eventCode, venueId, deviceId } = request.body as z.infer<
        typeof CoverWalletQrBody
      >;
      const auth = await validateScannerAccess(fastify, request);
      if (
        !auth.authorized ||
        auth.usingFirebase ||
        auth.codeData?.type !== 'charge' ||
        auth.sessionData?.codeType !== 'charge'
      ) {
        return reply.status(401).send({
          error: 'Charge session expired or invalid',
          result: 'session_expired',
        });
      }
      if (!matchesScannerContext(auth, { eventId, eventCode, venueId, deviceId })) {
        return reply.status(403).send({
          error: 'Charge session does not authorize this event, venue, or device',
          result: 'device_invalid',
        });
      }

      const device = await validateScannerDevice(fastify.db, deviceId, venueId);
      if (!device.valid) {
        return reply.status(403).send({
          error: device.error,
          result: 'device_invalid',
        });
      }

      const verified = verifyCoverWalletQrToken(qrData);
      if (!verified.valid || !verified.payload) {
        return reply.status(400).send({
          error: verified.error || 'Invalid Cover Wallet QR',
          code: verified.code || 'COVER_QR_INVALID',
          result: verified.code === 'COVER_QR_EXPIRED' ? 'expired' : 'invalid',
        });
      }
      const claims = verified.payload;
      if (String(claims.eventId) !== eventId || String(claims.venueId) !== venueId) {
        return reply.status(404).send({ error: 'Wallet not found', result: 'wrong_event' });
      }

      const walletDoc = await fastify.db
        .collection('cover_wallets')
        .doc(String(claims.walletId))
        .get();
      if (!walletDoc.exists) {
        return reply.status(404).send({ error: 'Wallet not found', result: 'invalid' });
      }
      const wallet = { id: walletDoc.id, ...walletDoc.data() } as any;
      const terminationMs = new Date(wallet.rules?.terminationTime || '').getTime();
      if (
        wallet.id !== claims.walletId ||
        wallet.orderId !== claims.orderId ||
        wallet.eventId !== claims.eventId ||
        wallet.venueId !== claims.venueId ||
        wallet.userId !== claims.ownerUserId
      ) {
        return reply.status(404).send({ error: 'Wallet not found', result: 'invalid' });
      }
      if (wallet.state !== 'ACTIVE') {
        return reply.status(wallet.state === 'FROZEN' ? 423 : 410).send({
          error: `Wallet is ${String(wallet.state).toLowerCase()}`,
          result: String(wallet.state).toLowerCase(),
        });
      }
      if (!Number.isFinite(terminationMs) || terminationMs <= Date.now()) {
        return reply.status(410).send({ error: 'Wallet has expired', result: 'expired' });
      }

      void touchScannerSession(auth.sessionRef);
      reply.header('Cache-Control', 'private, no-store');
      return {
        wallet: {
          id: wallet.id,
          orderId: wallet.orderId,
          eventId: wallet.eventId,
          venueId: wallet.venueId,
          currentBalancePaise: wallet.currentBalancePaise,
          openingBalancePaise: wallet.openingBalancePaise,
          totalDebitedPaise: wallet.totalDebitedPaise || 0,
          guestFirstName: wallet.guestFirstName || 'Guest',
          state: wallet.state,
          terminationTime: wallet.rules?.terminationTime || null,
          rules: {
            allowedPresetItems: wallet.rules?.allowedPresetItems || [],
            showBalanceToGuest: wallet.rules?.showBalanceToGuest ?? true,
            maxChargeAmountPaise: wallet.rules?.maxChargeAmountPaise || 0,
            minChargeAmountPaise: wallet.rules?.minChargeAmountPaise || 0,
          },
        },
      };
    },
  );

  // ── Core QR Scan Processing ───────────────────────────────────────────────

  /**
   * POST /api/v1/scan
   * Process a QR scan
   */
  fastify.post(
    '/',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: ScanBody })],
    },
    async (request: any, reply) => {
      const { eventId, eventCode, deviceId, venueId } = request.body;
      const qrData = request.body.qrData || request.body.ticketPayload;

      if (!qrData) return reply.status(400).send({ error: 'QR data is required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode, venueId, deviceId })) {
        return scannerSessionError(reply);
      }
      const scannedBy = auth.operator;

      let payload: any;
      try {
        // A real ticket QR always encodes the full signed payload
        // (JSON.stringify({ eid, ts, sig }) -- see generateEntitlementQR's
        // callers). There is no legitimate format where the scanner is
        // handed a bare "ENT-..." entitlement ID with no signature: that
        // string is also the entitlement's own document ID, so treating it
        // as scannable input let anyone who merely *knew* an entitlement ID
        // get the scanner to mint a fresh valid signature for it on the
        // spot, with no proof they ever held the real ticket. Bare IDs are
        // parsed as JSON like everything else, which correctly fails below
        // and is denied as invalid input.
        //
        // Transitional monitoring: detect bare ENT- strings reaching here
        // (previously the code auto-signed them). Log any sightings so we
        // can confirm no legitimate client depends on this behavior before
        // removing the monitoring path entirely. After 60 days of zero
        // sightings, this explicit check can be removed.
        if (typeof qrData === 'string' && qrData.trim().startsWith('ENT-')) {
          fastify.log.warn(
            { qrData: qrData.substring(0, 60), requestId: request.id },
            'Bare ENT- ID presented to scanner (no QR signature envelope) — rejecting',
          );
          return reply
            .status(400)
            .send({ error: 'Bare entitlement ID not accepted', result: 'invalid' });
        } else if (
          typeof qrData === 'string' &&
          (qrData.includes('.') || qrData.trim().startsWith('eyJ'))
        ) {
          const { verifyTicketQrJwt, previewTicketJwtScan, processTicketJwtScan } =
            // @ts-ignore — JS-only core module, no .d.ts yet
            await import('@c1rcle/core/ticket-checkout-wallet-service');
          const verified = verifyTicketQrJwt(qrData.trim());
          if (!verified?.valid || !verified.payload) {
            return reply.status(400).send({
              error: verified?.error || 'Expired or invalid ticket QR code',
              result: 'invalid',
            });
          }

          const jwtEventId = verified.payload.eventId;
          if (eventId && jwtEventId !== eventId) {
            return reply
              .status(400)
              .send({ error: 'Ticket is for a different event', result: 'wrong_event' });
          }
          const authorizedVenueId = venueId || auth.codeData?.venueId || null;
          const deviceCheck = await validateScannerDevice(fastify.db, deviceId, authorizedVenueId);
          if (!deviceCheck.valid) {
            return reply.status(403).send({ error: deviceCheck.error, result: 'device_invalid' });
          }

          const preview = await previewTicketJwtScan({
            db: fastify.db,
            token: qrData.trim(),
            eventId: eventId || jwtEventId,
            scannerId: scannedBy?.uid || request.scannerSessionId || 'scanner',
            deviceId,
          });
          if (!preview.success) {
            return reply.status(preview.result === 'wrong_event' ? 400 : 409).send({
              error: preview.error || 'Entry denied',
              result: preview.result || 'invalid',
            });
          }
          if (preview.requiresConfirmation) {
            return reply.send({
              success: true,
              result: 'confirmation_required',
              requiresConfirmation: true,
              confirmationToken: preview.confirmationToken,
              ticket: {
                orderId: preview.ticket.orderId,
                eventId: preview.ticket.eventId,
                ticketName: preview.ticket.tierName,
                quantity: 2,
                entryType: 'couple',
                userName: preview.ticket.userName || 'Guest',
              },
              message: 'Confirm that both guests are present',
            });
          }

          const jwtScan = await processTicketJwtScan({
            db: fastify.db,
            token: qrData.trim(),
            eventId: eventId || jwtEventId,
            scannerId: scannedBy?.uid || request.scannerSessionId || 'scanner',
            gate: request.body.gate || null,
          });
          const liveWhen = new Date().toISOString();
          await Promise.allSettled([
            recordScannerLiveEvent(
              fastify.db,
              {
                eventId: eventId || jwtEventId,
                venueId: authorizedVenueId,
                orderId: verified.payload.orderId,
                ticketId: verified.payload.jti || verified.payload.ticketId || verified.payload.sub,
                guestDisplayName: jwtScan.ticket?.userName || 'Guest',
                result: jwtScan.success ? 'valid' : jwtScan.result || 'invalid',
                source: 'scanner',
                scannedAt: liveWhen,
                deviceId: deviceId || null,
                operatorUid: scannedBy?.uid || null,
                operatorName: scannedBy?.name || 'Scanner',
                operatorRole: scannedBy?.role || 'door_staff',
                gate: request.body.gate || null,
                ticketTierId: jwtScan.ticket?.tierId || null,
                ticketTierName: jwtScan.ticket?.tierName || null,
              },
              jwtScan.success
                ? { totalScans: 1, checkedIn: 1 }
                : {
                    totalScans: 1,
                    ...(jwtScan.result === 'already_scanned'
                      ? { duplicateScans: 1 }
                      : { invalidScans: 1 }),
                  },
              jwtScan.success
                ? {
                    checkedInIncrement: 1,
                    entryType: jwtScan.ticket?.entryType || 'general',
                    entryTypeQuantity: 1,
                  }
                : undefined,
            ),
            auth.sessionRef ? touchScannerSession(auth.sessionRef, liveWhen) : Promise.resolve(),
          ]);

          if (!jwtScan.success) {
            return reply.status(jwtScan.result === 'not_found' ? 404 : 400).send({
              error: jwtScan.error || 'Entry denied',
              result: jwtScan.result || 'invalid',
            });
          }
          fastify.broadcast(
            {
              type: 'TICKET_CHECKED_IN',
              payload: {
                eventId: eventId || jwtEventId,
                ticketId: jwtScan.ticket.id,
                entitlementId: jwtScan.entitlementId,
                scanId: jwtScan.scanId,
                scannedAt: liveWhen,
              },
            },
            `event:${eventId || jwtEventId}`,
          );
          return {
            success: true,
            result: 'valid',
            scanId: jwtScan.scanId,
            ticket: {
              orderId: jwtScan.ticket.orderId,
              eventId: jwtScan.ticket.eventId,
              ticketName: jwtScan.ticket.tierName,
              quantity: 1,
              entryType: jwtScan.ticket.entryType || 'general',
              userName: jwtScan.ticket.userName || 'Guest',
            },
            scanCountUsed: jwtScan.scanCountUsed,
            scanCountAllowed: jwtScan.scanCountAllowed,
            message: 'Entry approved',
          };
        } else {
          fastify.log.warn(
            { requestId: request.id, eventId, deviceId },
            'Legacy non-JWT scanner payload rejected',
          );
          return reply.status(410).send({
            error: 'Legacy QR format is no longer accepted',
            code: 'LEGACY_QR_RETIRED',
            result: 'invalid',
            retryable: false,
          });
        }
      } catch (e) {
        return reply.status(400).send({ error: 'Invalid QR format', result: 'invalid' });
      }

      // ── Entitlement QR format (eid, ts, sig) ─────────────────────────────
      if (typeof payload.eid === 'string' && typeof payload.ts === 'number') {
        const { processEntryScan } = await import('@c1rcle/core/entitlement-engine');
        const gate = (request.body as any).gate;
        const result = await processEntryScan(
          payload,
          scannedBy?.uid || 'scanner',
          eventId || payload.eventId,
          { gate },
        );
        if (!result.success) {
          if (eventId || payload.eventId) {
            await recordScannerLiveEvent(
              fastify.db,
              {
                eventId: eventId || payload.eventId,
                venueId: venueId || auth.codeData?.venueId || null,
                guestDisplayName: result.ownerName || 'Guest',
                result: 'invalid',
                source: 'scanner',
                deviceId: deviceId || null,
                operatorUid: scannedBy?.uid || null,
                operatorName: scannedBy?.name || 'Scanner',
                operatorRole: scannedBy?.role || 'door_staff',
                gate: gate || null,
              },
              { totalScans: 1, invalidScans: 1 },
            );
          }
          return reply.status(400).send({
            error: result.message || 'Entry denied',
            result: result.result, // 'already_used' | 'expired' | 'invalid'
          });
        }
        if (eventId || payload.eventId) {
          const liveWhen = new Date().toISOString();
          await Promise.allSettled([
            recordScannerLiveEvent(
              fastify.db,
              {
                eventId: eventId || payload.eventId,
                venueId: venueId || auth.codeData?.venueId || null,
                ticketId: result.entitlementId,
                guestDisplayName: result.ownerName || 'Guest',
                result: 'valid',
                source: 'scanner',
                scannedAt: liveWhen,
                deviceId: deviceId || null,
                operatorUid: scannedBy?.uid || null,
                operatorName: scannedBy?.name || 'Scanner',
                operatorRole: scannedBy?.role || 'door_staff',
                gate: gate || null,
                ticketTierName: result.entitlementType || 'general',
              },
              { totalScans: 1, checkedIn: 1 },
              {
                checkedInIncrement: 1,
                entryType: result.entitlementType || 'general',
                entryTypeQuantity: 1,
              },
            ),
            deviceId && (venueId || auth.codeData?.venueId)
              ? upsertScannerDeviceState(
                  fastify.db,
                  {
                    eventId: eventId || payload.eventId,
                    venueId: venueId || auth.codeData?.venueId || null,
                    deviceId,
                    operatorUid: scannedBy?.uid || null,
                    operatorName: scannedBy?.name || 'Scanner',
                    operatorRole: scannedBy?.role || 'door_staff',
                    gate: gate || null,
                    lastScanAt: liveWhen,
                    lastScanResult: 'valid',
                    validScans: 1,
                  },
                  liveWhen,
                )
              : Promise.resolve(),
            auth.sessionRef ? touchScannerSession(auth.sessionRef, liveWhen) : Promise.resolve(),
          ]);
        }
        // Increment event checkIns stat (fire-and-forget)
        const entitlementEventId = eventId || payload.eventId;
        if (entitlementEventId) {
          fastify.db
            .collection('events')
            .doc(entitlementEventId)
            .update({
              'stats.checkIns': FieldValue.increment(1),
            })
            .catch(() => {});
        }
        const checkedInEventId = eventId || payload.eventId;
        if (checkedInEventId) {
          fastify.broadcast(
            {
              type: 'TICKET_CHECKED_IN',
              payload: {
                eventId: checkedInEventId,
                guestName: result.ownerName || 'Guest',
                ticketType: result.entitlementType || 'general',
                scanId: result.entitlementId,
                scannedAt: new Date().toISOString(),
              },
            },
            `event:${checkedInEventId}`,
          );
        }
        return {
          success: true,
          result: 'valid',
          scanId: result.entitlementId,
          ticket: {
            orderId: '',
            eventId: eventId || '',
            eventTitle: '',
            ticketName: 'Entry',
            quantity: 1,
            entryType: result.entitlementType || 'general',
            userName: result.ownerName || 'Guest',
            userEmail: '',
          },
          message: 'Entry approved',
        };
      }

      // ── Order-based QR format ─────────────────────────────────────────────
      const operator = getOperatorDetails(scannedBy);
      const liveEventId = eventId || payload.e;

      const isSignatureValid = verifyScanSignature(payload);
      if (!isSignatureValid) {
        await recordScanAttempt(fastify.db, {
          orderId: payload.o,
          eventId: eventId || payload.e,
          result: 'invalid',
          reason: 'Signature mismatch',
          scannedBy,
          deviceId,
        });
        if (liveEventId) {
          await recordScannerLiveEvent(
            fastify.db,
            {
              eventId: liveEventId,
              venueId: venueId || auth.codeData?.venueId || null,
              orderId: payload.o || null,
              ticketId: payload.t || null,
              guestDisplayName: 'Unknown Guest',
              result: 'invalid',
              source: 'scanner',
              deviceId: deviceId || null,
              operatorUid: operator.operatorUid,
              operatorName: operator.operatorName,
              operatorRole: operator.operatorRole,
              gate: request.body.gate || null,
            },
            { totalScans: 1, invalidScans: 1 },
          );
        }
        return reply.status(400).send({ error: 'Invalid signature', result: 'invalid' });
      }

      // H8: Explicit event mismatch check
      if (eventId && payload.e && payload.e !== eventId) {
        await recordScanAttempt(fastify.db, {
          orderId: payload.o,
          eventId: eventId,
          result: 'invalid',
          reason: 'wrong_event',
          scannedBy,
          deviceId,
        });
        await recordScannerLiveEvent(
          fastify.db,
          {
            eventId,
            venueId: venueId || auth.codeData?.venueId || null,
            orderId: payload.o || null,
            ticketId: payload.t || null,
            guestDisplayName: 'Wrong Event',
            result: 'invalid',
            source: 'scanner',
            deviceId: deviceId || null,
            operatorUid: operator.operatorUid,
            operatorName: operator.operatorName,
            operatorRole: operator.operatorRole,
            gate: request.body.gate || null,
          },
          { totalScans: 1, invalidScans: 1 },
        );
        return reply
          .status(400)
          .send({ error: 'Ticket is for a different event', result: 'wrong_event' });
      }

      const authorizedVenueId = venueId || auth.codeData?.venueId || null;
      let boundDeviceName: string | null = null;
      if (deviceId && authorizedVenueId) {
        const deviceCheck = await validateScannerDevice(fastify.db, deviceId, authorizedVenueId);
        if (!deviceCheck.valid) {
          if (liveEventId) {
            await recordScannerLiveEvent(
              fastify.db,
              {
                eventId: liveEventId,
                venueId: authorizedVenueId,
                orderId: payload.o || null,
                ticketId: payload.t || null,
                guestDisplayName: 'Unauthorized Device',
                result: 'invalid',
                source: 'scanner',
                deviceId,
                operatorUid: operator.operatorUid,
                operatorName: operator.operatorName,
                operatorRole: operator.operatorRole,
                gate: request.body.gate || null,
              },
              { totalScans: 1, invalidScans: 1 },
            );
          }
          return reply.status(403).send({ error: deviceCheck.error, result: 'device_invalid' });
        }
        boundDeviceName = deviceCheck.device?.deviceName || null;
        await deviceCheck.ref.update({ lastActiveAt: new Date().toISOString() });
      }

      const orderRef = fastify.db.collection('orders').doc(payload.o);
      const orderDoc = await orderRef.get();
      if (!orderDoc.exists) {
        if (liveEventId) {
          await recordScannerLiveEvent(
            fastify.db,
            {
              eventId: liveEventId,
              venueId: authorizedVenueId,
              orderId: payload.o || null,
              ticketId: payload.t || null,
              guestDisplayName: 'Unknown Guest',
              result: 'not_found',
              source: 'scanner',
              deviceId: deviceId || null,
              operatorUid: operator.operatorUid,
              operatorName: operator.operatorName,
              operatorRole: operator.operatorRole,
              gate: request.body.gate || null,
            },
            { totalScans: 1, invalidScans: 1 },
          );
        }
        return reply.status(404).send({ error: 'Order not found', result: 'not_found' });
      }
      const order = orderDoc.data();

      // C5: Firestore transaction — deterministic doc ID prevents race condition
      const scanDocId = `${payload.o}_${payload.t}`;
      const scanRef = fastify.db.collection('ticket_scans').doc(scanDocId);
      let alreadyScanned = false;
      let existingScanData: any = null;

      await fastify.db.runTransaction(async (tx: any) => {
        const existingDoc = await tx.get(scanRef);
        if (existingDoc.exists && existingDoc.data()?.result === 'valid') {
          alreadyScanned = true;
          existingScanData = existingDoc.data();
          return;
        }
        const now = new Date().toISOString();
        const totalTickets = Number(order?.ticketCount || order?.quantity || 1);
        const newCheckedInCount = (Number(order?.checkedInCount) || 0) + 1;
        const newStatus = newCheckedInCount >= totalTickets ? 'checked_in' : 'partially_checked_in';

        tx.set(scanRef, {
          orderId: payload.o,
          eventId: payload.e,
          ticketId: payload.t,
          userId: payload.u,
          quantity: payload.q,
          entryType: payload.et || 'general',
          result: 'valid',
          scannedBy,
          deviceId: deviceId || null,
          device: deviceId ? { id: deviceId, bound: true } : { id: null, bound: false },
          scannedAt: now,
          createdAt: now,
        });

        if (order?.status === 'confirmed' || order?.status === 'partially_checked_in') {
          tx.update(orderRef, {
            status: newStatus,
            checkedInCount: newCheckedInCount,
            checkedInAt: now,
            lastScanId: scanDocId,
          });
        }
      });

      if (alreadyScanned) {
        const liveWhen = new Date().toISOString();
        await Promise.allSettled([
          recordScannerLiveEvent(
            fastify.db,
            {
              eventId: payload.e,
              venueId: authorizedVenueId,
              orderId: payload.o,
              ticketId: payload.t,
              guestDisplayName: order?.userName || 'Guest',
              result: 'already_scanned',
              source: 'scanner',
              scannedAt: liveWhen,
              deviceId: deviceId || null,
              deviceName: boundDeviceName,
              operatorUid: operator.operatorUid,
              operatorName: operator.operatorName,
              operatorRole: operator.operatorRole,
              gate: request.body.gate || null,
              ticketTierName: payload.n || null,
            },
            { totalScans: 1, duplicateScans: 1 },
          ),
          deviceId && authorizedVenueId
            ? upsertScannerDeviceState(
                fastify.db,
                {
                  eventId: payload.e,
                  venueId: authorizedVenueId,
                  deviceId,
                  deviceName: boundDeviceName,
                  operatorUid: operator.operatorUid,
                  operatorName: operator.operatorName,
                  operatorRole: operator.operatorRole,
                  gate: request.body.gate || null,
                  lastScanAt: liveWhen,
                  lastScanResult: 'already_scanned',
                  duplicateScans: 1,
                },
                liveWhen,
              )
            : Promise.resolve(),
          auth.sessionRef ? touchScannerSession(auth.sessionRef, liveWhen) : Promise.resolve(),
        ]);
        return reply.status(400).send({
          error: 'Ticket already scanned',
          result: 'already_scanned',
          previousScan: {
            scannedAt: existingScanData.scannedAt,
            scannedBy: existingScanData.scannedBy,
          },
        });
      }

      const liveWhen = new Date().toISOString();
      await Promise.allSettled([
        recordScannerLiveEvent(
          fastify.db,
          {
            eventId: payload.e,
            venueId: authorizedVenueId,
            orderId: payload.o,
            ticketId: payload.t,
            guestDisplayName: order?.userName || 'Guest',
            result: 'valid',
            source: 'scanner',
            scannedAt: liveWhen,
            deviceId: deviceId || null,
            deviceName: boundDeviceName,
            operatorUid: operator.operatorUid,
            operatorName: operator.operatorName,
            operatorRole: operator.operatorRole,
            gate: request.body.gate || null,
            ticketTierId: payload.t || null,
            ticketTierName: payload.n || null,
          },
          { totalScans: 1, checkedIn: payload.q || 1 },
          {
            checkedInIncrement: payload.q || 1,
            entryType: payload.et || 'general',
            entryTypeQuantity: payload.q || 1,
          },
        ),
        deviceId && authorizedVenueId
          ? upsertScannerDeviceState(
              fastify.db,
              {
                eventId: payload.e,
                venueId: authorizedVenueId,
                deviceId,
                deviceName: boundDeviceName,
                operatorUid: operator.operatorUid,
                operatorName: operator.operatorName,
                operatorRole: operator.operatorRole,
                gate: request.body.gate || null,
                lastScanAt: liveWhen,
                lastScanResult: 'valid',
                validScans: payload.q || 1,
              },
              liveWhen,
            )
          : Promise.resolve(),
        auth.sessionRef ? touchScannerSession(auth.sessionRef, liveWhen) : Promise.resolve(),
      ]);

      // Increment event checkIns stat (fire-and-forget)
      if (payload.e) {
        fastify.db
          .collection('events')
          .doc(payload.e)
          .update({
            'stats.checkIns': FieldValue.increment(payload.q || 1),
          })
          .catch(() => {});
      }
      if (payload.e) {
        fastify.broadcast(
          {
            type: 'TICKET_CHECKED_IN',
            payload: {
              eventId: payload.e,
              guestName: order?.userName || 'Guest',
              ticketType: payload.et || 'general',
              scanId: scanDocId,
              scannedAt: new Date().toISOString(),
            },
          },
          `event:${payload.e}`,
        );
      }
      return {
        success: true,
        result: 'valid',
        scanId: scanDocId,
        ticket: {
          orderId: payload.o,
          eventId: payload.e,
          eventTitle: order?.eventTitle,
          ticketName: payload.n,
          userName: order?.userName,
          userEmail: order?.userEmail,
          quantity: payload.q,
          entryType: payload.et || 'general',
        },
        message: `Entry approved — ${order?.userName || 'Guest'}`,
      };
    },
  );

  fastify.post(
    '/confirm-couple',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: ConfirmCoupleScanBody })],
    },
    async (request: any, reply) => {
      const { confirmationToken, eventId, venueId, deviceId, eventCode, gate } = request.body;
      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized || !auth.operator) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, venueId, deviceId, eventCode })) {
        return scannerSessionError(reply);
      }
      const deviceCheck = await validateScannerDevice(fastify.db, deviceId, venueId);
      if (!deviceCheck.valid) {
        return reply.status(403).send({ error: deviceCheck.error, result: 'device_invalid' });
      }

      const { confirmCoupleTicketScan } =
        // @ts-ignore — JS-only core module, no .d.ts yet
        await import('@c1rcle/core/ticket-checkout-wallet-service');
      const result = await confirmCoupleTicketScan({
        db: fastify.db,
        confirmationToken,
        eventId,
        scannerId: auth.operator.uid,
        deviceId,
        gate: gate || null,
      });
      if (!result.success) {
        return reply.status(result.result === 'already_scanned' ? 409 : 400).send({
          error: result.error || 'Couple admission denied',
          result: result.result || 'invalid',
        });
      }

      const scannedAt = new Date().toISOString();
      await Promise.allSettled([
        recordScannerLiveEvent(
          fastify.db,
          {
            eventId,
            venueId,
            orderId: result.ticket.orderId,
            ticketId: result.ticket.id,
            guestDisplayName: result.ticket.userName || 'Guest',
            result: 'valid',
            source: 'scanner',
            scannedAt,
            deviceId,
            operatorUid: auth.operator.uid,
            operatorName: auth.operator.name,
            operatorRole: auth.operator.role,
            gate: gate || null,
            ticketTierId: result.ticket.tierId || null,
            ticketTierName: result.ticket.tierName || null,
          },
          { totalScans: 1, checkedIn: 2 },
          {
            checkedInIncrement: 2,
            entryType: 'couple',
            entryTypeQuantity: 2,
          },
        ),
        auth.sessionRef ? touchScannerSession(auth.sessionRef, scannedAt) : Promise.resolve(),
      ]);
      fastify.broadcast(
        {
          type: 'TICKET_CHECKED_IN',
          payload: {
            eventId,
            ticketId: result.ticket.id,
            entitlementId: result.entitlementId,
            scanId: result.scanId,
            quantity: 2,
            scannedAt,
          },
        },
        `event:${eventId}`,
      );
      return reply.send({
        success: true,
        result: 'valid',
        message: 'Couple entry approved',
        ticket: {
          orderId: result.ticket.orderId,
          eventId,
          userName: result.ticket.userName || 'Guest',
          ticketName: result.ticket.tierName || 'Couple Entry',
          quantity: 2,
          entryType: 'couple',
        },
        scanCountUsed: 2,
        scanCountAllowed: 2,
      });
    },
  );

  /**
   * GET /api/v1/scan/history?eventId=XXX
   */
  fastify.get(
    '/history',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: HistoryQuery })],
    },
    async (request: any, reply) => {
      const { eventId, limit = 100 } = request.query;
      if (!eventId) return reply.status(400).send({ error: 'eventId is required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      } else if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      } else if (!matchesScannerContext(auth, { eventId })) {
        return scannerSessionError(reply);
      }

      const snapshot = await fastify.db
        .collection('ticket_scans')
        .where('eventId', '==', eventId)
        .orderBy('scannedAt', 'desc')
        .limit(Number(limit))
        .get();
      return { scans: snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) };
    },
  );

  // ── Event Code Management ─────────────────────────────────────────────────

  /**
   * GET /api/v1/scan/codes?eventId=XXX
   */
  fastify.get(
    '/codes',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: CodesQuery })],
    },
    async (request: any, reply) => {
      const { eventId } = request.query;
      if (!eventId) return reply.status(400).send({ error: 'eventId required' });
      const access = await requireEventManagementAccess(fastify, request, eventId);
      if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      const snap = await fastify.db
        .collection('event_codes')
        .where('eventId', '==', eventId)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    },
  );

  /**
   * POST /api/v1/scan/codes
   */
  fastify.post(
    '/codes',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: CodesBody })],
    },
    async (request: any, reply) => {
      const { eventId, type = 'full', gate, expiresAt, createdBy } = request.body;
      if (!eventId) return reply.status(400).send({ error: 'eventId required' });
      const access = await requireEventManagementAccess(fastify, request, eventId);
      if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      const eventData = access.event;
      const code = `C1R-${randomBytes(3).toString('hex').toUpperCase()}`;
      const now = new Date().toISOString();
      const docRef = await fastify.db.collection('event_codes').add({
        code,
        eventId,
        venueId: eventData?.venueId || null,
        type,
        gate: gate || null,
        isRevoked: false,
        createdBy: createdBy || null,
        createdAt: now,
        expiresAt: expiresAt || null,
        usageCount: 0,
        lastUsedAt: null,
        stats: { scansCount: 0, doorEntriesCount: 0, doorRevenue: 0 },
      });
      return { success: true, code: { id: docRef.id, code, eventId } };
    },
  );

  /**
   * DELETE /api/v1/scan/codes/:id
   */
  fastify.delete(
    '/codes/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: CodeIdParam, body: DeleteCodesBody })],
    },
    async (request: any, reply) => {
      const { id } = request.params as any;
      const { revokedBy } = (request.body as any) || {};
      const codeDoc = await fastify.db.collection('event_codes').doc(id).get();
      if (!codeDoc.exists) return reply.status(404).send({ error: 'Code not found' });
      const access = await requireEventManagementAccess(fastify, request, codeDoc.data()?.eventId);
      if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      await fastify.db
        .collection('event_codes')
        .doc(id)
        .update({
          isRevoked: true,
          revokedAt: new Date().toISOString(),
          revokedBy: revokedBy || null,
        });
      return { success: true };
    },
  );

  // ── Scanner App Auth (Code Validation) ───────────────────────────────────

  /**
   * POST /api/v1/scan/auth
   * Validate event code and return event context for scanner app
   */
  fastify.post(
    '/auth',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: AuthBody })],
    },
    async (request: any, reply) => {
      const { code } = request.body as any;
      if (!code) return reply.status(400).send({ valid: false, error: 'code required' });

      // M3: Per-IP rate limiting — 10 attempts/min. Scanner authentication
      // fails closed when the shared limiter is unavailable so event codes
      // cannot be brute-forced during an infrastructure incident.
      try {
        const ip = request.ip;
        const rateLimitKey = `scan:auth:${ip}`;
        const attempts = await fastify.redis.incr(rateLimitKey);
        if (attempts === 1) await fastify.redis.expire(rateLimitKey, 60);
        if (attempts > 10) {
          return reply
            .status(429)
            .send({ valid: false, error: 'Too many attempts. Try again in a minute.' });
        }
      } catch (error) {
        fastify.log.error({ error }, 'Redis unavailable — denying /scan/auth');
        return reply.status(503).send({
          valid: false,
          code: 'SCANNER_AUTH_RATE_LIMIT_UNAVAILABLE',
          error: 'Scanner authentication is temporarily unavailable.',
          retryable: true,
        });
      }

      const normalizedCode = code.toUpperCase().trim();
      const codeSnap = await fastify.db
        .collection('event_codes')
        .where('code', '==', normalizedCode)
        .limit(1)
        .get();
      if (codeSnap.empty)
        return reply.status(404).send({ valid: false, error: 'Invalid event code' });

      const codeDoc = codeSnap.docs[0];
      const codeData = codeDoc.data();
      if (codeData.isRevoked)
        return reply.status(403).send({ valid: false, error: 'Code revoked' });
      if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date())
        return reply.status(403).send({ valid: false, error: 'Code expired' });

      const eventDoc = await fastify.db.collection('events').doc(codeData.eventId).get();
      if (!eventDoc.exists)
        return reply.status(404).send({ valid: false, error: 'Event not found' });
      const event = eventDoc.data();

      const session = await createScannerSession(fastify, codeDoc.id, codeData as any);
      if (!session.ok) {
        return reply.status(403).send({ valid: false, error: session.error });
      }

      const now = new Date().toISOString();
      await codeDoc.ref.update({
        lastUsedAt: now,
        usageCount: (codeData.usageCount || 0) + 1,
        lastSessionId: session.sessionId,
      });

      const summary = await getScannerSummarySnapshot(fastify.db, codeData.eventId);

      // H7: Try ticketing subcollection first, fall back to tickets array
      let tiers: any[] = [];
      const tierSnap = await fastify.db
        .collection('events')
        .doc(codeData.eventId)
        .collection('ticketing')
        .get();
      if (!tierSnap.empty) {
        tiers = tierSnap.docs.map((d: any) => {
          const t = d.data();
          return {
            id: d.id,
            name: t.name,
            price: t.price || 0,
            entryType: t.entryType || 'general',
            available: (t.remaining ?? t.quantity ?? 0) > 0,
          };
        });
      } else {
        tiers = (event?.tickets || []).map((t: any) => ({
          id: t.id || t.ticketId,
          name: t.name,
          price: t.price || 0,
          entryType: t.entryType || 'general',
          available: (t.remaining || t.quantity || 0) > 0,
        }));
      }

      return {
        valid: true,
        code: normalizedCode,
        codeId: codeDoc.id,
        sessionToken: session.sessionToken,
        sessionExpiresAt: session.sessionExpiresAt,
        event: {
          id: eventDoc.id,
          title: event?.title,
          venue: event?.venueName,
          venueId: event?.venueId,
          date: event?.date,
          startTime: event?.startTime,
          endTime: event?.endTime,
          capacity: event?.capacity || 500,
          imageUrl: event?.coverImage,
        },
        permissions: {
          canScan: codeData.type === 'full' || codeData.type === 'scan_only',
          canDoorEntry: codeData.type === 'full',
          canWalkIn: codeData.type === 'full' || codeData.type === 'scan_only',
          canCharge: codeData.type === 'charge',
        },
        tiers,
        gate: codeData.gate || null,
        stats: {
          totalEntered: summary.totalEntered,
          prebooked: summary.checkedIn,
          doorEntries: summary.doorEntries,
          doorRevenue: summary.doorRevenue,
          walkIns: summary.walkIns,
        },
      };
    },
  );

  /**
   * GET /api/v1/scan/auth?eventId=XXX – list codes for an event
   */
  fastify.get(
    '/auth',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: CodesQuery })],
    },
    async (request: any, reply) => {
      const { eventId } = request.query as any;
      if (!eventId) return reply.status(400).send({ error: 'eventId required' });
      const access = await requireEventManagementAccess(fastify, request, eventId);
      if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      const snap = await fastify.db
        .collection('event_codes')
        .where('eventId', '==', eventId)
        .orderBy('createdAt', 'desc')
        .get();
      return { codes: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    },
  );

  // ── Real-time Scan Stats ──────────────────────────────────────────────────

  /**
   * GET /api/v1/scan/stats?code=C1R-XXXXXX
   */
  fastify.get(
    '/stats',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: StatsQuery })],
    },
    async (request: any, reply) => {
      const { code, eventId } = request.query as any;
      if (!code && !eventId) {
        return reply.status(400).send({ error: 'code or eventId required' });
      }

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);

      let targetEventId = eventId;
      let normalizedCode = code?.toUpperCase().trim();

      if (!targetEventId && normalizedCode) {
        if (!matchesScannerContext(auth, { eventCode: normalizedCode })) {
          return scannerSessionError(reply);
        }
        const codeSnap = await fastify.db
          .collection('event_codes')
          .where('code', '==', normalizedCode)
          .limit(1)
          .get();
        if (codeSnap.empty) return reply.status(404).send({ error: 'Invalid event code' });
        const codeData = codeSnap.docs[0].data();
        if (codeData.isRevoked) return reply.status(403).send({ error: 'Code revoked' });
        targetEventId = codeData.eventId;
      }

      if (!targetEventId) {
        return reply.status(400).send({ error: 'Unable to resolve event context' });
      }

      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, targetEventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }

      const cacheKey = `scan:stats:${targetEventId}`;
      const cached = await fastify.cache.get('scan:stats', cacheKey);
      if (cached) return cached;

      const summary = await getScannerSummarySnapshot(fastify.db, targetEventId);
      const result = {
        totalEntered: summary.totalEntered,
        prebooked: summary.checkedIn,
        doorEntries: summary.doorEntries,
        doorRevenue: summary.doorRevenue,
        walkIns: summary.walkIns,
        byEntryType: summary.entryTypeCounts,
      };
      await fastify.cache.set('scan:stats', cacheKey, result, 20); // 20s TTL
      if (auth.sessionRef) {
        void touchScannerSession(auth.sessionRef);
      }
      return result;
    },
  );

  // ── Guest List ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/scan/guestlist?eventId=XXX
   */
  fastify.get(
    '/guestlist',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: GuestlistQuery })],
    },
    async (request: any, reply) => {
      const { eventId, eventCode } = request.query as any;
      if (!eventId) return reply.status(400).send({ error: 'eventId required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }

      const [ordersSnap, rsvpsSnap, entitlementsSnap] = await Promise.all([
        fastify.db
          .collection('orders')
          .where('eventId', '==', eventId)
          .where('status', 'in', ['confirmed', 'paid', 'checked_in'])
          .get(),
        fastify.db
          .collection('rsvp_orders')
          .where('eventId', '==', eventId)
          .where('status', '==', 'confirmed')
          .get(),
        fastify.db
          .collection('entitlements')
          .where('eventId', '==', eventId)
          .get()
          .catch(() => ({ docs: [] })),
      ]);

      const scannedIds = new Set<string>();
      const scanTimes = new Map<string, string>();

      entitlementsSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        if (
          data.orderId &&
          (data.state === 'CONSUMED' || (data.scanCountUsed && data.scanCountUsed > 0))
        ) {
          scannedIds.add(data.orderId);
          if (data.consumedAt) {
            scanTimes.set(data.orderId, data.consumedAt);
          } else {
            scanTimes.set(data.orderId, new Date().toISOString());
          }
        }
      });

      const orderDocs = [
        ...ordersSnap.docs.map((d: any) => ({ doc: d, isRSVP: false })),
        ...rsvpsSnap.docs.map((d: any) => ({ doc: d, isRSVP: true })),
      ];

      const guests = orderDocs.map((item: any) => {
        const doc = item.doc;
        const order = doc.data();
        const ticket = order.tickets?.[0] || {};
        const entered =
          scannedIds.has(doc.id) || order.status === 'checked_in' || !!order.checkedInAt;
        return {
          id: doc.id,
          name: order.buyerName || order.userName || order.customerName || order.name || 'Guest',
          ticketType: ticket.name || (item.isRSVP ? 'RSVP' : 'Entry'),
          entryType: ticket.entryType || (item.isRSVP ? 'rsvp' : 'general'),
          quantity: ticket.quantity || 1,
          source: item.isRSVP ? 'online' : order.source || 'online',
          status: entered ? 'entered' : 'not_entered',
          enteredAt: scanTimes.get(doc.id) || order.checkedInAt || null,
        };
      });
      guests.sort((a: any, b: any) =>
        a.status !== b.status
          ? a.status === 'not_entered'
            ? -1
            : 1
          : a.name.localeCompare(b.name),
      );
      return { guests };
    },
  );

  // ── Door Entry (Walk-up Sales) ────────────────────────────────────────────

  /**
   * POST /api/v1/scan/door-entry
   */
  fastify.post(
    '/door-entry',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: DoorEntryBody })],
    },
    async (request: any, reply) => {
      const {
        eventCode,
        eventId,
        guestName,
        guestPhone,
        tierId,
        tierName: clientTierName,
        entryType,
        quantity = 1,
        paymentMethod = 'cash',
        gate,
        idempotencyKey,
      } = request.body as any;
      if (!eventCode || !eventId || !guestName || !tierId)
        return reply.status(400).send({ success: false, error: 'Missing required fields' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed)
          return reply.status(access.status).send({ success: false, error: access.error });
      }

      const [codeSnap, eventDoc] = await Promise.all([
        fastify.db
          .collection('event_codes')
          .where('code', '==', eventCode.toUpperCase())
          .limit(1)
          .get(),
        fastify.db.collection('events').doc(eventId).get(),
      ]);
      if (codeSnap.empty)
        return reply.status(403).send({ success: false, error: 'Invalid event code' });
      const codeData = codeSnap.docs[0].data();
      if (codeData.type !== 'full')
        return reply
          .status(403)
          .send({ success: false, error: 'Door entry not permitted for this code' });

      // SECURITY: Price is always recalculated server-side from the event's ticket catalog.
      // unitPrice and totalAmount from the client are never trusted.
      const initialEvent = eventDoc.exists ? ((eventDoc.data() as any) ?? {}) : {};
      const eventTickets: any[] = initialEvent.ticketCatalog?.tiers || initialEvent.tickets || [];
      const tierConfig = eventTickets.find((t: any) => t.id === tierId || t.tierId === tierId);
      const tierName = tierConfig?.name || clientTierName || tierId;
      const unitPrice = Number(tierConfig?.price ?? tierConfig?.unitPrice ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return reply.status(409).send({
          success: false,
          error: 'Authoritative ticket price is invalid',
        });
      }
      const totalAmount = unitPrice * quantity;

      const now = new Date().toISOString();
      const orderId = `DOOR-${idempotencyKey.replace(/-/g, '').substring(0, 16).toUpperCase()}`;
      const anonymousUserId = `door_guest_${orderId.toLowerCase()}`;
      const orderRef = fastify.db.collection('orders').doc(orderId);
      const eventRef = fastify.db.collection('events').doc(eventId);
      const markerRef = fastify.db.collection('partner_ledger_idempotency').doc(orderId);
      const paymentRef = fastify.db.collection('payments').doc(`door_${orderId}`);
      const outboxRef = fastify.db
        .collection('domain_event_outbox')
        .doc(`ticket-purchase-${orderId}`);
      const ticketIds = Array.from({ length: quantity }, (_, index) =>
        `TKT-${orderId}-${tierId}-${index + 1}`.toUpperCase(),
      );
      const entitlementIds = ticketIds.map((_, index) =>
        `ENT-${orderId}-${tierId}-${index + 1}`.toUpperCase(),
      );
      let alreadyFinalized = false;

      await fastify.db.runTransaction(async (tx: any) => {
        const [
          existingOrder,
          eventSnapshot,
          markerSnapshot,
          paymentSnapshot,
          outboxSnapshot,
          ticketSnapshots,
          entitlementSnapshots,
        ] = await Promise.all([
          tx.get(orderRef),
          tx.get(eventRef),
          tx.get(markerRef),
          tx.get(paymentRef),
          tx.get(outboxRef),
          Promise.all(
            ticketIds.map((ticketDocumentId) =>
              tx.get(fastify.db.collection('tickets').doc(ticketDocumentId)),
            ),
          ),
          Promise.all(
            entitlementIds.map((entitlementId) =>
              tx.get(fastify.db.collection('entitlements').doc(entitlementId)),
            ),
          ),
        ]);

        if (existingOrder.exists) {
          const existing = existingOrder.data() as any;
          const complete =
            existing.status === 'confirmed' &&
            markerSnapshot.exists &&
            paymentSnapshot.exists &&
            ticketSnapshots.every((snapshot: any) => snapshot.exists) &&
            entitlementSnapshots.every((snapshot: any) => snapshot.exists);
          if (!complete || Number(existing.totalPaise || 0) !== Math.round(totalAmount * 100)) {
            throw Object.assign(new Error('Door sale idempotency conflict'), {
              code: 'LEDGER_IDEMPOTENCY_CONFLICT',
            });
          }
          alreadyFinalized = true;
          return;
        }
        if (!eventSnapshot.exists) {
          throw Object.assign(new Error('Event not found'), { code: 'NOT_FOUND' });
        }
        const event = { id: eventSnapshot.id, ...eventSnapshot.data() } as any;
        const authoritativeTiers = event.ticketCatalog?.tiers || event.tickets || [];
        const authoritativeTier = authoritativeTiers.find(
          (candidate: any) => candidate.id === tierId || candidate.tierId === tierId,
        );
        const remaining = Number(
          authoritativeTier?.remaining ??
            authoritativeTier?.inventory?.remainingQuantity ??
            authoritativeTier?.quantity ??
            0,
        );
        if (!authoritativeTier || remaining < quantity) {
          throw Object.assign(new Error('Door ticket inventory is unavailable'), {
            code: 'INVENTORY_CONFLICT',
          });
        }

        const hostId = event.hostId || event.creatorId || event.venueId || null;
        const venueId = event.venueId || codeData.venueId || null;
        if (!hostId) {
          throw Object.assign(new Error('Door sale is missing partner attribution'), {
            code: 'ORDER_ATTRIBUTION_MISSING',
          });
        }
        const totalPaise = Math.round(totalAmount * 100);
        const venueSharePaise = venueId ? totalPaise : 0;
        const hostPayoutPaise = venueId ? 0 : totalPaise;
        const order = {
          id: orderId,
          eventId,
          eventName: event.title || null,
          hostId,
          venueId,
          promoterId: null,
          promoterLinkId: null,
          sourceChannel: 'door',
          source: 'door',
          status: 'confirmed',
          userName: guestName,
          userPhone: guestPhone || null,
          userId: anonymousUserId,
          ticketCount: quantity,
          tickets: [
            {
              ticketId: tierId,
              tierId,
              name: tierName,
              entryType: entryType || 'general',
              quantity,
              price: unitPrice,
              total: totalAmount,
            },
          ],
          subtotalPaise: totalPaise,
          discountPaise: 0,
          taxPaise: 0,
          platformFeePaise: 0,
          venueSharePaise,
          promoterCommissionPaise: 0,
          hostPayoutPaise,
          totalPaise,
          subtotal: totalAmount,
          totalAmount,
          currency: 'INR',
          financialSchemaVersion: 1,
          splitRuleSnapshot: {
            schemaVersion: 1,
            source: venueId ? 'door_collection_venue' : 'door_collection_host',
            platformFeePaise: 0,
            venueSharePaise,
            promoterCommissionPaise: 0,
            hostPayoutPaise,
          },
          paymentMethod,
          paymentStatus: 'collected',
          paymentId: `door_${orderId}`,
          ledgerMarkerId: orderId,
          ticketIds,
          entitlementIds,
          doorEntryMeta: {
            eventCode: eventCode.toUpperCase(),
            gate: gate || null,
            collectedAt: now,
          },
          createdAt: now,
          confirmedAt: now,
          checkedInAt: now,
          updatedAt: now,
        };

        await commitInventory(tx, {
          db: fastify.db,
          event,
          items: order.tickets,
          reservationId: null,
        });
        const ledger = writePartnerLedgerInTransaction({
          db: fastify.db,
          transaction: tx,
          order,
          event,
          paymentId: `door_${orderId}`,
          createdAt: now,
          markerSnapshot,
        });
        tx.create(orderRef, order);
        tx.create(paymentRef, {
          orderId,
          eventId,
          userId: anonymousUserId,
          provider: 'door',
          method: paymentMethod,
          amountPaise: totalPaise,
          currency: 'INR',
          status: 'verified',
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        ticketIds.forEach((ticketDocumentId, index) => {
          const ticketId = `${orderId}-${tierId}-${index + 1}`;
          tx.create(fastify.db.collection('tickets').doc(ticketDocumentId), {
            id: ticketDocumentId,
            ticketId,
            orderId,
            eventId,
            userId: anonymousUserId,
            hostId,
            venueId,
            promoterId: null,
            tierId,
            tierName,
            slotIndex: index + 1,
            quantity: 1,
            originalQuantity: quantity,
            entryType: entryType || 'general',
            status: 'used',
            qrMode: 'door_direct',
            scanCountAllowed: 1,
            scanCountUsed: 1,
            createdAt: now,
            usedAt: now,
            updatedAt: now,
          });
          tx.create(fastify.db.collection('entitlements').doc(entitlementIds[index]), {
            id: entitlementIds[index],
            entitlementId: entitlementIds[index],
            ticketDocumentId,
            ticketId,
            eventId,
            orderId,
            ownerUserId: anonymousUserId,
            hostId,
            venueId,
            promoterId: null,
            ticketType: 'paid',
            scanCountAllowed: 1,
            scanCountUsed: 1,
            state: 'CONSUMED',
            issuedAt: now,
            consumedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          tx.create(fastify.db.collection('ticket_scans').doc(`${ticketDocumentId}_door_scan`), {
            orderId,
            eventId,
            ticketId,
            ticketDocumentId,
            entitlementId: entitlementIds[index],
            userId: anonymousUserId,
            quantity: 1,
            entryType: entryType || 'general',
            result: 'valid',
            source: 'door',
            scannedBy: {
              uid: `scanner_${eventCode}`,
              name: 'Door Entry',
              role: 'door_staff',
            },
            device: { id: gate || 'door', bound: false },
            scannedAt: now,
            createdAt: now,
          });
        });
        if (!outboxSnapshot.exists) {
          tx.create(outboxRef, {
            id: outboxRef.id,
            type: 'ticket.purchase.confirmed',
            aggregateId: orderId,
            orderId,
            eventId,
            hostId,
            venueId,
            promoterId: null,
            ticketCount: quantity,
            ticketIds,
            entitlementIds,
            ledgerMarkerId: ledger.markerId,
            source: 'door',
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
        tx.update(codeSnap.docs[0].ref, {
          'stats.doorEntriesCount': FieldValue.increment(quantity),
          'stats.doorRevenuePaise': FieldValue.increment(totalPaise),
          updatedAt: now,
        });
      });

      const syncResult = {
        orderId,
        eventId,
        hostId: (eventDoc.data() as any)?.hostId || (eventDoc.data() as any)?.creatorId || null,
        venueId: (eventDoc.data() as any)?.venueId || codeData.venueId || null,
        promoterId: null,
        ticketIds,
        entitlementIds,
        ledgerMarkerId: orderId,
        alreadyFinalized,
      };
      await publishTicketPurchaseSync(fastify, syncResult);

      const liveWhen = new Date().toISOString();
      await Promise.allSettled([
        recordScannerLiveEvent(
          fastify.db,
          {
            eventId,
            venueId: codeData.venueId || null,
            orderId,
            ticketId: ticketIds[0],
            guestDisplayName: guestName.trim(),
            result: 'valid',
            source: 'scanner',
            scannedAt: liveWhen,
            deviceId: gate || 'door',
            deviceName: 'Door Entry',
            operatorUid: `scanner_${eventCode}`,
            operatorName: 'Door Entry',
            operatorRole: 'door_staff',
            gate: gate || null,
            ticketTierId: tierId,
            ticketTierName: tierName || null,
          },
          { doorEntries: quantity, doorRevenue: totalAmount },
          {
            checkedInIncrement: quantity,
            entryType: entryType || 'general',
            entryTypeQuantity: quantity,
          },
        ),
        auth.sessionRef ? touchScannerSession(auth.sessionRef, liveWhen) : Promise.resolve(),
      ]);

      return {
        success: true,
        orderId,
        alreadyFinalized,
        ticketIds,
        entitlementIds,
        ledgerMarkerId: orderId,
        status: 'entered',
        qrData: null,
      };
    },
  );

  /**
   * GET /api/v1/scan/door-entry?eventId=XXX
   */
  fastify.get(
    '/door-entry',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: DoorEntryQuery })],
    },
    async (request: any, reply) => {
      const { eventId, eventCode } = request.query as any;
      if (!eventId) return reply.status(400).send({ error: 'eventId required' });
      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }
      const snap = await fastify.db
        .collection('orders')
        .where('eventId', '==', eventId)
        .where('source', '==', 'door')
        .get();
      const byPaymentMethod: Record<string, number> = {};
      let doorRevenue = 0;
      snap.docs.forEach((d: any) => {
        doorRevenue += d.data().total || 0;
        const m = d.data().paymentMethod || 'cash';
        byPaymentMethod[m] = (byPaymentMethod[m] || 0) + (d.data().total || 0);
      });
      const doorEntries = snap.docs.reduce(
        (sum: number, d: any) => sum + sumOrderEntryCount(d.data()),
        0,
      );
      return { doorEntries, doorRevenue, byPaymentMethod };
    },
  );

  // ── Walk-in Entries ───────────────────────────────────────────────────────

  /**
   * POST /api/v1/scan/walk-in
   * Log a walk-in guest (arrives without a ticket)
   */
  fastify.post(
    '/walk-in',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: WalkInBody })],
    },
    async (request: any, reply) => {
      const { eventCode, eventId, venueId, guestName, age, contact, gender, totalGuests, gate } =
        request.body as any;
      if (!eventCode || !eventId || !venueId || !guestName?.trim())
        return reply.status(400).send({ success: false, error: 'Missing required fields' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode, venueId })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed)
          return reply.status(access.status).send({ success: false, error: access.error });
      }

      // Security check is already handled by validateScannerAccess and matchesScannerContext

      const { randomUUID } = await import('node:crypto');
      const id = randomUUID();
      const now = new Date().toISOString();
      const phone = contact?.trim() || '';

      const entry = {
        id,
        idempotencyKey: id,
        eventId,
        venueId,
        guestName: guestName.trim(),
        age: age ?? null,
        gender: gender || null,
        totalGuests: totalGuests || 1,
        contact: phone || '',
        category: 'walkin',
        paymentMode: 'cash',
        source: 'scanner',
        status: 'active',
        addedAt: now,
        addedBy: `scanner_${eventCode.toUpperCase()}`,
        addedByName: 'Scanner App',
      };

      await fastify.db.collection('door_sales').doc(id).set(entry);

      const liveWhen = new Date().toISOString();
      await Promise.allSettled([
        recordScannerLiveEvent(
          fastify.db,
          {
            eventId,
            venueId,
            guestId: id,
            guestDisplayName: guestName.trim(),
            result: 'valid',
            source: 'scanner',
            scannedAt: liveWhen,
            deviceId: gate || null,
            deviceName: 'Walk-in',
            operatorUid: `scanner_${eventCode.toUpperCase()}`,
            operatorName: 'Scanner App',
            operatorRole: 'door_staff',
            gate: gate || null,
          },
          { walkIns: 1 },
          { checkedInIncrement: 1 },
        ),
        auth.sessionRef ? touchScannerSession(auth.sessionRef, liveWhen) : Promise.resolve(),
      ]);

      return { success: true, walkInId: id };
    },
  );

  /**
   * GET /api/v1/scan/walk-in?eventId=&eventCode=
   * List recent walk-ins for the event (scanner app pull-to-refresh)
   */
  fastify.get(
    '/walk-in',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: WalkInQuery })],
    },
    async (request: any, reply) => {
      const { eventId, eventCode, limit = '50' } = request.query as any;
      if (!eventId || !eventCode)
        return reply.status(400).send({ error: 'eventId and eventCode are required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }

      // Security check is already handled by validateScannerAccess and matchesScannerContext

      const snap = await fastify.db
        .collection('door_sales')
        .where('eventId', '==', eventId)
        .where('category', '==', 'walkin')
        .where('status', '==', 'active')
        .orderBy('addedAt', 'desc')
        .limit(Number(limit))
        .get();

      return {
        walkIns: snap.docs.map((d: any) => ({ id: d.id, ...d.data(), phoneFull: undefined })),
      };
    },
  );

  /**
   * POST /api/v1/scan/dine-in
   * Log a dine-in guest (adds to active dinein_sessions)
   */
  fastify.post(
    '/dine-in',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: DineInBody })],
    },
    async (request: any, reply) => {
      const { eventCode, eventId, venueId, guestName, totalGuests, contact, gender, age, gate } =
        request.body as any;
      if (!eventCode || !eventId || !venueId || !guestName?.trim())
        return reply.status(400).send({ success: false, error: 'Missing required fields' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode, venueId })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed)
          return reply.status(access.status).send({ success: false, error: access.error });
      }

      // Security check is already handled by validateScannerAccess and matchesScannerContext

      const { randomUUID } = await import('node:crypto');
      const id = randomUUID();
      const now = new Date().toISOString();

      const entry = {
        id,
        idempotencyKey: id,
        eventId,
        venueId,
        guestName: guestName.trim(),
        age: age || 0,
        gender: gender || 'male',
        totalGuests: totalGuests || 1,
        contact: contact?.trim() || '',
        category: 'dinein',
        paymentMode: 'cash',
        source: 'scanner',
        status: 'active',
        addedAt: now,
        addedBy: `scanner_${eventCode.toUpperCase()}`,
        addedByName: 'Scanner App',
      };

      await fastify.db.collection('door_sales').doc(id).set(entry);

      const liveWhen = new Date().toISOString();
      if (auth.sessionRef) {
        await touchScannerSession(auth.sessionRef, liveWhen).catch(() => {});
      }

      return { success: true, dineInId: id };
    },
  );

  /**
   * GET /api/v1/scan/dine-in?eventId=&eventCode=
   * List recent active dine-ins for the event (scanner app pull-to-refresh)
   */
  fastify.get(
    '/dine-in',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: DineInQuery })],
    },
    async (request: any, reply) => {
      const { eventId, eventCode, limit = '50' } = request.query as any;
      if (!eventId || !eventCode)
        return reply.status(400).send({ error: 'eventId and eventCode are required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }

      // Security check is already handled by validateScannerAccess and matchesScannerContext

      const snap = await fastify.db
        .collection('door_sales')
        .where('eventId', '==', eventId)
        .where('category', '==', 'dinein')
        .where('status', '==', 'active')
        .orderBy('addedAt', 'desc')
        .limit(Number(limit))
        .get();

      return {
        entries: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      };
    },
  );

  // ── Scanner Device Registration ───────────────────────────────────────────

  /**
   * POST /api/v1/scan/devices
   * Register or refresh a scanner device binding for a venue
   */
  fastify.post(
    '/devices',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: DeviceBody })],
    },
    async (request: any, reply) => {
      const { deviceId, venueId, deviceName, eventId, eventCode, gate } = request.body as any;
      if (!deviceId || !venueId)
        return reply.status(400).send({ error: 'deviceId and venueId are required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      const resolvedEventId = eventId || auth.codeData?.eventId;
      if (!matchesScannerContext(auth, { eventId: resolvedEventId, eventCode, venueId })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        if (!resolvedEventId)
          return reply
            .status(400)
            .send({ error: 'eventId is required for Firebase-authenticated device registration' });
        const access = await requireEventManagementAccess(fastify, request, resolvedEventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }

      const now = new Date().toISOString();
      const deviceRef = fastify.db.collection('bound_devices').doc(`${venueId}_${deviceId}`);
      const deviceDoc = await deviceRef.get();

      if (deviceDoc.exists) {
        await deviceRef.update({
          lastActiveAt: now,
          deviceName: deviceName || deviceDoc.data()?.deviceName,
          bound: true,
          status: 'active',
        });
      } else {
        await deviceRef.set({
          deviceId,
          venueId,
          deviceName: deviceName || 'Scanner Device',
          bound: true,
          status: 'active',
          registeredAt: now,
          lastActiveAt: now,
        });
      }

      if (resolvedEventId) {
        await Promise.allSettled([
          upsertScannerDeviceState(
            fastify.db,
            {
              eventId: resolvedEventId,
              venueId,
              deviceId,
              deviceName: deviceName || 'Scanner Device',
              operatorUid: auth.usingFirebase
                ? request.user?.uid || null
                : `scanner_${auth.codeData.code}`,
              operatorName: auth.usingFirebase
                ? request.user?.name || request.user?.email || 'Venue Staff'
                : 'Scanner',
              operatorRole: auth.usingFirebase ? request.user?.role || 'manager' : 'door_staff',
              gate: gate || auth.codeData?.gate || null,
              pairedAt: now,
            },
            now,
          ),
          auth.sessionRef
            ? auth.sessionRef.set(
                {
                  deviceId,
                  venueId,
                  eventId: resolvedEventId,
                  deviceBoundAt: now,
                  lastUsedAt: now,
                },
                { merge: true },
              )
            : Promise.resolve(),
        ]);
      }

      return { success: true, deviceId };
    },
  );

  fastify.post(
    '/heartbeat',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: HeartbeatBody })],
    },
    async (request: any, reply) => {
      const { deviceId, eventId, eventCode, venueId, gate, deviceName } = request.body as any;
      if (!deviceId) return reply.status(400).send({ error: 'deviceId is required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);

      const resolvedEventId = eventId || auth.codeData?.eventId;
      const resolvedVenueId = venueId || auth.codeData?.venueId || null;
      if (!resolvedEventId) return reply.status(400).send({ error: 'eventId is required' });
      if (
        !matchesScannerContext(auth, {
          eventId: resolvedEventId,
          eventCode,
          venueId: resolvedVenueId || undefined,
        })
      ) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, resolvedEventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }

      const now = new Date().toISOString();
      await Promise.allSettled([
        upsertScannerDeviceState(
          fastify.db,
          {
            eventId: resolvedEventId,
            venueId: resolvedVenueId,
            deviceId,
            deviceName: deviceName || 'C1RCLE Scanner',
            operatorUid: auth.usingFirebase
              ? request.user?.uid || null
              : `scanner_${auth.codeData?.code || eventCode || 'session'}`,
            operatorName: auth.usingFirebase
              ? request.user?.name || request.user?.email || 'Venue Staff'
              : 'Scanner',
            operatorRole: auth.usingFirebase ? request.user?.role || 'door_staff' : 'door_staff',
            gate: gate || auth.codeData?.gate || null,
          },
          now,
        ),
        auth.sessionRef ? touchScannerSession(auth.sessionRef, now) : Promise.resolve(),
      ]);

      return { success: true, deviceId, heartbeatAt: now };
    },
  );

  /**
   * POST /api/v1/scan/staff-deny
   * Fire-and-forget audit log when staff physically denies entry after a valid scan
   */
  fastify.post(
    '/staff-deny',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: StaffDenyBody })],
    },
    async (request: any, reply) => {
      const { qrData, eventId, eventCode, gate, reason } = request.body as any;
      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }
      let payload: any = {};
      try {
        payload = JSON.parse(qrData);
      } catch {}
      await recordScanAttempt(fastify.db, {
        orderId: payload.o,
        eventId: eventId || payload.e,
        ticketId: payload.t,
        result: 'invalid',
        reason: `staff_override:${reason || 'unspecified'}`,
        scannedBy: { uid: `scanner_${eventCode}`, name: 'Scanner', role: 'door_staff' },
        device: { id: gate || 'door', bound: false },
      });
      await recordScannerLiveEvent(
        fastify.db,
        {
          eventId,
          venueId: auth.codeData?.venueId || null,
          orderId: payload.o || null,
          ticketId: payload.t || null,
          guestDisplayName: 'Denied Guest',
          result: 'invalid',
          source: 'scanner',
          deviceId: gate || 'door',
          deviceName: 'Scanner',
          operatorUid: auth.usingFirebase ? request.user?.uid || null : `scanner_${eventCode}`,
          operatorName: auth.usingFirebase
            ? request.user?.name || request.user?.email || 'Venue Staff'
            : 'Scanner',
          operatorRole: auth.usingFirebase ? request.user?.role || 'door_staff' : 'door_staff',
          gate: gate || null,
        },
        { totalScans: 1, invalidScans: 1 },
      );
      return { success: true };
    },
  );

  /**
   * POST /api/v1/scan/guestlist/check-in
   * Manual check-in from guestlist screen
   */
  fastify.post(
    '/guestlist/check-in',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: ManualCheckInBody })],
    },
    async (request: any, reply) => {
      const { orderId, eventCode, eventId } = request.body as any;
      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode })) {
        return scannerSessionError(reply);
      }
      if (auth.usingFirebase) {
        const access = await requireEventManagementAccess(fastify, request, eventId);
        if (!access.allowed) return reply.status(access.status).send({ error: access.error });
      }
      const codeSnap = await fastify.db
        .collection('event_codes')
        .where('code', '==', eventCode.toUpperCase())
        .limit(1)
        .get();
      if (codeSnap.empty || codeSnap.docs[0].data().isRevoked)
        return reply.status(403).send({ error: 'Invalid event code' });

      const orderRef = fastify.db.collection('orders').doc(orderId);
      const scanDocId = `${orderId}_manual`;
      const scanRef = fastify.db.collection('ticket_scans').doc(scanDocId);
      let alreadyCheckedIn = false;

      await fastify.db.runTransaction(async (tx: any) => {
        const orderDoc = await tx.get(orderRef);
        if (!orderDoc.exists) throw new Error('Order not found');
        const order = orderDoc.data();

        if (order.status === 'checked_in') {
          alreadyCheckedIn = true;
          return;
        }

        const now = new Date().toISOString();
        tx.update(orderRef, {
          status: 'checked_in',
          checkedInAt: now,
          checkInSource: 'manual_guestlist',
        });

        tx.set(scanRef, {
          orderId,
          eventId,
          result: 'valid',
          scannedBy: { uid: `scanner_${eventCode}`, name: 'Manual Guestlist', role: 'door_staff' },
          device: { id: 'guestlist', bound: false },
          scannedAt: now,
          createdAt: now,
        });
      });

      if (alreadyCheckedIn) {
        return reply.status(400).send({ error: 'Guest already checked in', success: false });
      }

      const now = new Date().toISOString();
      await Promise.allSettled([
        updateScannerSummary(
          fastify.db,
          eventId,
          auth.codeData?.venueId || null,
          {
            checkedIn: 1,
            manualCheckIns: 1,
          },
          now,
        ),
        recordScannerLiveEvent(
          fastify.db,
          {
            eventId,
            venueId: auth.codeData?.venueId || null,
            orderId,
            guestDisplayName: 'Manual Guestlist Check-in',
            result: 'valid',
            source: 'manual_dashboard',
            scannedAt: now,
            deviceId: 'guestlist',
            deviceName: 'Guestlist',
            operatorUid: auth.usingFirebase ? request.user?.uid || null : `scanner_${eventCode}`,
            operatorName: auth.usingFirebase
              ? request.user?.name || request.user?.email || 'Venue Staff'
              : 'Manual Guestlist',
            operatorRole: auth.usingFirebase ? request.user?.role || 'door_staff' : 'door_staff',
            gate: null,
          },
          {},
          { checkedInIncrement: 1 },
        ),
        auth.sessionRef ? touchScannerSession(auth.sessionRef, now) : Promise.resolve(),
      ]);
      return { success: true };
    },
  );

  /**
   * GET /api/v1/scan/entitlements/:id/qr
   * Generate a rotating QR code for an entitlement – owner only
   */
  fastify.get(
    '/entitlements/:id/qr',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ params: EntitlementsParam })],
    },
    async (request: any, reply) => {
      const { id } = request.params as any;
      const userId = request.user?.uid;

      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      try {
        const qr = await createTicketQrForEntitlement({
          db: fastify.db,
          userId,
          entitlementId: id,
        });
        reply.header('Cache-Control', 'private, no-store');
        return {
          ...qr,
          rawData: qr.qrPayload,
        };
      } catch (error: any) {
        const status = error?.code === 'TICKET_MIGRATION_REQUIRED' ? 409 : 404;
        return reply.status(status).send({
          error:
            status === 409
              ? 'Ticket requires migration before it can be scanned'
              : 'Entitlement not found',
          code: error?.code || 'NOT_FOUND',
        });
      }
    },
  );

  /**
   * POST /api/v1/scan/staff-login
   * Authenticate staff using email and password
   */
  fastify.post(
    '/staff-login',
    {
      // Credential endpoint — rate limit to blunt brute-force / credential stuffing.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: StaffLoginBody })],
    },
    async (request: any, reply) => {
      const { idToken, email, password } = request.body as any;

      if (!idToken) {
        return reply.status(410).send({
          error: 'Password-only scanner login is retired. Sign in with Firebase.',
          code: 'LEGACY_SCANNER_LOGIN_RETIRED',
          retryable: false,
        });
      }

      let normalizedEmail = '';
      let verifiedUid = '';

      if (idToken) {
        try {
          const decodedToken = await fastify.auth.verifyIdToken(idToken, true);
          normalizedEmail = decodedToken.email?.toLowerCase().trim() || '';
          verifiedUid = decodedToken.uid;
        } catch (error) {
          fastify.log.error({ error }, 'Invalid Firebase ID token in staff-login');
          return reply.status(401).send({ error: 'Invalid or expired authentication token' });
        }
      } else {
        normalizedEmail = email.toLowerCase().trim();
      }

      if (!normalizedEmail) {
        return reply.status(401).send({ error: 'Invalid email' });
      }

      const staffSnap = await fastify.db
        .collection('venue_staff')
        .where('email', '==', normalizedEmail)
        .get();

      if (staffSnap.empty) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Check for active and verified staff doc
      const validDocs = staffSnap.docs.filter((doc: any) => {
        const data = doc.data();
        return data.status !== 'removed' && data.verified === true && data.isActive === true;
      });

      if (validDocs.length === 0) {
        return reply.status(401).send({ error: 'Account is inactive, removed, or not verified.' });
      }

      const staffDoc = validDocs[0];
      const staffData = staffDoc.data();

      // Defense in depth: when a Firebase token was supplied, bind its verified
      // uid to the staff record so a valid token for one account cannot be used
      // against a different staff row that happens to share the email.
      if (idToken && staffData.userId && staffData.userId !== verifiedUid) {
        return reply.status(401).send({ error: 'Token does not match staff account' });
      }

      return {
        success: true,
        userId: staffData.userId || staffDoc.id,
        venueId: staffData.venueId,
        role: String(staffData.role || 'door').toLowerCase(),
      };
    },
  );

  /**
   * GET /api/v1/scan/events
   * Fetch today's events for a venueId
   */
  fastify.get(
    '/events',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: StaffEventsQuery })],
    },
    async (request: any, reply) => {
      const { venueId, date } = request.query as any;
      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized || !auth.usingFirebase) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { venueId })) return scannerSessionError(reply);

      let targetDateStr = date;
      if (date === 'today') {
        const now = new Date();
        const kolkataTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
        targetDateStr = kolkataTime.toISOString().split('T')[0];
      }

      let query = fastify.db.collection('events').where('venueId', '==', venueId);
      if (targetDateStr) {
        query = query.where('startDate', '==', targetDateStr);
      }

      const snap = await query.get();
      const events = snap.docs
        .map((d: any) => {
          const event = d.data();
          return {
            id: d.id,
            title: event.title || event.name || 'Event',
            venueId: event.venueId,
            venueName: event.venueName || event.venue || null,
            startDate: event.startDate || null,
            startTime: event.startTime || null,
            endTime: event.endTime || null,
            capacity: Number(event.capacity || 0),
            status: event.status || null,
          };
        })
        .filter((event: any) => event.status !== 'draft');

      return { events };
    },
  );

  /**
   * POST /api/v1/scan/staff/session
   * Establish a scanner session for the selected event
   */
  fastify.post(
    '/staff/session',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: StaffSessionBody }), fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { eventId, venueId, deviceId, deviceName, gate } = request.body as any;
      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized || !auth.usingFirebase || !auth.operator) {
        return reply.status(403).send({
          error: 'Forbidden',
          code: 'SCANNER_STAFF_REQUIRED',
        });
      }
      if (!matchesScannerContext(auth, { eventId, venueId, deviceId })) {
        return reply.status(403).send({
          error: 'Forbidden',
          code: 'SCANNER_CONTEXT_MISMATCH',
        });
      }

      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (
        !eventDoc.exists ||
        eventDoc.data()?.isDeleted ||
        String(eventDoc.data()?.venueId || '') !== venueId
      ) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const event = eventDoc.data();
      const canCharge = getPermissionsForRole('venue', auth.operator.role).includes(
        'CHARGE_COVER_WALLETS',
      );

      const sessionToken = randomBytes(24).toString('hex');
      const sessionId = hashScannerSessionToken(sessionToken);
      const sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const sessionRef = fastify.db.collection('scanner_auth_sessions').doc(sessionId);
      const deviceRef = fastify.db.collection('bound_devices').doc(`${venueId}_${deviceId}`);
      const batch = fastify.db.batch();
      batch.set(
        deviceRef,
        {
          deviceId,
          venueId,
          userId: auth.operator.uid,
          role: auth.operator.role,
          deviceName: deviceName || 'C1RCLE Scanner',
          bound: true,
          status: 'active',
          registeredAt: now,
          lastActiveAt: now,
        },
        { merge: true },
      );
      batch.set(sessionRef, {
        codeId: 'staff_' + auth.operator.uid,
        code: 'STAFF',
        codeType: canCharge ? 'charge' : 'scan_only',
        eventId,
        venueId,
        deviceId,
        gate: gate || null,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: sessionExpiresAt,
        revokedAt: null,
        isStaffSession: true,
        userId: auth.operator.uid,
        userName: auth.operator.name,
        role: auth.operator.role,
      });
      await batch.commit();

      const stats = await getScannerSummarySnapshot(fastify.db, eventId);

      let tiers: any[] = [];
      const tierSnap = await fastify.db
        .collection('events')
        .doc(eventId)
        .collection('ticketing')
        .get();

      if (!tierSnap.empty) {
        tiers = tierSnap.docs.map((d: any) => {
          const t = d.data();
          return {
            id: d.id,
            name: t.name,
            price: t.price || 0,
            entryType: t.entryType || 'general',
            available: (t.remaining ?? t.quantity ?? 0) > 0,
          };
        });
      } else {
        tiers = (event?.tickets || []).map((t: any) => ({
          id: t.id || t.ticketId,
          name: t.name,
          price: t.price || 0,
          entryType: t.entryType || 'general',
          available: (t.remaining || t.quantity || 0) > 0,
        }));
      }

      return {
        valid: true,
        code: 'STAFF',
        sessionToken,
        sessionExpiresAt,
        event: {
          id: eventDoc.id,
          title: event?.title,
          venue: event?.venueName || event?.venue,
          venueId: event?.venueId,
          date: event?.startDate,
          startTime: event?.startTime,
          endTime: event?.endTime,
          capacity: event?.capacity || 500,
          imageUrl: event?.image || event?.coverImage,
        },
        permissions: {
          canScan: true,
          canDoorEntry: ['owner', 'manager', 'floor_manager', 'ops', 'security', 'door'].includes(
            auth.operator.role,
          ),
          canCharge,
        },
        tiers,
        gate: 'Main Gate',
        stats,
      };
    },
  );
}
