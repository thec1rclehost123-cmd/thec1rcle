import { verifyScanSignature, validateScannerDevice, recordScanAttempt } from '@c1rcle/core/scan-engine';
import { randomBytes, createHmac } from 'node:crypto';
import { z } from 'zod';
const ScanBody = z.object({
    qrData: z.any(),
    eventId: z.string().optional(),
    deviceId: z.string().optional(),
    venueId: z.string().optional(),
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
    createdBy: z.string().optional()
}).strict();
const CodeIdParam = z.object({ id: z.string() }).strict();
const DeleteCodesBody = z.object({ revokedBy: z.string().optional() }).strict();
const AuthBody = z.object({ code: z.string() }).strict();
const StatsQuery = z.object({ code: z.string() }).strict();
const GuestlistQuery = z.object({ eventId: z.string() }).strict();
const DoorEntryBody = z.object({
    eventCode: z.string(),
    eventId: z.string(),
    guestName: z.string(),
    guestPhone: z.string().optional(),
    tierId: z.string(),
    tierName: z.string().optional(),
    entryType: z.string().optional(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    totalAmount: z.number().optional(),
    paymentMethod: z.string().optional(),
    gate: z.string().optional()
}).strict();
const DoorEntryQuery = z.object({ eventId: z.string() }).strict();
const EntitlementsParam = z.object({ id: z.string() }).strict();
const QR_SECRET = process.env.QR_SECRET_KEY || 'c1rcle-qr-secret-2024';
export default async function scanRoutes(fastify) {
    // ── Core QR Scan Processing ───────────────────────────────────────────────
    /**
     * POST /api/v1/scan
     * Process a QR scan
     */
    fastify.post('/', {
        preHandler: [fastify.validate({ body: ScanBody })]
    }, async (request, reply) => {
        const { qrData, eventId, deviceId, venueId, scannedBy } = request.body;
        if (!qrData)
            return reply.status(400).send({ error: 'QR data is required' });
        let payload;
        try {
            payload = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
        }
        catch (e) {
            return reply.status(400).send({ error: 'Invalid QR format', result: 'invalid' });
        }
        const isSignatureValid = verifyScanSignature(payload);
        if (!isSignatureValid) {
            await recordScanAttempt(fastify.db, { orderId: payload.o, eventId: eventId || payload.e, result: 'invalid', reason: 'Signature mismatch', scannedBy, deviceId });
            return reply.status(400).send({ error: 'Invalid signature', result: 'invalid' });
        }
        if (deviceId && venueId) {
            const deviceCheck = await validateScannerDevice(fastify.db, deviceId, venueId);
            if (!deviceCheck.valid)
                return reply.status(403).send({ error: deviceCheck.error, result: 'device_invalid' });
            await deviceCheck.ref.update({ lastActiveAt: new Date().toISOString() });
        }
        const orderRef = fastify.db.collection('orders').doc(payload.o);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists)
            return reply.status(404).send({ error: 'Order not found', result: 'not_found' });
        const order = orderDoc.data();
        const existingScan = await fastify.db.collection('ticket_scans')
            .where('orderId', '==', payload.o).where('ticketId', '==', payload.t).where('result', '==', 'valid').limit(1).get();
        if (!existingScan.empty) {
            await recordScanAttempt(fastify.db, { orderId: payload.o, eventId: payload.e, ticketId: payload.t, result: 'already_scanned', scannedBy, deviceId });
            return reply.status(400).send({ error: 'Ticket already scanned', result: 'already_scanned', previousScan: { scannedAt: existingScan.docs[0].data().scannedAt, scannedBy: existingScan.docs[0].data().scannedBy } });
        }
        const scanRef = await recordScanAttempt(fastify.db, {
            orderId: payload.o, eventId: payload.e, ticketId: payload.t, userId: payload.u,
            quantity: payload.q, entryType: payload.et || 'general', result: 'valid', scannedBy,
            device: deviceId ? { id: deviceId, bound: true } : { id: null, bound: false }
        });
        if (order?.status === 'confirmed') {
            await orderRef.update({ status: 'checked_in', checkedInAt: new Date().toISOString(), lastScanId: scanRef.id });
        }
        return {
            success: true, result: 'valid', scanId: scanRef.id,
            ticket: { orderId: payload.o, eventId: payload.e, eventTitle: order?.eventTitle, userName: order?.userName, userEmail: order?.userEmail },
            message: `✓ Entry approved! Welcome, ${order?.userName || 'Guest'}.`
        };
    });
    /**
     * GET /api/v1/scan/history?eventId=XXX
     */
    fastify.get('/history', {
        preHandler: [fastify.validate({ querystring: HistoryQuery })]
    }, async (request, reply) => {
        const { eventId, limit = 100 } = request.query;
        if (!eventId)
            return reply.status(400).send({ error: 'eventId is required' });
        const snapshot = await fastify.db.collection('ticket_scans')
            .where('eventId', '==', eventId).orderBy('scannedAt', 'desc').limit(Number(limit)).get();
        return { scans: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
    });
    // ── Event Code Management ─────────────────────────────────────────────────
    /**
     * GET /api/v1/scan/codes?eventId=XXX
     */
    fastify.get('/codes', {
        preHandler: [fastify.validate({ querystring: CodesQuery })]
    }, async (request, reply) => {
        const { eventId } = request.query;
        if (!eventId)
            return reply.status(400).send({ error: 'eventId required' });
        const snap = await fastify.db.collection('event_codes')
            .where('eventId', '==', eventId).orderBy('createdAt', 'desc').get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
    /**
     * POST /api/v1/scan/codes
     */
    fastify.post('/codes', {
        preHandler: [fastify.validate({ body: CodesBody })]
    }, async (request, reply) => {
        const { eventId, type = 'full', gate, expiresAt, createdBy } = request.body;
        if (!eventId)
            return reply.status(400).send({ error: 'eventId required' });
        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists)
            return reply.status(404).send({ error: 'Event not found' });
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
    }, async (request, reply) => {
        const { id } = request.params;
        const { revokedBy } = request.body || {};
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
    }, async (request, reply) => {
        const { code } = request.body;
        if (!code)
            return reply.status(400).send({ valid: false, error: 'code required' });
        const normalizedCode = code.toUpperCase().trim();
        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', normalizedCode).limit(1).get();
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
        await codeDoc.ref.update({ lastUsedAt: new Date().toISOString(), usageCount: (codeData.usageCount || 0) + 1 });
        const [scansSnap, doorOrdersSnap] = await Promise.all([
            fastify.db.collection('ticket_scans').where('eventId', '==', codeData.eventId).where('result', '==', 'valid').get(),
            fastify.db.collection('orders').where('eventId', '==', codeData.eventId).where('source', '==', 'door').get()
        ]);
        const prebookedEntered = scansSnap.docs.filter((d) => d.data().source !== 'door').length;
        const doorEntries = doorOrdersSnap.docs.length;
        const doorRevenue = doorOrdersSnap.docs.reduce((s, d) => s + (d.data().total || 0), 0);
        const tiers = (event?.tickets || []).map((t) => ({ id: t.id || t.ticketId, name: t.name, price: t.price || 0, entryType: t.entryType || 'general', available: (t.remaining || t.quantity || 0) > 0 }));
        return {
            valid: true, code: normalizedCode,
            event: { id: eventDoc.id, title: event?.title, venue: event?.venueName, venueId: event?.venueId, date: event?.date, startTime: event?.startTime, endTime: event?.endTime, capacity: event?.capacity || 500, imageUrl: event?.coverImage },
            permissions: {
                canScan: codeData.type === 'full' || codeData.type === 'scan_only',
                canDoorEntry: codeData.type === 'full',
                canCharge: codeData.type === 'charge', // Cover Wallet debit mode
            },
            tiers, gate: codeData.gate || null,
            stats: { totalEntered: prebookedEntered + doorEntries, prebooked: prebookedEntered, doorEntries, doorRevenue }
        };
    });
    /**
     * GET /api/v1/scan/auth?eventId=XXX – list codes for an event
     */
    fastify.get('/auth', {
        preHandler: [fastify.validate({ querystring: CodesQuery })]
    }, async (request, reply) => {
        const { eventId } = request.query;
        if (!eventId)
            return reply.status(400).send({ error: 'eventId required' });
        const snap = await fastify.db.collection('event_codes').where('eventId', '==', eventId).orderBy('createdAt', 'desc').get();
        return { codes: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
    });
    // ── Real-time Scan Stats ──────────────────────────────────────────────────
    /**
     * GET /api/v1/scan/stats?code=C1R-XXXXXX
     */
    fastify.get('/stats', {
        preHandler: [fastify.validate({ querystring: StatsQuery })]
    }, async (request, reply) => {
        const { code } = request.query;
        if (!code)
            return reply.status(400).send({ error: 'code required' });
        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', code.toUpperCase().trim()).limit(1).get();
        if (codeSnap.empty)
            return reply.status(404).send({ error: 'Invalid event code' });
        const codeData = codeSnap.docs[0].data();
        if (codeData.isRevoked)
            return reply.status(403).send({ error: 'Code revoked' });
        const [scansSnap, doorSnap] = await Promise.all([
            fastify.db.collection('ticket_scans').where('eventId', '==', codeData.eventId).where('result', '==', 'valid').get(),
            fastify.db.collection('orders').where('eventId', '==', codeData.eventId).where('source', '==', 'door').get()
        ]);
        const prebookedScans = scansSnap.docs.filter((d) => d.data().source !== 'door');
        const doorRevenue = doorSnap.docs.reduce((s, d) => s + (d.data().total || 0), 0);
        const byEntryType = {};
        scansSnap.docs.forEach((d) => { const et = d.data().entryType || 'general'; byEntryType[et] = (byEntryType[et] || 0) + (d.data().quantity || 1); });
        const totalEntered = prebookedScans.reduce((s, d) => s + (d.data().quantity || 1), 0) + doorSnap.docs.length;
        return { totalEntered, prebooked: prebookedScans.length, doorEntries: doorSnap.docs.length, doorRevenue, byEntryType };
    });
    // ── Guest List ────────────────────────────────────────────────────────────
    /**
     * GET /api/v1/scan/guestlist?eventId=XXX
     */
    fastify.get('/guestlist', {
        preHandler: [fastify.validate({ querystring: GuestlistQuery })]
    }, async (request, reply) => {
        const { eventId } = request.query;
        if (!eventId)
            return reply.status(400).send({ error: 'eventId required' });
        const [ordersSnap, scansSnap] = await Promise.all([
            fastify.db.collection('orders').where('eventId', '==', eventId).where('status', 'in', ['confirmed', 'checked_in']).get(),
            fastify.db.collection('ticket_scans').where('eventId', '==', eventId).where('result', '==', 'valid').get()
        ]);
        const scannedIds = new Set();
        const scanTimes = new Map();
        scansSnap.docs.forEach((d) => { scannedIds.add(d.data().orderId); scanTimes.set(d.data().orderId, d.data().scannedAt); });
        const guests = ordersSnap.docs.map((doc) => {
            const order = doc.data();
            const ticket = order.tickets?.[0] || {};
            const entered = scannedIds.has(doc.id) || order.status === 'checked_in';
            return { id: doc.id, name: order.userName || 'Guest', ticketType: ticket.name || 'Entry', entryType: ticket.entryType || 'general', quantity: ticket.quantity || 1, source: order.source || 'online', status: entered ? 'entered' : 'not_entered', enteredAt: scanTimes.get(doc.id) || order.checkedInAt || null };
        });
        guests.sort((a, b) => a.status !== b.status ? (a.status === 'not_entered' ? -1 : 1) : a.name.localeCompare(b.name));
        return { guests };
    });
    // ── Door Entry (Walk-up Sales) ────────────────────────────────────────────
    /**
     * POST /api/v1/scan/door-entry
     */
    fastify.post('/door-entry', {
        preHandler: [fastify.validate({ body: DoorEntryBody })]
    }, async (request, reply) => {
        const { eventCode, eventId, guestName, guestPhone, tierId, tierName, entryType, quantity = 1, unitPrice = 0, totalAmount = 0, paymentMethod = 'cash', gate } = request.body;
        if (!eventCode || !eventId || !guestName || !tierId)
            return reply.status(400).send({ success: false, error: 'Missing required fields' });
        const codeSnap = await fastify.db.collection('event_codes').where('code', '==', eventCode.toUpperCase()).limit(1).get();
        if (codeSnap.empty)
            return reply.status(403).send({ success: false, error: 'Invalid event code' });
        const codeData = codeSnap.docs[0].data();
        if (codeData.type !== 'full')
            return reply.status(403).send({ success: false, error: 'Door entry not permitted for this code' });
        const now = new Date().toISOString();
        const orderId = `DOOR-${randomBytes(4).toString('hex').toUpperCase()}`;
        const ticketId = `TKT-${randomBytes(3).toString('hex').toUpperCase()}`;
        const ts = Date.now();
        const qrPayload = { o: orderId, e: eventId, t: ticketId, n: tierName, u: `guest_${ts}`, q: quantity, et: entryType || 'general', ts, v: 1 };
        qrPayload.sig = createHmac('sha256', QR_SECRET).update(`${orderId}:${eventId}:${ticketId}:${qrPayload.u}:${quantity}:${ts}`).digest('hex').substring(0, 16);
        await fastify.db.runTransaction(async (tx) => {
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
                'stats.doorEntriesCount': (codeData.stats?.doorEntriesCount || 0) + 1,
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
    }, async (request, reply) => {
        const { eventId } = request.query;
        if (!eventId)
            return reply.status(400).send({ error: 'eventId required' });
        const snap = await fastify.db.collection('orders').where('eventId', '==', eventId).where('source', '==', 'door').get();
        const byPaymentMethod = {};
        let doorRevenue = 0;
        snap.docs.forEach((d) => { doorRevenue += d.data().total || 0; const m = d.data().paymentMethod || 'cash'; byPaymentMethod[m] = (byPaymentMethod[m] || 0) + (d.data().total || 0); });
        return { doorEntries: snap.docs.length, doorRevenue, byPaymentMethod };
    });
    /**
     * GET /api/v1/scan/entitlements/:id/qr
     * Generate a rotating QR code for an entitlement – owner only
     */
    fastify.get('/entitlements/:id/qr', {
        preHandler: [fastify.validate({ params: EntitlementsParam })]
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: 'Unauthorized' });
        const entDoc = await fastify.db.collection('entitlements').doc(id).get();
        if (!entDoc.exists)
            return reply.status(404).send({ error: 'Entitlement not found' });
        const entitlement = entDoc.data();
        if (entitlement.ownerUserId !== userId) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const { generateEntitlementQR } = await import('@c1rcle/core/entitlement-engine');
        const qr = generateEntitlementQR(id);
        return { ...qr, rawData: JSON.stringify(qr) };
    });
}
//# sourceMappingURL=scan.js.map