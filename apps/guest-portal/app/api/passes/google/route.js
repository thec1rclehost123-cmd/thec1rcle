import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/passes/google?orderId=xxx
 * 
 * Generates a Google Wallet save URL for the given order.
 * 
 * Prerequisites (production):
 * - Google Cloud project with Google Wallet API enabled
 * - Service account with Wallet Object Issuer permissions
 * - Issuer ID configured in Google Pay & Wallet Console
 * 
 * The response contains a `saveUrl` that the mobile app opens to
 * add the pass to Google Wallet. Currently returns preview data
 * until Google Wallet credentials are configured.
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

        // Check if Google Wallet credentials are configured
        const hasGoogleCreds = process.env.GOOGLE_WALLET_ISSUER_ID &&
            process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY;

        if (hasGoogleCreds) {
            // Production: Generate JWT and create save URL
            //
            // 1. Create the event ticket object
            // const ticketObject = {
            //     id: `${ISSUER_ID}.${orderId}`,
            //     classId: `${ISSUER_ID}.${eventId}`,
            //     state: 'ACTIVE',
            //     ... (event ticket fields)
            // };
            //
            // 2. Sign JWT with service account
            // const token = jwt.sign({ ... }, serviceAccountKey);
            //
            // 3. Return save URL
            // return NextResponse.json({
            //     saveUrl: `https://pay.google.com/gp/v/save/${token}`,
            // });
        }

        // Return preview data with 501 status
        // The mobile app checks for response.ok (status 200) and falls back to PDF
        const startDate = eventData.startDate?.toDate
            ? eventData.startDate.toDate()
            : new Date(eventData.startDate || order.eventDate);

        const passData = {
            status: 'preview',
            message: 'Google Wallet pass generation requires Google Cloud credentials. Download the ticket as PDF instead.',
            pass: {
                eventName: eventData.title || order.eventTitle,
                venue: eventData.location || eventData.venueLocation || order.venue || 'TBA',
                dateTime: startDate.toISOString(),
                ticketType: order.tickets?.[0]?.tierName || 'General',
                quantity: order.quantity || 1,
                orderId: orderId.substring(0, 8).toUpperCase(),
                barcode: {
                    type: 'QR_CODE',
                    value: `C1RCLE:${orderId}`,
                },
            },
        };

        return NextResponse.json(passData, { status: 501 });

    } catch (error) {
        console.error('[Google Pass] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate Google Wallet pass' },
            { status: 500 }
        );
    }
}
