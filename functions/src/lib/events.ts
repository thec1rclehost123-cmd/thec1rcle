import { db } from './firebase';

const EVENT_COLLECTION = "events";

export interface Event {
    id: string;
    title: string;
    tickets?: any[];
    [key: string]: any;
}

export async function getEvent(identifier: string): Promise<Event | null> {
    if (!identifier) return null;

    const directDoc = await db.collection(EVENT_COLLECTION).doc(identifier).get();
    if (directDoc.exists) {
        return { id: directDoc.id, ...directDoc.data() } as Event;
    }

    const slugSnapshot = await db
        .collection(EVENT_COLLECTION)
        .where("slug", "==", identifier)
        .limit(1)
        .get();

    if (!slugSnapshot.empty) {
        return { id: slugSnapshot.docs[0].id, ...slugSnapshot.docs[0].data() } as Event;
    }

    return null;
}
