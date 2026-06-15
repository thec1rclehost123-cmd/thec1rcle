require('dotenv').config({ path: 'apps/admin-console/.env.local' });
require('dotenv').config({ path: 'apps/partner-dashboard/.env.development' });

const { getAdminApp, getAdminDb } = require('./apps/admin-console/lib/firebase/admin');

async function test() {
  try {
    const db = getAdminDb();
    const collection = 'admins';

    let query = db.collection(collection);
    const ORDER_MAP = {
      admin_audit_logs: ['timestamp', 'desc'],
      events: ['startDate', 'desc'],
      onboarding_requests: ['submittedAt', 'desc'],
    };
    const defaultOrder = ['createdAt', 'desc'];
    const [field, dir] = ORDER_MAP[collection] || defaultOrder;

    try {
      query = query.orderBy(field, dir);
    } catch (_) {}

    console.log('Fetching snapshot...');
    const snapshot = await query.limit(50).get();

    console.log('Snapshot fetched, docs:', snapshot.empty ? 0 : snapshot.docs.length);
    const results = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        timestamp: d.timestamp?.toDate?.()?.toISOString() || d.ts?.toDate?.()?.toISOString(),
        createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt,
        submittedAt: d.submittedAt?.toDate?.()?.toISOString(),
        ts: d.ts?.toDate?.()?.toISOString() || d.ts,
      };
    });

    console.log('Results mapped successfully.');
    console.log(JSON.stringify(results[0]));
  } catch (e) {
    console.error('ERROR CAUGHT:');
    console.error(e.message);
    console.error(e.stack);
  }
}

test();
