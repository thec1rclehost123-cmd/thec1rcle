import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './firebase';

/**
 * 1. Check if user has valid entitlement for event (Server-Side)
 * This prevents unauthorized messaging in group chats.
 */
async function checkServerEntitlement(userId: string, eventId: string): Promise<boolean> {
    try {
        // 1. Check confirmed orders (Purchased tickets)
        const ordersSnap = await db.collection("orders")
            .where("userId", "==", userId)
            .where("eventId", "==", eventId)
            .where("status", "in", ["confirmed", "checked_in"])
            .limit(1)
            .get();

        if (!ordersSnap.empty) return true;

        // 2. Check RSVP orders
        const rsvpSnap = await db.collection("rsvp_orders")
            .where("userId", "==", userId)
            .where("eventId", "==", eventId)
            .limit(1)
            .get();

        if (!rsvpSnap.empty) return true;

        // 3. Check if user is host/venue of the event
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (eventDoc.exists) {
            const d = eventDoc.data();
            if (d?.hostId === userId || d?.venueId === userId || d?.creatorId === userId) return true;
        }

        return false;
    } catch (error) {
        console.error("[Chat] Entitlement check failed:", error);
        return false;
    }
}

/**
 * 2. Send Message Cloud Function
 * Handles Group Chat messages with entitlement checks and rate-limiting.
 */
export const postChatMessageInternal = async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
    const userId = context.auth.uid;
    const { eventId, content, isAnonymous, type = 'text' } = data;

    if (!eventId || !content) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing eventId or content');
    }

    // 1. Entitlement Check
    const isAllowed = await checkServerEntitlement(userId, eventId);
    if (!isAllowed) {
        throw new functions.https.HttpsError('permission-denied', 'You need a ticket to join this conversation');
    }

    // 2. Simple Rate Limiting (Prevent flood)
    // In production, use Redis or a sharded counter. 
    // For now, we check the last message timestamp in Firestore for this user.
    const lastMessageSnap = await db.collection("eventGroupMessages")
        .where("senderId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

    if (!lastMessageSnap.empty) {
        const lastMessage = lastMessageSnap.docs[0].data();
        const lastTime = lastMessage.createdAt?.toDate?.() || new Date(lastMessage.createdAt);
        const diffMs = Date.now() - lastTime.getTime();
        if (diffMs < 1000) { // 1 second cooldown
            throw new functions.https.HttpsError('resource-exhausted', 'Please slow down');
        }
    }

    // 3. Fetch User Profile for Denormalization
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    // 4. Construct Message Payload
    const messagePayload = {
        eventId,
        senderId: userId,
        senderName: userData?.displayName || "C1RCLE Member",
        senderAvatar: userData?.photoURL || null,
        senderBadge: userData?.role === 'host' ? 'host' : undefined,
        content: content.substring(0, 1000), // Basic length limit
        type,
        isAnonymous: !!isAnonymous,
        isDeleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 5. Commit to DB
    const res = await db.collection("eventGroupMessages").add(messagePayload);

    // 6. Update Event Chat Metadata (Last Message info)
    // Done out-of-band to prevent slowing down the client
    db.collection("events").doc(eventId).update({
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageContent: isAnonymous ? "Anonymous message" : content.substring(0, 50)
    }).catch(e => console.error("[Chat] Metadata update failed", e));

    return { success: true, messageId: res.id };
};
