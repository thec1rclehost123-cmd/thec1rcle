import type { Firestore } from 'firebase-admin/firestore';

const SOLD_TICKET_STATUSES = new Set(['active', 'used', 'transferred']);

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function getEventCommerceMetrics(db: Firestore, eventId: string) {
  const [ledgerSnapshot, ticketSnapshot] = await Promise.all([
    db.collection('partner_ledger').where('eventId', '==', eventId).get(),
    db.collection('tickets').where('eventId', '==', eventId).get(),
  ]);

  const ledgerEntries = ledgerSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
    .filter((entry) => entry.status !== 'reversed');
  const revenueEntries = ledgerEntries.filter((entry) => entry.type === 'ticket_revenue');
  const refundEntries = ledgerEntries.filter((entry) => entry.type === 'refund');
  const soldTickets = ticketSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
    .filter((ticket) => SOLD_TICKET_STATUSES.has(String(ticket.status || 'active')));

  const grossRevenuePaise = revenueEntries.reduce(
    (sum, entry) => sum + Number(entry.amountPaise || 0),
    0,
  );
  const refundPaise = Math.abs(
    refundEntries.reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0),
  );
  const netRevenuePaise = grossRevenuePaise - refundPaise;
  const orderRevenuePaise: Record<
    string,
    { grossPaise: number; refundPaise: number; netPaise: number }
  > = {};
  for (const entry of [...revenueEntries, ...refundEntries]) {
    if (!entry.orderId) continue;
    const row = orderRevenuePaise[entry.orderId] || {
      grossPaise: 0,
      refundPaise: 0,
      netPaise: 0,
    };
    if (entry.type === 'ticket_revenue') row.grossPaise += Number(entry.amountPaise || 0);
    else row.refundPaise += Math.abs(Number(entry.amountPaise || 0));
    row.netPaise = row.grossPaise - row.refundPaise;
    orderRevenuePaise[entry.orderId] = row;
  }

  return {
    grossRevenuePaise,
    grossRevenue: grossRevenuePaise / 100,
    refundPaise,
    refundAmount: refundPaise / 100,
    netRevenuePaise,
    netRevenue: netRevenuePaise / 100,
    ticketsSold: soldTickets.length,
    orderCount: new Set(revenueEntries.map((entry) => entry.orderId).filter(Boolean)).size,
    revenueEntries,
    refundEntries,
    ledgerEntries,
    orderRevenuePaise,
    soldTickets,
  };
}

export async function getPartnerCommerceRows(
  db: Firestore,
  partnerId: string,
  ticketPartnerField: 'hostId' | 'venueId' | 'promoterId',
): Promise<{
  ledger: Array<Record<string, any> & { createdAtIso: string | null }>;
  tickets: Array<Record<string, any> & { createdAtIso: string | null }>;
}> {
  const [ledgerSnapshot, ticketSnapshot] = await Promise.all([
    db.collection('partner_ledger').where('toPartnerId', '==', partnerId).get(),
    db.collection('tickets').where(ticketPartnerField, '==', partnerId).get(),
  ]);

  return {
    ledger: ledgerSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
      .filter((entry) => entry.status !== 'reversed')
      .map(
        (entry) =>
          ({ ...entry, createdAtIso: toIso(entry.createdAt) }) as Record<string, any> & {
            createdAtIso: string | null;
          },
      ),
    tickets: ticketSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
      .filter((ticket) => SOLD_TICKET_STATUSES.has(String(ticket.status || 'active')))
      .map(
        (ticket) =>
          ({
            ...ticket,
            createdAtIso: toIso(ticket.issuedAt || ticket.createdAt),
          }) as Record<string, any> & { createdAtIso: string | null },
      ),
  };
}

export async function getOrderCommerceAmounts(
  db: Firestore,
  orderIds: string[],
): Promise<Record<string, { grossPaise: number; refundPaise: number; netPaise: number }>> {
  const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
  const result: Record<string, { grossPaise: number; refundPaise: number; netPaise: number }> = {};
  for (let start = 0; start < uniqueOrderIds.length; start += 30) {
    const chunk = uniqueOrderIds.slice(start, start + 30);
    const snapshot = await db.collection('partner_ledger').where('orderId', 'in', chunk).get();
    for (const document of snapshot.docs) {
      const entry = document.data() as Record<string, any>;
      if (entry.status === 'reversed' || !entry.orderId) continue;
      const row = result[entry.orderId] || { grossPaise: 0, refundPaise: 0, netPaise: 0 };
      if (entry.type === 'ticket_revenue') {
        row.grossPaise += Number(entry.amountPaise || 0);
      } else if (entry.type === 'refund') {
        row.refundPaise += Math.abs(Number(entry.amountPaise || 0));
      }
      row.netPaise = row.grossPaise - row.refundPaise;
      result[entry.orderId] = row;
    }
  }
  return result;
}
