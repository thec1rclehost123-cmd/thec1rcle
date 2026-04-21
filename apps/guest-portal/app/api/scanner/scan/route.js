import { NextResponse } from "next/server";
import { validateScannerCode, ScannerAuthError } from "@/lib/server/scannerAuth";
import { validateAndScanTicket, validateShortQR } from "@/lib/server/ticketShareStore";
import { processEntryScan } from "@c1rcle/core/entitlement-engine";
import { verifyQRPayload } from "@/lib/server/qrStore";
import { logScanEvent } from "@/lib/server/logger";

/**
 * POST /api/scanner/scan
 * Header: X-Scanner-Code: <code>
 * Body: { qrData: string, eventId: string }
 *
 * Full QR validation pipeline — mirrors /api/tickets/scan but uses scanner
 * session auth instead of Firebase token auth.
 *
 * Response (approved):
 *   { status: "approved", ticket: { userName, ticketName, quantity, entryType }, message }
 *
 * Response (denied):
 *   { status: "denied", reason, message, previousScan? }
 */
export async function POST(request) {
    try {
        const session = await validateScannerCode(request);

        if (!session.canScan) {
            return NextResponse.json(
                { status: "denied", message: "This scanner code does not have scan permission" },
                { status: 403 }
            );
        }

        const { qrData, eventId } = await request.json();

        if (!qrData || !eventId) {
            return NextResponse.json(
                { status: "denied", message: "Missing qrData or eventId" },
                { status: 400 }
            );
        }

        // Guard: ensure the scanned eventId matches this session's event
        if (eventId !== session.eventId) {
            logScanEvent("WRONG_EVENT_SCAN", { eventId, sessionEventId: session.eventId, code: session.code });
            return NextResponse.json({ status: "denied", message: "Ticket denied" });
        }

        const scannerId = session.code;

        // ── 1. Try to parse as JSON ──────────────────────────────────────────
        let parsedPayload = null;
        try {
            parsedPayload = JSON.parse(qrData);
        } catch {
            // Not JSON — fall through to legacy path
        }

        // ── 2. Signed JSON (standard orders + short QRs) ────────────────────
        if (parsedPayload && (parsedPayload.o || parsedPayload.e)) {
            const verification = verifyQRPayload(parsedPayload);

            if (!verification.valid) {
                if (verification.needsLookup) {
                    const result = await validateShortQR(
                        verification.orderId,
                        verification.signature,
                        eventId,
                        scannerId
                    );
                    if (result.valid) {
                        return NextResponse.json({
                            status: "approved",
                            ticket: normalizeTicket(result.ticket),
                            message: "Entry Granted",
                        });
                    }
                    return NextResponse.json(buildDenial(result));
                }

                logScanEvent("INVALID_QR_SIGNATURE", { eventId, scannerId });
                return NextResponse.json({ status: "denied", message: "Ticket denied" });
            }

            const result = await validateAndScanTicket(
                verification.data.orderId,
                "SIGNED-JSON",
                eventId,
                scannerId,
                { directPayload: verification.data }
            );

            if (result.valid) {
                return NextResponse.json({
                    status: "approved",
                    ticket: normalizeTicket(result.ticket),
                    message: "Entry Granted",
                });
            }
            return NextResponse.json(buildDenial(result));
        }

        // ── 3. Entitlement QR (rotating / magic tickets) ────────────────────
        if (parsedPayload && parsedPayload.eid) {
            const result = await processEntryScan(parsedPayload, scannerId, eventId, {
                isCoupleBypassed: false,
                partnerPresent: true,
            });

            if (result.success) {
                return NextResponse.json({
                    status: "approved",
                    ticket: normalizeTicket(result.entitlement),
                    message: "Entry Granted",
                });
            }
            return NextResponse.json({
                status: "denied",
                message: result.reason === "STALE_QR" ? "QR Code Expired. Please refresh." : "Ticket denied",
            });
        }

        // ── 4. Legacy colon-separated format ────────────────────────────────
        if (typeof qrData !== "string" || qrData.length > 512) {
            return NextResponse.json({ status: "denied", message: "Ticket denied" });
        }

        const parts = qrData.split(":");
        if (parts.length < 2 || parts.some((p) => !p)) {
            logScanEvent("MALFORMED_LEGACY_QR", { eventId, scannerId });
            return NextResponse.json({ status: "denied", message: "Ticket denied" });
        }

        const ticketId = parts[0];
        const signature = parts[parts.length - 1];
        const result = await validateAndScanTicket(ticketId, signature, eventId, scannerId);

        if (result.valid) {
            return NextResponse.json({
                status: "approved",
                ticket: normalizeTicket(result.ticket),
                message: "Entry Granted",
            });
        }

        logScanEvent("LEGACY_TICKET_DENIED", { reason: result.reason, ticketId, eventId });
        return NextResponse.json(buildDenial(result));

    } catch (error) {
        if (error instanceof ScannerAuthError) {
            return NextResponse.json({ status: "denied", message: error.message }, { status: error.status });
        }
        console.error("POST /api/scanner/scan error", error);
        return NextResponse.json({ status: "error", message: "Internal server error" }, { status: 500 });
    }
}

/** Normalize ticket object to a consistent shape for the scanner-app. */
function normalizeTicket(ticket) {
    if (!ticket) return null;
    return {
        orderId: ticket.orderId || ticket.id || "",
        userName: ticket.userName || ticket.guestName || ticket.displayName || "Guest",
        ticketName: ticket.ticketName || ticket.tierName || ticket.name || "Entry",
        quantity: Number(ticket.quantity) || 1,
        entryType: ticket.entryType || ticket.gender || "general",
    };
}

/** Build a consistent denial response, including previousScan info when available. */
function buildDenial(result) {
    const response = { status: "denied", message: result.message || "Ticket denied" };
    if (result.reason === "already_used" && result.scannedAt) {
        response.previousScan = {
            scannedAt: result.scannedAt,
            scannedBy: result.scannedBy || "",
        };
    }
    return response;
}
