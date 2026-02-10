import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/passes/apple?orderId=xxx
 * 
 * Generates an Apple Wallet pass (.pkpass) for the given order.
 * 
 * Prerequisites (production):
 * - Apple Developer pass certificates (.p12 / .pem)
 * - passkit-generator npm package
 * - Pass Type ID registered with Apple
 * 
 * Currently returns a structured JSON with pass data that the mobile
 * app uses for rendering a pass preview. When Apple certificates are
 * configured, this will return an actual .pkpass binary.
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    try {
        // Fetch order
        const orderDoc = await adminDb.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const order = { id: orderDoc.id, ...orderDoc.data() };

        // Fetch event details
        let eventData = {};
        if (order.eventId) {
            const eventDoc = await adminDb.collection('events').doc(order.eventId).get();
            if (eventDoc.exists) {
                eventData = eventDoc.data();
            }
        }

        // Check if Apple Wallet certificates are configured
        const hasAppleCerts = process.env.APPLE_PASS_TYPE_ID &&
            process.env.APPLE_PASS_TEAM_ID &&
            process.env.APPLE_PASS_CERT_PATH;

        if (hasAppleCerts) {
            // Production: Generate actual .pkpass file
            // This requires the passkit-generator package and valid Apple certificates
            //
            // const passkit = require('passkit-generator');
            // const pass = new passkit.PKPass({...});
            // const buffer = await pass.generate();
            //
            // return new NextResponse(buffer, {
            //     status: 200,
            //     headers: {
            //         'Content-Type': 'application/vnd.apple.pkpass',
            //         'Content-Disposition': `attachment; filename="pass-${orderId.substring(0, 8)}.pkpass"`,
            //     },
            // });

            // For now, return pass data as JSON (mobile app will show preview)
        }

        // Return pass data for preview rendering on mobile
        const startDate = eventData.startDate?.toDate
            ? eventData.startDate.toDate()
            : new Date(eventData.startDate || order.eventDate);

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
                            value: startDate.toLocaleDateString('en-IN', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                            }),
                        },
                        {
                            key: 'time',
                            label: 'TIME',
                            value: startDate.toLocaleTimeString('en-IN', {
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZone: 'Asia/Kolkata',
                            }),
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

        // Return 501 to indicate the feature is not yet fully implemented
        // The mobile app checks for status 200 and falls back to PDF
        return NextResponse.json(passData, { status: 501 });

    } catch (error) {
        console.error('[Apple Pass] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate Apple Wallet pass' },
            { status: 500 }
        );
    }
}
