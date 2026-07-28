import { FieldPath } from 'firebase-admin/firestore';
import { buildOrderSearchPrefixes } from '@c1rcle/core/order-engine';
import { getAdminDb } from '@c1rcle/core/admin';

const PAGE_SIZE = 250;
const applyChanges = process.argv.includes('--apply');

function prefixesForOrder(id: string, order: Record<string, any>) {
  return buildOrderSearchPrefixes([
    id,
    order.buyerName,
    order.customerName,
    order.userName,
    order.name,
    order.buyerEmail,
    order.userEmail,
    order.email,
    order.buyerPhone,
    order.userPhone,
    order.phone,
    order.eventTitle,
    order.eventName,
    ...(Array.isArray(order.tickets)
      ? order.tickets.map((ticket: any) => ticket?.name || ticket?.tierName)
      : []),
  ]);
}

async function main() {
  const db = await getAdminDb();
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let changed = 0;

  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection('orders')
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    let writes = 0;
    for (const document of snapshot.docs) {
      scanned += 1;
      const next = prefixesForOrder(document.id, document.data());
      const current = Array.isArray(document.data()?.searchPrefixes)
        ? document.data().searchPrefixes
        : [];
      if (JSON.stringify(current) === JSON.stringify(next)) continue;

      changed += 1;
      if (applyChanges) {
        batch.update(document.ref, {
          searchPrefixes: next,
          searchPrefixesUpdatedAt: new Date().toISOString(),
        });
        writes += 1;
      }
    }
    if (writes > 0) await batch.commit();

    cursor = snapshot.docs[snapshot.docs.length - 1] || null;
    if (snapshot.size < PAGE_SIZE) break;
  }

  console.log(
    JSON.stringify({
      applyChanges,
      scanned,
      changed,
      message: applyChanges
        ? 'Order search prefixes backfilled'
        : 'Dry run only; rerun with --apply to write changes',
    }),
  );
}

await main();
