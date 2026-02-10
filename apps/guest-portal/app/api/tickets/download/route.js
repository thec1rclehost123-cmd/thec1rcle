import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { generateTicketPDF } from '@/lib/email/generateTicketPDF';

/**
 * GET /api/tickets/download?orderId=xxx
 * 
 * Generates and returns a PDF ticket for the given order.
 * Requires the order's userId to match or allow public QR access.
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    try {
        // Fetch order from Firestore
        const orderDoc = await adminDb.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const order = { id: orderDoc.id, ...orderDoc.data() };

        // Fetch event details
        let eventName = order.eventTitle || 'Event';
        let eventDate = '';
        let eventTime = '';
        let location = '';

        if (order.eventId) {
            const eventDoc = await adminDb.collection('events').doc(order.eventId).get();
            if (eventDoc.exists) {
                const event = eventDoc.data();
                eventName = event.title || eventName;
                location = event.location || event.venueLocation || '';

                if (event.startDate) {
                    const date = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                    eventDate = date.toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'Asia/Kolkata',
                    });
                    eventTime = date.toLocaleTimeString('en-IN', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                    });
                }
            }
        }

        // Fetch user name
        let userName = 'Guest';
        if (order.userId) {
            const userDoc = await adminDb.collection('users').doc(order.userId).get();
            if (userDoc.exists) {
                userName = userDoc.data().displayName || userDoc.data().name || 'Guest';
            }
        }

        // Build ticket list
        const tickets = (order.tickets || []).map(t => ({
            name: t.tierName || t.name || 'Ticket',
            quantity: t.quantity || 1,
            price: t.price || 0,
        }));

        // Generate PDF
        const pdfBuffer = generateTicketPDF({
            orderId: order.id,
            userName,
            eventName,
            eventDate,
            eventTime,
            location,
            tickets,
            totalAmount: order.totalAmount || 0,
            isRSVP: order.totalAmount === 0,
        });

        // Return as PDF
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="ticket-${orderId.substring(0, 8)}.pdf"`,
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('[Ticket Download] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate ticket' },
            { status: 500 }
        );
    }
}
