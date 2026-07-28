import dotenv from 'dotenv';

dotenv.config({
  path: ['thec1rcle.nosync/apps/api-gateway/.env.development'],
  quiet: true,
});

const email = process.env.QA_GUEST_EMAIL ?? 'qa_guest_2026@test.c1rcle.com';
const { getAdminAuth, getAdminDb } = await import('../packages/core/admin.js');
const db = getAdminDb();
const user = await getAdminAuth().getUserByEmail(email);

async function timed(name, task) {
  const startedAt = performance.now();
  try {
    const result = await task();
    return {
      name,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      count: result?.docs?.length ?? null,
      result,
      error: null,
    };
  } catch (error) {
    return {
      name,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      count: null,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const reads = await Promise.all([
  timed('candidate-events', () =>
    db
      .collection('events')
      .where('lifecycle', 'in', ['scheduled', 'live'])
      .where('isDeleted', '==', false)
      .limit(100)
      .get(),
  ),
  timed('candidate-event-cards', () =>
    db
      .collection('event_card_index')
      .where('visibility', '==', 'public')
      .where('startAt', '>=', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .orderBy('startAt', 'asc')
      .limit(100)
      .get(),
  ),
  timed('orders', () => db.collection('orders').where('userId', '==', user.uid).limit(50).get()),
  timed('rsvp-orders', () =>
    db.collection('rsvp_orders').where('userId', '==', user.uid).limit(50).get(),
  ),
  timed('category-signals', () =>
    db
      .collection('recommendation_profiles')
      .doc(user.uid)
      .collection('categories')
      .orderBy('lastBrowsedAt', 'desc')
      .limit(20)
      .get(),
  ),
]);

const eventIds = [
  ...new Set(
    reads
      .filter((read) => read.name === 'orders' || read.name === 'rsvp-orders')
      .flatMap((read) => read.result?.docs || [])
      .map((doc) => doc.data()?.eventId)
      .filter(Boolean),
  ),
];
const historyRead =
  eventIds.length > 0
    ? await timed('history-events', () =>
        db.collection('events').where('__name__', 'in', eventIds.slice(0, 10)).get(),
      )
    : null;

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      uid: user.uid,
      reads: [...reads, historyRead]
        .filter(Boolean)
        .map(({ name, elapsedMs, count, error }) => ({ name, elapsedMs, count, error })),
    },
    null,
    2,
  ),
);
