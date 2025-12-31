import { NextResponse } from "next/server";
import { verifyAuth } from "../../../../lib/server/auth";
import { validateAndScanTicket } from "../../../../lib/server/ticketShareStore";

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
