import { NextResponse } from 'next/server';
import { getOrderById } from '@/lib/server/orderStore';
import { getEvent } from '@/lib/server/eventStore';
import { getUserProfile } from '@/lib/server/profileStore';
import { generateTicketPDF } from '@/lib/email/generateTicketPDF';

/**
 * GET /api/tickets/download?orderId=xxx
 *
 * Generates and returns a PDF ticket for the given order.
 * Data is fetched via allowlisted store layer (no direct Firestore).
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    try {
        // Fetch order via store layer
        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Fetch event details via store layer
        let eventName = order.eventTitle || 'Event';
        let eventDate = '';
        let eventTime = '';
        let location = '';

        if (order.eventId) {
            const event = await getEvent(order.eventId);
            if (event) {
                eventName = event.title || eventName;
                location = event.location || event.venueLocation || '';

                if (event.startDate) {
                    const date = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                    eventDate = date.toLocaleDateString('en-IN', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        timeZone: 'Asia/Kolkata',
                    });
                    eventTime = date.toLocaleTimeString('en-IN', {
                        hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
                    });
                }
            }
        }

        // Fetch user display name — orders store userId, not userName
        let userName = 'Guest';
        if (order.userId) {
            try {
                const profile = await getUserProfile(order.userId);
                userName = profile?.displayName || profile?.name || 'Guest';
            } catch (_) { /* non-critical — fall back to Guest */ }
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
        return NextResponse.json({ error: 'Failed to generate ticket' }, { status: 500 });
    }
}
