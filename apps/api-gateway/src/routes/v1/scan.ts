import { FastifyInstance } from 'fastify';
import {
  verifyScanSignature,
  validateScannerDevice,
  recordScanAttempt,
} from '@c1rcle/core/scan-engine';
import { randomBytes, createHmac } from 'node:crypto';
import { FieldValue, Firestore } from 'firebase-admin/firestore';
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
import { verifyPassword, decrypt } from '../../lib/encryption';

const ScanBody = z
  .object({
    qrData: z.any().optional(),
    ticketPayload: z.any().optional(), // Legacy web proxy compat
    scannerId: z.string().optional(), // Legacy web proxy compat
    eventId: z.string().optional(),
    eventCode: z.string().optional(),
    deviceId: z.string().optional(),
    venueId: z.string().optional(),
    gate: z.string().optional(),
    scannedBy: z.any().optional(),
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
    userId: z.string(),
    role: z.string(),
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
    idempotencyKey: z.string().uuid().optional(),
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

const QR_SECRET = getQrSecret();

type ScannerAuthResult = {
  authorized: boolean;
  usingFirebase: boolean;
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

  try {
    const decoded = await (fastify as any).auth.verifyIdToken(token);
    request.user = { ...(request.user || {}), ...decoded };
    return { authorized: true, usingFirebase: true };
  } catch {}

  const session = await validateScannerSession(fastify, token);
  if (!session.authorized) return { authorized: false, usingFirebase: false };

  request.scannerCodeId = session.codeDoc.id;
  request.scannerCodeData = session.codeData;
  request.scannerSessionId = session.sessionId;

  return {
    authorized: true,
    usingFirebase: false,
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
  { eventId, eventCode, venueId }: { eventId?: string; eventCode?: string; venueId?: string },
): boolean {
  if (auth.usingFirebase || !auth.codeData) return true;

  const normalizedCode = eventCode?.toUpperCase().trim();
  if (normalizedCode && auth.codeData.code !== normalizedCode) return false;
  if (eventId && auth.codeData.eventId !== eventId) return false;
  if (venueId && auth.codeData.venueId && auth.codeData.venueId !== venueId) return false;

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
  // ── Core QR Scan Processing ───────────────────────────────────────────────

  /**
   * POST /api/v1/scan
   * Process a QR scan
   */
  fastify.post(
    '/',
    {
      preHandler: [fastify.validate({ body: ScanBody })],
    },
    async (request: any, reply) => {
      const { eventId, eventCode, deviceId, venueId } = request.body;
      const qrData = request.body.qrData || request.body.ticketPayload;
      const scannedBy =
        request.body.scannedBy ||
        (request.body.scannerId ? { uid: request.body.scannerId, role: 'door_staff' } : undefined);

      if (!qrData) return reply.status(400).send({ error: 'QR data is required' });

      const auth = await validateScannerAccess(fastify, request);
      if (!auth.authorized) return scannerSessionError(reply);
      if (!matchesScannerContext(auth, { eventId, eventCode, venueId })) {
        return scannerSessionError(reply);
      }

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
          const { verifyTicketQrJwt } =
            await import('../../../../../packages/core/ticket-checkout-wallet-service.js');
          const verified = verifyTicketQrJwt(qrData.trim());
          if (verified && verified.valid && verified.payload) {
            payload = {
              o: verified.payload.o || verified.payload.orderId,
              t: verified.payload.t || verified.payload.ticketId,
              e: verified.payload.e || verified.payload.eventId,
              u: verified.payload.u || verified.payload.userId,
              q: verified.payload.q || 1,
              sig: 'jwt_verified',
            };
          } else {
            return reply.status(400).send({
              error: verified?.error || 'Expired or invalid ticket QR code',
              result: 'invalid',
            });
          }
        } else {
          payload = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
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

      const isSignatureValid = payload.sig === 'jwt_verified' ? true : verifyScanSignature(payload);
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

  /**
   * GET /api/v1/scan/history?eventId=XXX
   */
  fastify.get(
    '/history',
    {
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
      preHandler: [fastify.validate({ body: AuthBody })],
    },
    async (request: any, reply) => {
      const { code } = request.body as any;
      if (!code) return reply.status(400).send({ valid: false, error: 'code required' });

      // M3: Per-IP rate limiting — 10 attempts/min (graceful if Redis unavailable)
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
      } catch {
        fastify.log.warn('Redis unavailable — skipping rate limit on /scan/auth');
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
      const eventTickets: any[] =
        (eventDoc.exists ? (eventDoc.data() as any)?.tickets : null) || [];
      const tierConfig = eventTickets.find((t: any) => t.id === tierId || t.tierId === tierId);
      const tierName = tierConfig?.name || clientTierName || tierId;
      const unitPrice = Number(tierConfig?.price ?? tierConfig?.unitPrice ?? 0);
      const totalAmount = unitPrice * quantity;

      const now = new Date().toISOString();
      // H1: Idempotency — deterministic orderId from client key
      const orderId = idempotencyKey
        ? `DOOR-${idempotencyKey.replace(/-/g, '').substring(0, 8).toUpperCase()}`
        : `DOOR-${randomBytes(4).toString('hex').toUpperCase()}`;

      // Idempotency replay check
      if (idempotencyKey) {
        const existingOrder = await fastify.db.collection('orders').doc(orderId).get();
        if (existingOrder.exists) {
          return { success: true, orderId, qrData: existingOrder.data()?.qrData };
        }
      }
      const ticketId = `TKT-${randomBytes(3).toString('hex').toUpperCase()}`;
      const ts = Date.now();
      const qrPayload: any = {
        o: orderId,
        e: eventId,
        t: ticketId,
        n: tierName,
        u: `guest_${ts}`,
        q: quantity,
        et: entryType || 'general',
        rt: 0,
        ts,
        v: 1,
      };
      qrPayload.sig = createHmac('sha256', QR_SECRET)
        .update(`${orderId}:${eventId}:${ticketId}:${qrPayload.u}:${quantity}:${ts}:PAID`)
        .digest('hex')
        .substring(0, 16);

      await fastify.db.runTransaction(async (tx: any) => {
        tx.set(fastify.db.collection('orders').doc(orderId), {
          id: orderId,
          eventId,
          source: 'door',
          status: 'confirmed',
          userName: guestName,
          userPhone: guestPhone || null,
          userId: qrPayload.u,
          tickets: [
            {
              ticketId,
              tierId,
              name: tierName,
              entryType: entryType || 'general',
              quantity,
              unitPrice,
              subtotal: totalAmount,
            },
          ],
          subtotal: totalAmount,
          total: totalAmount,
          currency: 'INR',
          paymentMethod,
          paymentStatus: 'collected',
          doorEntryMeta: {
            eventCode: eventCode.toUpperCase(),
            gate: gate || null,
            collectedAt: now,
          },
          qrPayload,
          qrData: JSON.stringify(qrPayload),
          createdAt: now,
          confirmedAt: now,
          checkedInAt: now,
        });
        tx.set(fastify.db.collection('ticket_scans').doc(`${orderId}_scan`), {
          orderId,
          eventId,
          ticketId,
          userId: qrPayload.u,
          quantity,
          entryType: entryType || 'general',
          result: 'valid',
          source: 'door',
          scannedBy: { uid: `scanner_${eventCode}`, name: 'Door Entry', role: 'door_staff' },
          device: { id: gate || 'door', bound: false },
          scannedAt: now,
          createdAt: now,
        });
        tx.update(codeSnap.docs[0].ref, {
          'stats.doorEntriesCount': (codeData.stats?.doorEntriesCount || 0) + quantity,
          'stats.doorRevenue': (codeData.stats?.doorRevenue || 0) + totalAmount,
        });
      });

      const liveWhen = new Date().toISOString();
      await Promise.allSettled([
        recordScannerLiveEvent(
          fastify.db,
          {
            eventId,
            venueId: codeData.venueId || null,
            orderId,
            ticketId,
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

      return { success: true, orderId, qrData: JSON.stringify(qrPayload) };
    },
  );

  /**
   * GET /api/v1/scan/door-entry?eventId=XXX
   */
  fastify.get(
    '/door-entry',
    {
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
          auth.sessionRef ? touchScannerSession(auth.sessionRef, now) : Promise.resolve(),
        ]);
      }

      return { success: true, deviceId };
    },
  );

  fastify.post(
    '/heartbeat',
    {
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
      preHandler: [fastify.validate({ params: EntitlementsParam })],
    },
    async (request: any, reply) => {
      const { id } = request.params as any;
      const userId = request.user?.uid;

      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      const entDoc = await fastify.db.collection('entitlements').doc(id).get();
      if (!entDoc.exists) return reply.status(404).send({ error: 'Entitlement not found' });

      const entitlement = entDoc.data() as any;
      if (entitlement.ownerUserId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { generateEntitlementQR } = await import('@c1rcle/core/entitlement-engine');
      const qr = generateEntitlementQR(id);
      return { ...qr, rawData: JSON.stringify(qr) };
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

      if (!idToken && (!email || !password)) {
        return reply.status(400).send({ error: 'Either idToken or email/password is required' });
      }

      let normalizedEmail = '';
      let verifiedUid = '';

      if (idToken) {
        try {
          const decodedToken = await fastify.auth.verifyIdToken(idToken);
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

      // Check if password matches if not using idToken
      if (!idToken) {
        let isMatch = false;
        if (staffData.password) {
          isMatch = verifyPassword(password, staffData.password);
        } else if (staffData.tempPassword) {
          isMatch = password === decrypt(staffData.tempPassword);
        }

        if (!isMatch) {
          return reply.status(401).send({ error: 'Invalid email or password' });
        }
      }

      return {
        success: true,
        userId: staffData.userId || staffDoc.id,
        venueId: staffData.venueId,
        role: staffData.role || 'DOOR',
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
      preHandler: [fastify.validate({ querystring: StaffEventsQuery })],
    },
    async (request: any, reply) => {
      const { venueId, date } = request.query as any;

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
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((e: any) => !e.isDeleted && e.status !== 'draft');

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
      preHandler: [fastify.validate({ body: StaffSessionBody })],
    },
    async (request: any, reply) => {
      const { eventId, venueId, userId, role } = request.body as any;

      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists || eventDoc.data()?.isDeleted) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const event = eventDoc.data();

      const sessionToken = randomBytes(24).toString('hex');
      const sessionId = hashScannerSessionToken(sessionToken);
      const sessionExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      await fastify.db
        .collection('scanner_auth_sessions')
        .doc(sessionId)
        .set({
          codeId: 'staff_' + userId,
          code: 'STAFF',
          codeType: 'full',
          eventId,
          venueId,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          expiresAt: sessionExpiresAt,
          revokedAt: null,
          isStaffSession: true,
          userId,
          role,
        });

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
          canDoorEntry: true,
        },
        tiers,
        gate: 'Main Gate',
        stats,
      };
    },
  );
}
