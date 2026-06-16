import { NextRequest, NextResponse } from 'next/server';
import { requirePromoterAccess } from '@/lib/server/promoterAuthMiddleware';
import { getAdminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const ctx = await requirePromoterAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  const eventId = searchParams.get('eventId');

  if (!orderId || !eventId) {
    return NextResponse.json({ success: false, case: 'error', message: 'Missing params' });
  }

  try {
    const db = getAdminDb();
    const orderSnap = await db.collection('orders').doc(orderId).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ success: true, case: 'invalid' });
    }

    const order = orderSnap.data();
    if (order?.status !== 'confirmed' && order?.status !== 'completed') {
      return NextResponse.json({ success: true, case: 'invalid' });
    }

    if (order.eventId !== eventId) {
      return NextResponse.json({ success: true, case: 'wrong_event' });
    }

    if (order.promoterId) {
      return NextResponse.json({ success: true, case: 'already_assigned' });
    }

    // Success case
    let ticketCount = 1;
    if (Array.isArray(order.tickets)) {
      ticketCount = order.tickets.reduce((sum: number, t: any) => sum + (t.quantity || 1), 0);
    } else if (order.quantity) {
      ticketCount = order.quantity;
    }

    return NextResponse.json({
      success: true,
      case: 'can_assign',
      order: {
        guestName: order.userName || order.customerName || 'Guest',
        userEmail: order.userEmail || order.customerEmail || 'N/A',
        eventName: order.eventName || 'Event',
        totalAmount: order.totalAmount || order.amount || 0,
        ticketCount: ticketCount,
        checkedIn: order.checkedIn || false,
      },
    });
  } catch (err: any) {
    console.error('Lookup error:', err);
    return NextResponse.json({ success: false, case: 'error', message: err.message });
  }
}
