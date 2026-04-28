import { createHmac } from "node:crypto";
import { MAGIC_TICKET_THRESHOLD } from "./entitlement-engine.js";
import { getQrSecret } from "./secret-registry.js";

/**
 * @deprecated Use entitlement-engine.js for all QR and entry truth.
 * guest-qr-engine is maintained for legacy static QR verification only.
 */
console.warn("[Deprecation] guest-qr-engine is deprecated. Use entitlement-engine for all new ticket flows.");

// Secret key for HMAC signing
const QR_SECRET = getQrSecret();

/**
 * Generate QR code payload for a ticket
 * The QR code contains a signed JSON payload that can be verified at entry
 */
export function generateQRPayload({
    orderId,
    eventId,
    ticketId,
    ticketTierName,
    userId,
    quantity = 1,
    entryType = "general",
    isRSVP = false
}) {
    const timestamp = Date.now();

    // Create the payload
    const payload = {
        o: orderId,           // Order ID
        e: eventId,           // Event ID
        t: ticketId,          // Ticket tier ID
        n: ticketTierName,    // Ticket name (for display)
        u: userId,            // User ID
        q: quantity,          // Quantity
        et: entryType,        // Entry type (stag, couple, etc.)
        rt: isRSVP ? 1 : 0,    // RSVP Type (1 = RSVP, 0 = Paid)
        ts: timestamp,        // Timestamp
        v: 1                  // Version for future compatibility
    };

    // Create signature
    const dataToSign = `${orderId}:${eventId}:${ticketId}:${userId}:${quantity}:${timestamp}:${isRSVP ? 'RSVP' : 'PAID'}`;
    const signature = createHmac("sha256", QR_SECRET)
        .update(dataToSign)
        .digest("hex")
        .substring(0, 16); // Shortened for QR efficiency

    payload.sig = signature;

    return payload;
}

/**
 * Generate QR code data URL
 * Returns a base64 encoded SVG that can be displayed directly
 */
export function generateQRCodeData(payload) {
    // Convert payload to compact JSON string
    const data = JSON.stringify(payload);

    // For server-side QR generation, we'll return the raw data
    // The client will use a QR library to render it
    return {
        rawData: data,
        // Shortened URL format for compact QR
        shortData: `c1r://${payload.o}/${payload.sig}`
    };
}

/**
 * Verify a QR code payload
 * Returns verification result with decoded data
 */
export function verifyQRPayload(payload) {
    try {
        // Handle short QR format (needs lookup before verification)
        if (payload.isShort && payload.o && payload.sig) {
            return { valid: false, needsLookup: true, orderId: payload.o, signature: payload.sig };
        }

        // Validate required fields
        if (!payload.o || !payload.e || !payload.t || !payload.sig) {
            return { valid: false, error: "Invalid QR code format" };
        }

        const isRSVP = payload.rt === 1;

        // Recreate the signature
        const dataToSign = `${payload.o}:${payload.e}:${payload.t}:${payload.u}:${payload.q}:${payload.ts}:${isRSVP ? 'RSVP' : 'PAID'}`;
        const expectedSignature = createHmac("sha256", QR_SECRET)
            .update(dataToSign)
            .digest("hex")
            .substring(0, 16);

        if (payload.sig !== expectedSignature) {
            return { valid: false, error: "Invalid signature - QR code may be tampered" };
        }

        // Check if QR is too old (max 30 days)
        const qrAge = Date.now() - payload.ts;
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        if (qrAge > maxAge) {
            return { valid: false, error: "QR code has expired" };
        }

        return {
            valid: true,
            data: {
                orderId: payload.o,
                eventId: payload.e,
                ticketId: payload.t,
                ticketName: payload.n,
                userId: payload.u,
                quantity: payload.q,
                entryType: payload.et,
                isRSVP: isRSVP,
                generatedAt: new Date(payload.ts).toISOString(),
                version: payload.v
            }
        };
    } catch (error) {
        return { valid: false, error: "Failed to parse QR code" };
    }
}

/**
 * Parse QR code from scan
 * Handles both full JSON and short URL format
 */
export function parseQRCode(scanData) {
    try {
        // Try parsing as JSON first
        if (scanData.startsWith("{")) {
            return JSON.parse(scanData);
        }

        // Handle short URL format: c1r://orderId/signature
        if (scanData.startsWith("c1r://")) {
            const parts = scanData.replace("c1r://", "").split("/");
            if (parts.length >= 2) {
                return {
                    o: parts[0],
                    sig: parts[1],
                    isShort: true
                };
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Generate all QR codes for an order.
 *
 * Smart Ticket filter:
 *   price > MAGIC_TICKET_THRESHOLD (₹5,000) → qrMode:'magic'
 *     No static QR payload is generated. The mobile app generates the live
 *     rotating QR from entitlementId (linked by the Inngest fulfillment pipeline).
 *     Screenshots become invalid within 30 seconds.
 *
 *   price ≤ MAGIC_TICKET_THRESHOLD or RSVP → qrMode:'static'
 *     Classic signed HMAC QR. Screenshot-friendly. Single-use enforced at scan time.
 */
export function generateOrderQRCodes(order, event) {
    const qrCodes = [];
    const isRSVP = event?.isRSVP || order.isRSVP || order.id.startsWith("RSVP");

    for (const ticket of order.tickets) {
        const ticketPrice = Number(ticket.price ?? ticket.unitPrice ?? 0);
        // [SECURITY HARDENING] All tickets now use 'magic' rotating QR mode.
        // The static path is preserved only for legacy verification of old tickets.
        const isMagic = true; 

        if (isMagic) {
            // Magic Ticket: entitlementId populated by Inngest after payment confirmation.
            // Mobile app calls generateEntitlementQR(entitlementId) every 30s to render QR.
            qrCodes.push({
                ticketId: ticket.ticketId,
                ticketName: ticket.name,
                quantity: ticket.quantity,
                entryType: ticket.entryType || "general",
                isRSVP: false,
                qrMode: 'magic',
                entitlementIds: [],   // Array — one per quantity unit, filled by Inngest
                qrPayload: null,
                qrData: null,
                shortCode: null
            });
        } else {
            // Static Ticket: signed HMAC payload, single-use enforced at scanner.
            const payload = generateQRPayload({
                orderId: order.id,
                eventId: order.eventId,
                ticketId: ticket.ticketId,
                ticketTierName: ticket.name,
                userId: order.userId,
                quantity: ticket.quantity,
                entryType: ticket.entryType || "general",
                isRSVP
            });

            const qrData = generateQRCodeData(payload);

            qrCodes.push({
                ticketId: ticket.ticketId,
                ticketName: ticket.name,
                quantity: ticket.quantity,
                entryType: ticket.entryType || "general",
                isRSVP,
                qrMode: 'static',
                qrPayload: payload,
                qrData: qrData.rawData,
                shortCode: qrData.shortData
            });
        }
    }

    return qrCodes;
}
