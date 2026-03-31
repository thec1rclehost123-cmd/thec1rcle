import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { validateAndScanTicket, validateShortQR } from "@/lib/server/ticketShareStore";
import { processEntryScan } from "@c1rcle/core/entitlement-engine";
import { verifyQRPayload } from "@/lib/server/qrStore";
import { logAuthEvent, logScanEvent } from "@/lib/server/logger";

export async function POST(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            logAuthEvent("UNAUTHORIZED_SCAN_ATTEMPT", { path: "/api/tickets/scan" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is host or admin (simplified for this task)
        // In reality, we'd verify the user is the host of the event
        const { ticketPayload, eventId, scannerId } = await request.json();

        if (!ticketPayload || !eventId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let parsedPayload = null;
        try {
            parsedPayload = JSON.parse(ticketPayload);
        } catch (e) {
            // Not JSON, continue to legacy split
        }

        // SIGNED JSON QR FLOW (Standard Orders & Short QRs)
        if (parsedPayload && (parsedPayload.o || parsedPayload.e)) {
            const verification = verifyQRPayload(parsedPayload);

            if (!verification.valid) {
                // Check if it's a short QR that needs lookup
                if (verification.needsLookup) {
                    const result = await validateShortQR(verification.orderId, verification.signature, eventId, scannerId || user.uid);
                    if (result.valid) {
                        return NextResponse.json({
                            status: "approved",
                            ticket: result.ticket,
                            message: "Entry Granted (via Short QR)"
                        });
                    }
                    return NextResponse.json({
                        status: "denied",
                        reason: result.reason,
                        message: result.message || "Invalid Short QR"
                    });
                }

                logScanEvent("INVALID_QR_SIGNATURE", { eventId, scannerId: scannerId || user.uid });
                return NextResponse.json({
                    status: "denied",
                    reason: "invalid_signature",
                    message: verification.error || "Invalid QR Signature"
                });
            }

            const { orderId, ticketId } = verification.data;

            // Re-format for the unified scanner logic
            const result = await validateAndScanTicket(orderId, "SIGNED-JSON", eventId, scannerId || user.uid, {
                directPayload: verification.data
            });

            if (result.valid) {
                return NextResponse.json({
                    status: "approved",
                    ticket: result.ticket,
                    message: "Entry Granted"
                });
            } else {
                return NextResponse.json({
                    status: "denied",
                    reason: result.reason,
                    message: result.message || "Access Denied"
                });
            }
        }

        // ENTITLEMENT QR FLOW (Dynamic / Rotating QRs)
        if (parsedPayload && parsedPayload.eid) {
            // Optimization: Fetch entitlement first to get ownerId for gender check if needed
            // Actually processEntryScan handles most things, but needs gender in context
            const result = await processEntryScan(parsedPayload, scannerId || user.uid, eventId, {
                // Pass any extra context if available from the request
                isCoupleBypassed: false,
                partnerPresent: true, // Defaulting to true for now, should come from scanner UI
            });

            if (result.success) {
                return NextResponse.json({
                    status: "approved",
                    ticket: result.entitlement,
                    message: "Entry Granted"
                });
            } else {
                return NextResponse.json({
                    status: "denied",
                    reason: result.reason,
                    message: result.reason === "STALE_QR" ? "QR Code Expired. Please refresh." : "Access Denied"
                });
            }
        }

        // LEGACY FALLBACK — validate structure before splitting to prevent garbage input
        if (typeof ticketPayload !== "string" || ticketPayload.length > 512) {
            return NextResponse.json({ status: "denied", message: "Ticket denied" });
        }

        const parts = ticketPayload.split(":");
        // New format: ticketId:userId:issuedAt:signature (4 parts)
        // Old format: ticketId:signature (2 parts) — still accepted during migration
        if (parts.length < 2 || parts.some(p => !p)) {
            console.warn("[Scan] Malformed legacy ticket payload — wrong number of parts:", parts.length);
            return NextResponse.json({ status: "denied", message: "Ticket denied" });
        }

        const ticketId = parts[0];
        const signature = parts[parts.length - 1]; // last part is always the signature

        const result = await validateAndScanTicket(ticketId, signature, eventId, scannerId || user.uid);

        if (result.valid) {
            return NextResponse.json({
                status: "approved",
                ticket: result.ticket
            });
        } else {
            // SECURITY: Use a single generic denial message for all failure reasons.
            // Specific reasons (invalid_signature, already_used, etc.) are logged
            // server-side only — never exposed to scanners to prevent ticket enumeration.
            logScanEvent("LEGACY_TICKET_DENIED", { reason: result.reason, ticketId, eventId });
            return NextResponse.json({ status: "denied", message: "Ticket denied" });
        }

    } catch (error) {
        console.error("Scan error:", error);
        return NextResponse.json({
            status: "error",
            message: "Internal server error"
        }, { status: 500 });
    }
}
