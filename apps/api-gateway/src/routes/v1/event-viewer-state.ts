import {
    getEventQueueStatus,
    getEventSurgeStatus,
} from '@c1rcle/core/guest-event-conversion';

export async function getEventViewerState(db: any, eventId: string, userId: string | null) {
    const surgeStatus = await getEventSurgeStatus(db, eventId);
    if (!userId) {
        return {
            hasRsvped: false,
            queue: null,
            surgeActive: surgeStatus?.status === 'surge',
        };
    }

    const [userDoc, queueSnapshot] = await Promise.all([
        db.collection('users').doc(userId).get(),
        db.collection('event_queues')
            .where('eventId', '==', eventId)
            .where('userId', '==', userId)
            .where('status', 'in', ['waiting', 'admitted', 'payment_failed'])
            .limit(1)
            .get(),
    ]);

    const userData = userDoc.exists ? userDoc.data() || {} : {};
    const attendedEvents = Array.isArray(userData.attendedEvents) ? userData.attendedEvents : [];
    let queue = null;

    if (!queueSnapshot.empty) {
        const queueDoc = queueSnapshot.docs[0];
        try {
            queue = await getEventQueueStatus(db, queueDoc.id);
        } catch {
            queue = { id: queueDoc.id, ...queueDoc.data() };
        }
    }

    return {
        hasRsvped: attendedEvents.includes(eventId),
        queue,
        surgeActive: surgeStatus?.status === 'surge',
    };
}
