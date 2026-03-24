import { FastifyInstance } from 'fastify';
import { verifyScanSignature, validateScannerDevice, recordScanAttempt } from '@c1rcle/core/scan-engine';
import { randomBytes, createHmac } from 'node:crypto';
import { z } from 'zod';

const ScanBody = z.object({
    qrData: z.any(),
    eventId: z.string().optional(),
    eventCode: z.string().optional(),
    deviceId: z.string().optional(),
    venueId: z.string().optional(),
    gate: z.string().optional(),
    scannedBy: z.any().optional()
}).strict();

const HistoryQuery = z.object({
    eventId: z.string(),
    limit: z.string().optional()
}).strict();

const CodesQuery = z.object({
    eventId: z.string()
}).strict();

const CodesBody = z.object({
    eventId: z.string(),
    type: z.enum(['full', 'scan_only', 'charge']).optional().default('full'),
    gate: z.string().optional(),
    expiresAt: z.string().nullable().optional(),
    createdBy: z.union([z.string(), z.object({ uid: z.string(), name: z.string().optional() })]).optional()
}).strict();

const CodeIdParam = z.object({ id: z.string() }).strict();
const DeleteCodesBody = z.object({ revokedBy: z.string().optional() }).strict();

const AuthBody = z.object({ code: z.string() }).strict();
const StatsQuery = z.object({ code: z.string() }).strict();
const GuestlistQuery = z.object({ eventId: z.string(), eventCode: z.string().optional() }).strict();

