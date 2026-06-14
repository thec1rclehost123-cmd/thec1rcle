import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/server/orderStore";
import { getEvent } from "@/lib/server/eventStore";

/**
 * GET /api/passes/google?orderId=xxx
 *
 * Generates a Google Wallet save URL for the given order.
 * Data fetched via allowlisted store layer (no direct Firestore).
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let eventData = {};
    if (order.eventId) {
      eventData = (await getEvent(order.eventId)) || {};
    }

    // Check if Google Wallet credentials are configured
    const hasGoogleCreds =
      process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY;

    if (hasGoogleCreds) {
      // Production: Generate JWT and create save URL
      // (Google Wallet credentials not yet configured — see TODO)
    }

    // Safe date parsing — eventData.startDate may be undefined when event fetch fails
    let dateTimeIso;
    const rawDate = eventData.startDate || order.eventDate;
    if (rawDate) {
      try {
        const parsed = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
        if (!isNaN(parsed.getTime())) dateTimeIso = parsed.toISOString();
      } catch (_) {
        /* leave dateTimeIso undefined */
      }
    }

    const passData = {
      status: "preview",
      message:
        "Google Wallet pass generation requires Google Cloud credentials. Download the ticket as PDF instead.",
      pass: {
        eventName: eventData.title || order.eventTitle,
        venue: eventData.location || eventData.venueLocation || order.venue || "TBA",
        ...(dateTimeIso && { dateTime: dateTimeIso }),
        ticketType: order.tickets?.[0]?.tierName || "General",
        quantity: order.quantity || 1,
        orderId: orderId.substring(0, 8).toUpperCase(),
        barcode: {
          type: "QR_CODE",
          value: `C1RCLE:${orderId}`,
        },
      },
    };

    return NextResponse.json(passData, { status: 501 });
  } catch (error) {
    console.error("[Google Pass] Error:", error);
    return NextResponse.json({ error: "Failed to generate Google Wallet pass" }, { status: 500 });
  }
}
