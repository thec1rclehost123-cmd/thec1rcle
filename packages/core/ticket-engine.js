/**
 * THE C1RCLE - Master Ticket Engine
 * Centralizes ticket sharing, transfers, and assignment logic.
 */

import { randomBytes, createHmac } from "node:crypto";
import { getTicketSecret } from "./secret-registry.js";

const TICKET_SECRET = getTicketSecret();

/**
 * Signs a ticket ID for QR verification.
 */
export function signTicketId(ticketId) {
    const signature = createHmac("sha256", TICKET_SECRET)
        .update(ticketId)
        .digest("hex"); // full 64-char SHA-256 — was truncated to 16, giving only 64 bits of entropy
    return `${ticketId}:${signature}`;
}

/**
 * Generates a random secure token.
 */
export function generateSecureToken(length = 16) {
    return randomBytes(length).toString("hex");
}

/**
 * Validates a share bundle's status and expiration.
 */
export function validateBundle(bundle) {
    const now = new Date();
    if (bundle.status !== "active") return { valid: false, reason: "Bundle is not active" };
    if (bundle.remainingSlots <= 0) return { valid: false, reason: "No slots remaining" };
    if (new Date(bundle.expiresAt) < now) return { valid: false, reason: "Bundle expired" };
    return { valid: true };
}

/**
 * Validates a transfer's status and expiration.
 */
export function validateTransfer(transfer, recipientId) {
    const now = new Date();
    if (transfer.status !== "pending") return { valid: false, reason: "Transfer is not pending" };
    if (new Date(transfer.expiresAt) < now) return { valid: false, reason: "Transfer expired" };
    if (transfer.senderId === recipientId) return { valid: false, reason: "Sender and recipient are the same" };
    return { valid: true };
}

export default {
    signTicketId,
    generateSecureToken,
    validateBundle,
    validateTransfer
};