const DoorEntryBody = z.object({
    eventCode: z.string(),
    eventId: z.string(),
    guestName: z.string().min(2),
    guestPhone: z.string().optional(),
    tierId: z.string(),
    tierName: z.string().optional(),
    entryType: z.string().optional(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    totalAmount: z.number().optional(),
    paymentMethod: z.string().optional(),
    gate: z.string().optional(),
    idempotencyKey: z.string().uuid().optional(),
}).strict();

const DoorEntryQuery = z.object({ eventId: z.string(), eventCode: z.string().optional() }).strict();

const WalkInBody = z.object({
    eventCode: z.string(),
    eventId: z.string(),
    venueId: z.string(),
    guestName: z.string(),
    guestAge: z.number().int().min(0).max(120).optional(),
    guestPhone: z.string().optional(),
    gate: z.string().optional(),
}).strict();

const WalkInQuery = z.object({
    eventId: z.string(),
    eventCode: z.string(),
    limit: z.string().optional(),
}).strict();

const DeviceBody = z.object({
    deviceId: z.string(),
    venueId: z.string(),
    deviceName: z.string().optional(),
}).strict();

const EntitlementsParam = z.object({ id: z.string() }).strict();

const StaffDenyBody = z.object({
    qrData: z.string(),
    eventId: z.string(),
    eventCode: z.string(),
    gate: z.string().optional(),
    reason: z.string().optional(),
}).strict();

const ManualCheckInBody = z.object({
    orderId: z.string(),
    eventCode: z.string(),
    eventId: z.string(),
}).strict();

const QR_SECRET = process.env.QR_SECRET_KEY || 'c1rcle-qr-secret-2024';
const SCANNER_SESSION_SECRET = process.env.SCANNER_SESSION_SECRET || 'scanner-session-secret-2024';

type ScannerAuthResult = {
    authorized: boolean;
    usingFirebase: boolean;
    codeDoc?: any;
    codeData?: any;
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
    const authHeader = (request.headers.authorization as string) || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { authorized: false, usingFirebase: false };

    try {
        const decoded = await (fastify as any).firebase.auth().verifyIdToken(token);
        request.user = { ...(request.user || {}), ...decoded };
        return { authorized: true, usingFirebase: true };
    } catch {}

    const snap = await (fastify as any).db.collection('event_codes')
        .where('activeSessionToken', '==', token)
        .where('isRevoked', '==', false)
        .limit(1)
        .get();

    if (snap.empty) return { authorized: false, usingFirebase: false };

    const codeDoc = snap.docs[0];
    const codeData = codeDoc.data();
    if (codeData.sessionExpiresAt && new Date(codeData.sessionExpiresAt) < new Date()) {
        return { authorized: false, usingFirebase: false };
    }

    request.scannerCodeId = codeDoc.id;
    request.scannerCodeData = codeData;

    return { authorized: true, usingFirebase: false, codeDoc, codeData };
}

function scannerSessionError(reply: any) {
    return reply.status(401).send({ error: 'Scanner session expired or invalid', result: 'session_expired' });
}

function matchesScannerContext(
    auth: ScannerAuthResult,
    {
        eventId,
        eventCode,
        venueId,
    }: { eventId?: string; eventCode?: string; venueId?: string },
): boolean {
    if (auth.usingFirebase || !auth.codeData) return true;

    const normalizedCode = eventCode?.toUpperCase().trim();
    if (normalizedCode && auth.codeData.code !== normalizedCode) return false;
    if (eventId && auth.codeData.eventId !== eventId) return false;
    if (venueId && auth.codeData.venueId && auth.codeData.venueId !== venueId) return false;

    return true;
}

export default async function scanRoutes(fastify: FastifyInstance) {

    // ── Core QR Scan Processing ───────────────────────────────────────────────

    /**
     * POST /api/v1/scan
     * Process a QR scan
     */
    fastify.post('/', {
        preHandler: [fastify.validate({ body: ScanBody })]
    }, async (request: any, reply) => {
        const { qrData, eventId, eventCode, deviceId, venueId, scannedBy } = request.body;
        if (!qrData) return reply.status(400).send({ error: 'QR data is required' });

        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode, venueId })) {
            return scannerSessionError(reply);
        }

        let payload: any;
        try {
            payload = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
        } catch (e) {
            return reply.status(400).send({ error: 'Invalid QR format', result: 'invalid' });
        }

        // ── Entitlement QR format (eid, ts, sig) ─────────────────────────────
        if (typeof payload.eid === 'string' && typeof payload.ts === 'number') {
            const { processEntryScan } = await import('@c1rcle/core/entitlement-engine');
            const gate = (request.body as any).gate;
            const result = await processEntryScan(payload, scannedBy?.uid || 'scanner', eventId || payload.eventId, { gate });
            if (!result.success) {
                return reply.status(400).send({
                    error: result.message || 'Entry denied',
                    result: result.result, // 'already_used' | 'expired' | 'invalid'
                });
            }
            return {
                success: true, result: 'valid', scanId: result.entitlementId,
                ticket: { orderId: '', eventId: eventId || '', eventTitle: '', ticketName: 'Entry', quantity: 1, entryType: result.entitlementType || 'general', userName: result.ownerName || 'Guest', userEmail: '' },
                message: 'Entry approved'
            };
        }

        // ── Order-based QR format ─────────────────────────────────────────────
        const isSignatureValid = verifyScanSignature(payload);
        if (!isSignatureValid) {
            await recordScanAttempt(fastify.db, { orderId: payload.o, eventId: eventId || payload.e, result: 'invalid', reason: 'Signature mismatch', scannedBy, deviceId });
            return reply.status(400).send({ error: 'Invalid signature', result: 'invalid' });
        }

        // H8: Explicit event mismatch check
        if (eventId && payload.e && payload.e !== eventId) {
            await recordScanAttempt(fastify.db, { orderId: payload.o, eventId: eventId, result: 'invalid', reason: 'wrong_event', scannedBy, deviceId });
            return reply.status(400).send({ error: 'Ticket is for a different event', result: 'wrong_event' });
        }

        const authorizedVenueId = venueId || auth.codeData?.venueId || null;
        if (deviceId && authorizedVenueId) {
            const deviceCheck = await validateScannerDevice(fastify.db, deviceId, authorizedVenueId);
            if (!deviceCheck.valid) return reply.status(403).send({ error: deviceCheck.error, result: 'device_invalid' });
            await deviceCheck.ref.update({ lastActiveAt: new Date().toISOString() });
        }

        const orderRef = fastify.db.collection('orders').doc(payload.o);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) return reply.status(404).send({ error: 'Order not found', result: 'not_found' });
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
            tx.set(scanRef, {
                orderId: payload.o, eventId: payload.e, ticketId: payload.t,
                userId: payload.u, quantity: payload.q, entryType: payload.et || 'general',
                result: 'valid', scannedBy, deviceId: deviceId || null,
                device: deviceId ? { id: deviceId, bound: true } : { id: null, bound: false },
                scannedAt: now, createdAt: now,
            });
            if (order?.status === 'confirmed') {
                tx.update(orderRef, { status: 'checked_in', checkedInAt: now, lastScanId: scanDocId });
            }
        });

        if (alreadyScanned) {
            return reply.status(400).send({
                error: 'Ticket already scanned', result: 'already_scanned',
                previousScan: { scannedAt: existingScanData.scannedAt, scannedBy: existingScanData.scannedBy }
            });
        }

        return {
            success: true, result: 'valid', scanId: scanDocId,
            ticket: { orderId: payload.o, eventId: payload.e, eventTitle: order?.eventTitle, ticketName: payload.n, userName: order?.userName, userEmail: order?.userEmail, quantity: payload.q, entryType: payload.et || 'general' },
            message: `Entry approved — ${order?.userName || 'Guest'}`
        };
    });

    /**
     * GET /api/v1/scan/history?eventId=XXX
     */
    fastify.get('/history', {
        preHandler: [fastify.validate({ querystring: HistoryQuery })]
    }, async (request: any, reply) => {
        const { eventId, limit = 100 } = request.query;
        if (!eventId) return reply.status(400).send({ error: 'eventId is required' });
        const snapshot = await fastify.db.collection('ticket_scans')
            .where('eventId', '==', eventId).orderBy('scannedAt', 'desc').limit(Number(limit)).get();
        return { scans: snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) };
    });

    // ── Event Code Management ─────────────────────────────────────────────────

    /**
     * GET /api/v1/scan/codes?eventId=XXX
     */
    fastify.get('/codes', {
        preHandler: [fastify.validate({ querystring: CodesQuery })]
    }, async (request: any, reply) => {
        const { eventId } = request.query;
        if (!eventId) return reply.status(400).send({ error: 'eventId required' });
        const snap = await fastify.db.collection('event_codes')
            .where('eventId', '==', eventId).orderBy('createdAt', 'desc').get();
        return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    });

    /**
     * POST /api/v1/scan/codes
     */
    fastify.post('/codes', {
        preHandler: [fastify.validate({ body: CodesBody })]
    }, async (request: any, reply) => {
        const { eventId, type = 'full', gate, expiresAt, createdBy } = request.body;
        if (!eventId) return reply.status(400).send({ error: 'eventId required' });
        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
        const eventData = eventDoc.data();
        const code = `C1R-${randomBytes(3).toString('hex').toUpperCase()}`;
        const now = new Date().toISOString();
        const docRef = await fastify.db.collection('event_codes').add({
            code, eventId, venueId: eventData?.venueId || null, type, gate: gate || null,
            isRevoked: false, createdBy: createdBy || null, createdAt: now,
            expiresAt: expiresAt || null, usageCount: 0, lastUsedAt: null,
            stats: { scansCount: 0, doorEntriesCount: 0, doorRevenue: 0 }
        });
        return { success: true, code: { id: docRef.id, code, eventId } };
    });

    /**
     * DELETE /api/v1/scan/codes/:id
     */
    fastify.delete('/codes/:id', {
        preHandler: [fastify.validate({ params: CodeIdParam, body: DeleteCodesBody })]
    }, async (request: any, reply) => {
        const { id } = request.params as any;
        const { revokedBy } = (request.body as any) || {};
        await fastify.db.collection('event_codes').doc(id).update({ isRevoked: true, revokedAt: new Date().toISOString(), revokedBy: revokedBy || null });
        return { success: true };
    });

    // ── Scanner App Auth (Code Validation) ───────────────────────────────────

    /**
     * POST /api/v1/scan/auth
     * Validate event code and return event context for scanner app
     */
    fastify.post('/auth', {
        preHandler: [fastify.validate({ body: AuthBody })]
    }, async (request: any, reply) => {
        const { code } = request.body as any;
        if (!code) return reply.status(400).send({ valid: false, error: 'code required' });

        // M3: Per-IP rate limiting — 10 attempts/min (graceful if Redis unavailable)
        try {
            const ip = request.ip;
            const rateLimitKey = `scan:auth:${ip}`;
            const attempts = await fastify.redis.incr(rateLimitKey);
            if (attempts === 1) await fastify.redis.expire(rateLimitKey, 60);
            if (attempts > 10) {
                return reply.status(429).send({ valid: false, error: 'Too many attempts. Try again in a minute.' });
            }
        } catch {
            fastify.log.warn('Redis unavailable — skipping rate limit on /scan/auth');
        }

        const normalizedCode = code.toUpperCase().trim();
        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', normalizedCode).limit(1).get();
        if (codeSnap.empty) return reply.status(404).send({ valid: false, error: 'Invalid event code' });

        const codeDoc = codeSnap.docs[0];
        const codeData = codeDoc.data();
        if (codeData.isRevoked) return reply.status(403).send({ valid: false, error: 'Code revoked' });
        if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date())
            return reply.status(403).send({ valid: false, error: 'Code expired' });

        // M4: Device limit check
        const maxDevices = codeData.maxDevices ?? 5;
        if ((codeData.usageCount || 0) >= maxDevices && !codeData.allowReuse) {
            return reply.status(403).send({ valid: false, error: 'Code device limit reached. Contact the event organiser.' });
        }

        const eventDoc = await fastify.db.collection('events').doc(codeData.eventId).get();
        if (!eventDoc.exists) return reply.status(404).send({ valid: false, error: 'Event not found' });
        const event = eventDoc.data();

        // C3: Generate scanner session token (12hr TTL)
        const sessionPayload = `${codeDoc.id}:${codeData.eventId}:${Date.now()}`;
        const sessionToken = createHmac('sha256', SCANNER_SESSION_SECRET)
            .update(sessionPayload).digest('hex').substring(0, 32);
        const sessionExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

        const now = new Date().toISOString();
        await codeDoc.ref.update({
            lastUsedAt: now,
            usageCount: (codeData.usageCount || 0) + 1,
            activeSessionToken: sessionToken,
            sessionExpiresAt,
        });

        const [scansSnap, doorOrdersSnap, walkInSnap] = await Promise.all([
            fastify.db.collection('ticket_scans').where('eventId', '==', codeData.eventId).where('result', '==', 'valid').get(),
            fastify.db.collection('orders').where('eventId', '==', codeData.eventId).where('source', '==', 'door').get(),
            fastify.db.collection('walk_in_entries').doc(codeData.eventId).collection('logs').where('status', '==', 'active').get()
        ]);
        const prebookedEntered = scansSnap.docs
            .filter((d: any) => d.data().source !== 'door')
            .reduce((sum: number, d: any) => sum + (d.data().quantity || 1), 0);
        const doorEntries = doorOrdersSnap.docs.reduce((sum: number, d: any) => sum + sumOrderEntryCount(d.data()), 0);
        const doorRevenue = doorOrdersSnap.docs.reduce((s: number, d: any) => s + (d.data().total || 0), 0);
        const walkIns = walkInSnap.docs.length;

        // H7: Try ticketing subcollection first, fall back to tickets array
        let tiers: any[] = [];
        const tierSnap = await fastify.db.collection('events').doc(codeData.eventId).collection('ticketing').get();
        if (!tierSnap.empty) {
            tiers = tierSnap.docs.map((d: any) => {
                const t = d.data();
                return { id: d.id, name: t.name, price: t.price || 0, entryType: t.entryType || 'general', available: (t.remaining ?? t.quantity ?? 0) > 0 };
            });
        } else {
            tiers = (event?.tickets || []).map((t: any) => ({ id: t.id || t.ticketId, name: t.name, price: t.price || 0, entryType: t.entryType || 'general', available: (t.remaining || t.quantity || 0) > 0 }));
        }

        return {
            valid: true, code: normalizedCode, codeId: codeDoc.id,
            sessionToken, sessionExpiresAt,
            event: { id: eventDoc.id, title: event?.title, venue: event?.venueName, venueId: event?.venueId, date: event?.date, startTime: event?.startTime, endTime: event?.endTime, capacity: event?.capacity || 500, imageUrl: event?.coverImage },
            permissions: {
                canScan: codeData.type === 'full' || codeData.type === 'scan_only',
                canDoorEntry: codeData.type === 'full',
                canWalkIn: codeData.type === 'full' || codeData.type === 'scan_only',
                canCharge: codeData.type === 'charge',
            },
            tiers, gate: codeData.gate || null,
            stats: { totalEntered: prebookedEntered + doorEntries + walkIns, prebooked: prebookedEntered, doorEntries, doorRevenue, walkIns }
        };
    });

    /**
     * GET /api/v1/scan/auth?eventId=XXX – list codes for an event
     */
    fastify.get('/auth', {
        preHandler: [fastify.validate({ querystring: CodesQuery })]
    }, async (request: any, reply) => {
        const { eventId } = request.query as any;
        if (!eventId) return reply.status(400).send({ error: 'eventId required' });
        const snap = await fastify.db.collection('event_codes').where('eventId', '==', eventId).orderBy('createdAt', 'desc').get();
        return { codes: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    });

    // ── Real-time Scan Stats ──────────────────────────────────────────────────

    /**
     * GET /api/v1/scan/stats?code=C1R-XXXXXX
     */
    fastify.get('/stats', {
        preHandler: [fastify.validate({ querystring: StatsQuery })]
    }, async (request: any, reply) => {
        const { code } = request.query as any;
        if (!code) return reply.status(400).send({ error: 'code required' });

        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);

        const normalizedCode = code.toUpperCase().trim();
        if (!matchesScannerContext(auth, { eventCode: normalizedCode })) {
            return scannerSessionError(reply);
        }
        const cacheKey = `scan:stats:${normalizedCode}`;
        const cached = await fastify.cache.get('scan:stats', cacheKey);
        if (cached) return cached;

        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', normalizedCode).limit(1).get();
        if (codeSnap.empty) return reply.status(404).send({ error: 'Invalid event code' });
        const codeData = codeSnap.docs[0].data();
        if (codeData.isRevoked) return reply.status(403).send({ error: 'Code revoked' });

        const [scansSnap, doorSnap, walkInSnap] = await Promise.all([
            fastify.db.collection('ticket_scans').where('eventId', '==', codeData.eventId).where('result', '==', 'valid').get(),
            fastify.db.collection('orders').where('eventId', '==', codeData.eventId).where('source', '==', 'door').get(),
            fastify.db.collection('walk_in_entries').doc(codeData.eventId).collection('logs').where('status', '==', 'active').get()
        ]);
        const prebookedScans = scansSnap.docs.filter((d: any) => d.data().source !== 'door');
        const prebooked = prebookedScans.reduce((sum: number, d: any) => sum + (d.data().quantity || 1), 0);
        const doorEntries = doorSnap.docs.reduce((sum: number, d: any) => sum + sumOrderEntryCount(d.data()), 0);
        const doorRevenue = doorSnap.docs.reduce((s: number, d: any) => s + (d.data().total || 0), 0);
        const byEntryType: Record<string, number> = {};
        scansSnap.docs.forEach((d: any) => { const et = d.data().entryType || 'general'; byEntryType[et] = (byEntryType[et] || 0) + (d.data().quantity || 1); });
        const walkIns = walkInSnap.docs.length;
        const totalEntered = prebooked + doorEntries + walkIns;
        const result = { totalEntered, prebooked, doorEntries, doorRevenue, walkIns, byEntryType };
        await fastify.cache.set('scan:stats', cacheKey, result, 20); // 20s TTL — fresh enough for scanner UI
        return result;
    });

    // ── Guest List ────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/scan/guestlist?eventId=XXX
     */
    fastify.get('/guestlist', {
        preHandler: [fastify.validate({ querystring: GuestlistQuery })]
    }, async (request: any, reply) => {
        const { eventId, eventCode } = request.query as any;
        if (!eventId) return reply.status(400).send({ error: 'eventId required' });

        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode })) {
            return scannerSessionError(reply);
        }

        const [ordersSnap, scansSnap] = await Promise.all([
            fastify.db.collection('orders').where('eventId', '==', eventId).where('status', 'in', ['confirmed', 'checked_in']).get(),
            fastify.db.collection('ticket_scans').where('eventId', '==', eventId).where('result', '==', 'valid').get()
        ]);
        const scannedIds = new Set<string>();
        const scanTimes = new Map<string, string>();
        scansSnap.docs.forEach((d: any) => { scannedIds.add(d.data().orderId); scanTimes.set(d.data().orderId, d.data().scannedAt); });

        const guests = ordersSnap.docs.map((doc: any) => {
            const order = doc.data();
            const ticket = order.tickets?.[0] || {};
            const entered = scannedIds.has(doc.id) || order.status === 'checked_in';
            return { id: doc.id, name: order.userName || 'Guest', ticketType: ticket.name || 'Entry', entryType: ticket.entryType || 'general', quantity: ticket.quantity || 1, source: order.source || 'online', status: entered ? 'entered' : 'not_entered', enteredAt: scanTimes.get(doc.id) || order.checkedInAt || null };
        });
        guests.sort((a: any, b: any) => a.status !== b.status ? (a.status === 'not_entered' ? -1 : 1) : a.name.localeCompare(b.name));
        return { guests };
    });

    // ── Door Entry (Walk-up Sales) ────────────────────────────────────────────

    /**
     * POST /api/v1/scan/door-entry
     */
    fastify.post('/door-entry', {
        preHandler: [fastify.validate({ body: DoorEntryBody })]
    }, async (request: any, reply) => {
        const { eventCode, eventId, guestName, guestPhone, tierId, tierName, entryType, quantity = 1, unitPrice = 0, totalAmount = 0, paymentMethod = 'cash', gate, idempotencyKey } = request.body as any;
        if (!eventCode || !eventId || !guestName || !tierId) return reply.status(400).send({ success: false, error: 'Missing required fields' });

        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode })) {
            return scannerSessionError(reply);
        }

        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', eventCode.toUpperCase()).limit(1).get();
        if (codeSnap.empty) return reply.status(403).send({ success: false, error: 'Invalid event code' });
        const codeData = codeSnap.docs[0].data();
        if (codeData.type !== 'full') return reply.status(403).send({ success: false, error: 'Door entry not permitted for this code' });

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
        const qrPayload: any = { o: orderId, e: eventId, t: ticketId, n: tierName, u: `guest_${ts}`, q: quantity, et: entryType || 'general', rt: 0, ts, v: 1 };
        qrPayload.sig = createHmac('sha256', QR_SECRET)
            .update(`${orderId}:${eventId}:${ticketId}:${qrPayload.u}:${quantity}:${ts}:PAID`)
            .digest('hex')
            .substring(0, 16);

        await fastify.db.runTransaction(async (tx: any) => {
            tx.set(fastify.db.collection('orders').doc(orderId), {
                id: orderId, eventId, source: 'door', status: 'confirmed',
                userName: guestName, userPhone: guestPhone || null, userId: qrPayload.u,
                tickets: [{ ticketId, tierId, name: tierName, entryType: entryType || 'general', quantity, unitPrice, subtotal: totalAmount }],
                subtotal: totalAmount, total: totalAmount, currency: 'INR',
                paymentMethod, paymentStatus: 'collected',
                doorEntryMeta: { eventCode: eventCode.toUpperCase(), gate: gate || null, collectedAt: now },
                qrPayload, qrData: JSON.stringify(qrPayload), createdAt: now, confirmedAt: now, checkedInAt: now
            });
            tx.set(fastify.db.collection('ticket_scans').doc(`${orderId}_scan`), {
                orderId, eventId, ticketId, userId: qrPayload.u, quantity, entryType: entryType || 'general',
                result: 'valid', source: 'door', scannedBy: { uid: `scanner_${eventCode}`, name: 'Door Entry', role: 'door_staff' },
                device: { id: gate || 'door', bound: false }, scannedAt: now, createdAt: now
            });
            tx.update(codeSnap.docs[0].ref, {
                'stats.doorEntriesCount': (codeData.stats?.doorEntriesCount || 0) + quantity,
                'stats.doorRevenue': (codeData.stats?.doorRevenue || 0) + totalAmount
            });
        });

        return { success: true, orderId, qrData: JSON.stringify(qrPayload) };
    });

    /**
     * GET /api/v1/scan/door-entry?eventId=XXX
     */
    fastify.get('/door-entry', {
        preHandler: [fastify.validate({ querystring: DoorEntryQuery })]
    }, async (request: any, reply) => {
        const { eventId, eventCode } = request.query as any;
        if (!eventId) return reply.status(400).send({ error: 'eventId required' });
        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode })) {
            return scannerSessionError(reply);
        }
        const snap = await fastify.db.collection('orders').where('eventId', '==', eventId).where('source', '==', 'door').get();
        const byPaymentMethod: Record<string, number> = {};
        let doorRevenue = 0;
        snap.docs.forEach((d: any) => { doorRevenue += d.data().total || 0; const m = d.data().paymentMethod || 'cash'; byPaymentMethod[m] = (byPaymentMethod[m] || 0) + (d.data().total || 0); });
        const doorEntries = snap.docs.reduce((sum: number, d: any) => sum + sumOrderEntryCount(d.data()), 0);
        return { doorEntries, doorRevenue, byPaymentMethod };
    });

    // ── Walk-in Entries ───────────────────────────────────────────────────────

    /**
     * POST /api/v1/scan/walk-in
     * Log a walk-in guest (arrives without a ticket)
     */
    fastify.post('/walk-in', {
        preHandler: [fastify.validate({ body: WalkInBody })]
    }, async (request: any, reply) => {
        const { eventCode, eventId, venueId, guestName, guestAge, guestPhone, gate } = request.body as any;
        if (!eventCode || !eventId || !venueId || !guestName?.trim())
            return reply.status(400).send({ success: false, error: 'Missing required fields' });

        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode, venueId })) {
            return scannerSessionError(reply);
        }

        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', eventCode.toUpperCase()).limit(1).get();
        if (codeSnap.empty || codeSnap.docs[0].data().isRevoked)
            return reply.status(403).send({ success: false, error: 'Invalid or revoked event code' });

        const { randomUUID } = await import('node:crypto');
        const id = randomUUID();
        const now = new Date().toISOString();
        const phone = guestPhone?.trim() || '';

        const entry = {
            id, eventId, venueId,
            guestName: guestName.trim(),
            guestAge: guestAge ?? null,
            phoneFull: phone || null,
            phoneHash: phone ? phone.slice(-4) : '',
            gate: gate || null,
            eventCode: eventCode.toUpperCase(),
            partySize: 1,
            category: 'general',
            paymentMode: 'complimentary',
            amountPaise: 0,
            status: 'active',
            source: 'scanner',
            note: '',
            idempotencyKey: id,
            addedBy: `scanner_${eventCode.toUpperCase()}`,
            addedByName: 'Scanner App',
            addedAt: now,
            lastEditedBy: null,
            updatedAt: now,
        };

        await fastify.db
            .collection('walk_in_entries')
            .doc(eventId)
            .collection('logs')
            .doc(id)
            .set(entry);

        return { success: true, walkInId: id };
    });

    /**
     * GET /api/v1/scan/walk-in?eventId=&eventCode=
     * List recent walk-ins for the event (scanner app pull-to-refresh)
     */
    fastify.get('/walk-in', {
        preHandler: [fastify.validate({ querystring: WalkInQuery })]
    }, async (request: any, reply) => {
        const { eventId, eventCode, limit = '50' } = request.query as any;
        if (!eventId || !eventCode) return reply.status(400).send({ error: 'eventId and eventCode are required' });

        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode })) {
            return scannerSessionError(reply);
        }

        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', eventCode.toUpperCase()).limit(1).get();
        if (codeSnap.empty || codeSnap.docs[0].data().isRevoked)
            return reply.status(403).send({ error: 'Invalid or revoked event code' });

        const snap = await fastify.db
            .collection('walk_in_entries')
            .doc(eventId)
            .collection('logs')
            .where('status', '==', 'active')
            .orderBy('addedAt', 'desc')
            .limit(Number(limit))
            .get();

        return { walkIns: snap.docs.map((d: any) => ({ id: d.id, ...d.data(), phoneFull: undefined })) };
    });

    // ── Scanner Device Registration ───────────────────────────────────────────

    /**
     * POST /api/v1/scan/devices
     * Register or refresh a scanner device binding for a venue
     */
    fastify.post('/devices', {
        preHandler: [fastify.validate({ body: DeviceBody })]
    }, async (request: any, reply) => {
        const { deviceId, venueId, deviceName } = request.body as any;
        if (!deviceId || !venueId) return reply.status(400).send({ error: 'deviceId and venueId are required' });

        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { venueId })) {
            return scannerSessionError(reply);
        }

        const now = new Date().toISOString();
        const deviceRef = fastify.db.collection('bound_devices').doc(`${venueId}_${deviceId}`);
        const deviceDoc = await deviceRef.get();

        if (deviceDoc.exists) {
            await deviceRef.update({ lastActiveAt: now, deviceName: deviceName || deviceDoc.data()?.deviceName, bound: true, status: 'active' });
        } else {
            await deviceRef.set({ deviceId, venueId, deviceName: deviceName || 'Scanner Device', bound: true, status: 'active', registeredAt: now, lastActiveAt: now });
        }

        return { success: true, deviceId };
    });

    /**
     * POST /api/v1/scan/staff-deny
     * Fire-and-forget audit log when staff physically denies entry after a valid scan
     */
    fastify.post('/staff-deny', {
        preHandler: [fastify.validate({ body: StaffDenyBody })]
    }, async (request: any, reply) => {
        const { qrData, eventId, eventCode, gate, reason } = request.body as any;
        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode })) {
            return scannerSessionError(reply);
        }
        let payload: any = {};
        try { payload = JSON.parse(qrData); } catch {}
        await recordScanAttempt(fastify.db, {
            orderId: payload.o, eventId: eventId || payload.e, ticketId: payload.t,
            result: 'invalid', reason: `staff_override:${reason || 'unspecified'}`,
            scannedBy: { uid: `scanner_${eventCode}`, name: 'Scanner', role: 'door_staff' },
            device: { id: gate || 'door', bound: false }
        });
        return { success: true };
    });

    /**
     * POST /api/v1/scan/guestlist/check-in
     * Manual check-in from guestlist screen
     */
    fastify.post('/guestlist/check-in', {
        preHandler: [fastify.validate({ body: ManualCheckInBody })]
    }, async (request: any, reply) => {
        const { orderId, eventCode, eventId } = request.body as any;
        const auth = await validateScannerAccess(fastify, request);
        if (!auth.authorized) return scannerSessionError(reply);
        if (!matchesScannerContext(auth, { eventId, eventCode })) {
            return scannerSessionError(reply);
        }
        const codeSnap = await fastify.db.collection('event_codes')
            .where('code', '==', eventCode.toUpperCase()).limit(1).get();
        if (codeSnap.empty || codeSnap.docs[0].data().isRevoked)
            return reply.status(403).send({ error: 'Invalid event code' });

        const now = new Date().toISOString();
        await fastify.db.collection('orders').doc(orderId).update({
            status: 'checked_in', checkedInAt: now, checkInSource: 'manual_guestlist'
        });
        await recordScanAttempt(fastify.db, {
            orderId, eventId, result: 'valid',
            scannedBy: { uid: `scanner_${eventCode}`, name: 'Manual Guestlist', role: 'door_staff' },
            device: { id: 'guestlist', bound: false }
        });
        return { success: true };
    });

    /**
     * GET /api/v1/scan/entitlements/:id/qr
     * Generate a rotating QR code for an entitlement – owner only
     */
    fastify.get('/entitlements/:id/qr', {
        preHandler: [fastify.validate({ params: EntitlementsParam })]
    }, async (request: any, reply) => {
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
    });
}
