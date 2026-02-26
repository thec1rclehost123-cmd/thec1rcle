import { NextResponse } from 'next/server';
import { getOrderById } from '@/lib/server/orderStore';
import { getEvent } from '@/lib/server/eventStore';

/**
 * GET /api/passes/apple?orderId=xxx
 *
 * Generates an Apple Wallet pass (.pkpass) for the given order.
 * Data fetched via allowlisted store layer (no direct Firestore).
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    try {
        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        let eventData = {};
        if (order.eventId) {
            eventData = (await getEvent(order.eventId)) || {};
        }

        // Check if Apple Wallet certificates are configured
        const hasAppleCerts = process.env.APPLE_PASS_TYPE_ID &&
            process.env.APPLE_PASS_TEAM_ID &&
            process.env.APPLE_PASS_CERT_PATH;

        if (hasAppleCerts) {
            // Production: Generate actual .pkpass file
            // (Apple certificates not yet configured — see TODO)
        }

        // Safe date parsing — eventData.startDate may be undefined when event fetch fails
        let startDate = null;
        const rawDate = eventData.startDate || order.eventDate;
        if (rawDate) {
            try {
                const parsed = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
                if (!isNaN(parsed.getTime())) startDate = parsed;
            } catch (_) { /* leave startDate null */ }
        }

        const passData = {
            status: 'preview',
            message: 'Apple Wallet pass generation requires Apple Developer certificates. Download the ticket as PDF instead.',
            pass: {
                formatVersion: 1,
                organizationName: eventData.hostName || 'C1RCLE',
                description: `Ticket for ${eventData.title || order.eventTitle}`,
                serialNumber: orderId,
                eventTicket: {
                    headerFields: [
                        { key: 'event', label: 'EVENT', value: eventData.title || order.eventTitle },
                    ],
                    primaryFields: [
                        {
                            key: 'date',
                            label: 'DATE',
                            value: startDate
                                ? startDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
                                : 'TBA',
                        },
                        {
                            key: 'time',
                            label: 'TIME',
                            value: startDate
                                ? startDate.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                : 'TBA',
                        },
                    ],
                    secondaryFields: [
                        {
                            key: 'venue',
                            label: 'VENUE',
                            value: eventData.location || eventData.venueLocation || order.venue || 'TBA',
                        },
                        {
                            key: 'ticket',
                            label: 'TICKET',
                            value: order.tickets?.[0]?.tierName || 'General',
                        },
                    ],
                    auxiliaryFields: [
                        { key: 'qty', label: 'QTY', value: String(order.quantity || 1) },
                        { key: 'order', label: 'ORDER', value: orderId.substring(0, 8).toUpperCase() },
                    ],
                    backFields: [
                        { key: 'terms', label: 'TERMS', value: 'This ticket is non-transferable after entry. Present QR code at the door.' },
                    ],
                },
                barcode: {
                    message: `C1RCLE:${orderId}`,
                    format: 'PKBarcodeFormatQR',
                },
            },
        };

        return NextResponse.json(passData, { status: 501 });
    } catch (error) {
        console.error('[Apple Pass] Error:', error);
        return NextResponse.json({ error: 'Failed to generate Apple Wallet pass' }, { status: 500 });
    }
}
