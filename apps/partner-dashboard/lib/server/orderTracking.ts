import { FieldValue } from 'firebase-admin/firestore';

type OrderSource = 'ticket' | 'rsvp';

export function toIso(value: any): string | null {
  return value?.toDate?.()?.toISOString?.() ?? value ?? null;
}

export function toNumber(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function buildOrderNumber(order: Record<string, any>, orderId: string): string {
  if (order.orderNumber) return String(order.orderNumber);
  if (order.orderIndex) return `#${String(order.orderIndex).padStart(8, '0')}`;
  return `#${String(orderId || '')
    .slice(0, 8)
    .toUpperCase()}`;
}

export function getOrderAmount(order: Record<string, any>): number {
  return toNumber(
    order.totalAmount ?? order.amount ?? order.total ?? order.grossAmount ?? order.value ?? 0,
  );
}

export function getTicketsCount(order: Record<string, any>): number {
  if (Array.isArray(order.tickets)) {
    return order.tickets.reduce((sum, ticket) => sum + toNumber(ticket?.quantity || 1), 0);
  }
  return toNumber(order.quantity || 1);
}

export function getOrderCustomerName(order: Record<string, any>): string {
  return (
    order.customerName || order.userName || order.buyerName || order.displayName || 'C1RCLE Guest'
  );
}

export function getOrderEmail(order: Record<string, any>): string {
  return String(order.customerEmail || order.userEmail || order.email || order.buyerEmail || '');
}

export function getOrderPhone(order: Record<string, any>): string {
  return String(order.customerPhone || order.userPhone || order.phone || order.buyerPhone || '');
}

export function normalizeOrderRecord(
  doc: FirebaseFirestore.DocumentSnapshot,
  source: OrderSource = 'ticket',
) {
  const data = doc.data() || {};
  const createdAt = toIso(data.createdAt) || new Date().toISOString();
  const ticketItems = Array.isArray(data.tickets)
    ? data.tickets.map((ticket: any, index: number) => ({
        id: ticket.ticketId || ticket.id || `${doc.id}-item-${index}`,
        name: ticket.name || ticket.tierName || ticket.ticketTypeName || 'Ticket',
        quantity: toNumber(ticket.quantity || 1),
        price: toNumber(ticket.finalPrice ?? ticket.subtotal ?? ticket.price ?? ticket.amount ?? 0),
      }))
    : [
        {
          id: `${doc.id}-item-0`,
          name: data.tierName || data.ticketTypeName || 'Ticket',
          quantity: getTicketsCount(data),
          price: getOrderAmount(data),
        },
      ];

  return {
    id: doc.id,
    orderIndex: data.orderIndex ? toNumber(data.orderIndex) : null,
    orderNumber: buildOrderNumber(data, doc.id),
    eventId: String(data.eventId || ''),
    hostId: String(data.hostId || data.partnerId || ''),
    creatorId: String(data.creatorId || ''),
    eventName: String(data.eventName || data.eventTitle || 'Upcoming Event'),
    eventImage: String(data.eventImage || data.coverImage || ''),
    customerName: getOrderCustomerName(data),
    email: getOrderEmail(data),
    phone: getOrderPhone(data),
    amount: getOrderAmount(data),
    ticketsCount: getTicketsCount(data),
    createdAt,
    confirmedAt: toIso(data.confirmedAt),
    checkedInAt: toIso(data.checkedInAt || data.scannedAt),
    cancelledAt: toIso(data.cancelledAt),
    updatedAt: toIso(data.updatedAt),
    status: String(data.status || 'confirmed'),
    source,
    tags: Array.isArray(data.tags) ? data.tags : [],
    promoterCode: data.promoterCode || null,
    note: data.orderSummary || data.notes || null,
    opsLog: Array.isArray(data.opsLog)
      ? data.opsLog.map((entry: any, index: number) => ({
          id: entry.id || `${doc.id}-ops-${index}`,
          type: entry.type || 'note',
          actorUid: entry.actorUid || null,
          actorName: entry.actorName || null,
          note: entry.note || null,
          mode: entry.mode || null,
          createdAt: toIso(entry.createdAt) || createdAt,
        }))
      : [],
    items: ticketItems,
  };
}

export async function getOrderDocumentById(
  db: FirebaseFirestore.Firestore,
  orderId: string,
): Promise<{ doc: FirebaseFirestore.DocumentSnapshot; source: OrderSource } | null> {
  const [orderDoc, rsvpDoc] = await Promise.all([
    db.collection('orders').doc(orderId).get(),
    db.collection('rsvp_orders').doc(orderId).get(),
  ]);

  if (orderDoc.exists) return { doc: orderDoc, source: 'ticket' };
  if (rsvpDoc.exists) return { doc: rsvpDoc, source: 'rsvp' };
  return null;
}

export function attendeeMatchesOrder(
  order: Record<string, any>,
  identity: { attendeeId?: string; email?: string; phone?: string },
) {
  const attendeeId = String(identity.attendeeId || '');
  const email = normalizeValue(identity.email);
  const phone = normalizePhone(identity.phone);

  const orderUserId = String(order.userId || order.buyerId || '');
  const orderEmail = normalizeValue(getOrderEmail(order));
  const orderPhone = normalizePhone(getOrderPhone(order));

  return Boolean(
    (attendeeId && orderUserId && attendeeId === orderUserId) ||
    (email && orderEmail && email === orderEmail) ||
    (phone && orderPhone && phone === orderPhone),
  );
}

export function normalizeValue(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function normalizePhone(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

export function buildOpsLogEntry(payload: {
  type: string;
  actorUid: string;
  actorName?: string | null;
  note?: string | null;
  mode?: string | null;
}) {
  return {
    id: `${payload.type}-${Date.now()}`,
    type: payload.type,
    actorUid: payload.actorUid,
    actorName: payload.actorName || null,
    note: payload.note || null,
    mode: payload.mode || null,
    createdAt: new Date().toISOString(),
  };
}

export function appendOpsLog(update: Record<string, unknown>, entry: Record<string, unknown>) {
  return {
    ...update,
    opsLog: FieldValue.arrayUnion(entry),
    updatedAt: new Date().toISOString(),
  };
}
