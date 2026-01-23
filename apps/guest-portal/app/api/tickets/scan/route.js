import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { validateAndScanTicket } from "@/lib/server/ticketShareStore";
import { processEntryScan } from "@c1rcle/core/entitlement-engine";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyQRPayload } from "@/lib/server/qrStore";

export async function POST(request) {
    try {
        const user = await verifyAuth();
        if (!user) {
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

        // SIGNED JSON QR FLOW (Standard Orders)
        if (parsedPayload && (parsedPayload.o || parsedPayload.e)) {
            const verification = verifyQRPayload(parsedPayload);
            if (!verification.valid) {
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

        // LEGACY FALLBACK
        const [ticketId, signature] = ticketPayload.split(":");
        if (!ticketId || !signature) {
            return NextResponse.json({
                status: "denied",
                reason: "invalid_format",
                message: "Invalid ticket format"
            });
        }

        const result = await validateAndScanTicket(ticketId, signature, eventId, scannerId || user.uid);

        if (result.valid) {
            return NextResponse.json({
                status: "approved",
                ticket: result.ticket
            });
        } else {
            const reasonMap = {
                invalid_signature: { status: "denied", message: "Invalid ticket (forged)" },
                already_used: { status: "denied", message: "Already used" },
                event_mismatch: { status: "denied", message: "Ticket is for a different event" },
                order_not_found: { status: "denied", message: "Ticket not found" },
                order_not_confirmed: { status: "denied", message: "Payment not confirmed" },
                cancelled: { status: "denied", message: "Ticket cancelled" }
            };

            const response = reasonMap[result.reason] || { status: "denied", message: "Access denied" };
            return NextResponse.json(response);
        }

    } catch (error) {
        console.error("Scan error:", error);
        return NextResponse.json({
            status: "error",
            message: "Internal server error"
        }, { status: 500 });
    }
}
