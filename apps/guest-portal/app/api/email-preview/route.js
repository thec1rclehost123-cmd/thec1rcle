/**
 * Email Preview Route
 * GET /api/email-preview
 * 
 * Renders the ticket confirmation email in the browser for testing.
 * Only available in development mode.
 */

import { NextResponse } from "next/server";
import { TicketEmail } from "@/components/emails/TicketEmail";



export async function GET(request) {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 404 });
    }

    const mockData = {
        userName: "Aayush Divase",
        eventName: "Neon Nights — Pune's Biggest Indoor Rave",
        eventDate: "Sat, Feb 15, 2026",
        eventTime: "9:00 PM — 3:00 AM",
        eventLocation: "ABC Farms, Koregaon Park, Pune 411001",
        eventVenue: "ABC Farms",
        eventPosterUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=400&fit=crop",
        eventUrl: "https://thec1rcle.com/event/neon-nights-pune",
        eventStartDate: "2026-02-15T21:00:00+05:30",
        eventEndDate: "2026-02-16T03:00:00+05:30",
        orderId: "ORD-M4X7K9-ABCDE",
        orderDate: "Feb 9, 2026, 7:06 PM",
        tickets: [
            { name: "General Admission (Stag)", quantity: 1, price: 999 },
            { name: "VIP Couple", quantity: 1, price: 2499 },
        ],
        totalAmount: 3498,
        isRSVP: false,
        qrCodeData: JSON.stringify({
            o: "ORD-M4X7K9-ABCDE",
            e: "neon-nights-pune",
            t: "ticket-ga-stag",
            sig: "a1b2c3d4e5f6g7h8",
            ts: Date.now(),
        }),
    };

    try {
        const { renderToStaticMarkup } = require("react-dom/server");
        const html = renderToStaticMarkup(TicketEmail(mockData));

        return new NextResponse(`<!DOCTYPE html>${html}`, {
            status: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    } catch (error) {
        console.error("[Email Preview] Render failed:", error);
        return NextResponse.json({
            error: "Failed to render email preview",
            details: error.message
        }, { status: 500 });
    }
}
