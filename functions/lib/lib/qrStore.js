"use strict";
/**
 * QR Code Store
 * Generates and validates QR codes for tickets
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderQRCodes = exports.parseQRCode = exports.verifyQRPayload = exports.generateQRCodeData = exports.generateQRPayload = void 0;
const node_crypto_1 = require("node:crypto");
// Secret key for HMAC signing (should be in env vars in production)
const QR_SECRET = process.env.QR_SECRET_KEY || "c1rcle-qr-secret-2024";
/**
 * Generate QR code payload for a ticket
 * The QR code contains a signed JSON payload that can be verified at entry
 */
function generateQRPayload({ orderId, eventId, ticketId, ticketTierName, userId, quantity = 1, entryType = "general", isRSVP = false }) {
    const timestamp = Date.now();
    // Create the payload
    const payload = {
        o: orderId,
        e: eventId,
        t: ticketId,
        n: ticketTierName,
        u: userId,
        q: quantity,
        et: entryType,
        rt: isRSVP ? 1 : 0,
        ts: timestamp,
        v: 1 // Version for future compatibility
    };
    // Create signature
    const dataToSign = `${orderId}:${eventId}:${ticketId}:${userId}:${quantity}:${timestamp}:${isRSVP ? 'RSVP' : 'PAID'}`;
    const signature = (0, node_crypto_1.createHmac)("sha256", QR_SECRET)
        .update(dataToSign)
        .digest("hex")
        .substring(0, 16); // Shortened for QR efficiency
    payload.sig = signature;
    return payload;
}
exports.generateQRPayload = generateQRPayload;
/**
 * Generate QR code data URL
 * Returns a base64 encoded SVG that can be displayed directly
 */
function generateQRCodeData(payload) {
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
exports.generateQRCodeData = generateQRCodeData;
/**
 * Verify a QR code payload
 * Returns verification result with decoded data
 */
function verifyQRPayload(payload) {
    try {
        // Validate required fields
        if (!payload.o || !payload.e || !payload.t || !payload.sig) {
            return { valid: false, error: "Invalid QR code format" };
        }
        const isRSVP = payload.rt === 1;
        // Recreate the signature
        const dataToSign = `${payload.o}:${payload.e}:${payload.t}:${payload.u}:${payload.q}:${payload.ts}:${isRSVP ? 'RSVP' : 'PAID'}`;
        const expectedSignature = (0, node_crypto_1.createHmac)("sha256", QR_SECRET)
            .update(dataToSign)
            .digest("hex")
            .substring(0, 16);
        if (payload.sig !== expectedSignature) {
            return { valid: false, error: "Invalid signature - QR code may be tampered" };
        }
        // Check if QR is too old (older than 48 hours before event)
        // This is a soft check - the actual validation happens at scan time
        const qrAge = Date.now() - payload.ts;
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
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
    }
    catch (error) {
        return { valid: false, error: "Failed to parse QR code" };
    }
}
exports.verifyQRPayload = verifyQRPayload;
/**
 * Parse QR code from scan
 * Handles both full JSON and short URL format
 */
function parseQRCode(scanData) {
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
    }
    catch (_a) {
        return null;
    }
}
exports.parseQRCode = parseQRCode;
/**
 * Generate all QR codes for an order
 * Returns an array of QR payloads, one per ticket in the order
 */
function generateOrderQRCodes(order, event) {
    const qrCodes = [];
    const isRSVP = (event === null || event === void 0 ? void 0 : event.isRSVP) || order.isRSVP || order.id.startsWith("RSVP");
    for (const ticket of order.tickets) {
        // Generate one QR per quantity unit if needed
        // For simplicity, we generate one QR per ticket tier with quantity
        const payload = generateQRPayload({
            orderId: order.id,
            eventId: order.eventId,
            ticketId: ticket.ticketId,
            ticketTierName: ticket.name,
            userId: order.userId,
            quantity: ticket.quantity,
            entryType: ticket.entryType || "general",
            isRSVP: isRSVP
        });
        const qrData = generateQRCodeData(payload);
        qrCodes.push({
            ticketId: ticket.ticketId,
            ticketName: ticket.name,
            quantity: ticket.quantity,
            entryType: ticket.entryType || "general",
            isRSVP: isRSVP,
            qrPayload: payload,
            qrCode: qrData.rawData,
            shortCode: qrData.shortData
        });
    }
    return qrCodes;
}
exports.generateOrderQRCodes = generateOrderQRCodes;
//# sourceMappingURL=qrStore.js.map