"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postChatMessageInternal = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_1 = require("./firebase");
/**
 * 1. Check if user has valid entitlement for event (Server-Side)
 * This prevents unauthorized messaging in group chats.
 */
async function checkServerEntitlement(userId, eventId) {
    try {
        // 1. Check confirmed orders (Purchased tickets)
        const ordersSnap = await firebase_1.db.collection("orders")
            .where("userId", "==", userId)
            .where("eventId", "==", eventId)
            .where("status", "in", ["confirmed", "checked_in"])
            .limit(1)
            .get();
        if (!ordersSnap.empty)
            return true;
        // 2. Check RSVP orders
        const rsvpSnap = await firebase_1.db.collection("rsvp_orders")
            .where("userId", "==", userId)
            .where("eventId", "==", eventId)
            .limit(1)
            .get();
        if (!rsvpSnap.empty)
            return true;
        // 3. Check if user is host/venue of the event
        const eventDoc = await firebase_1.db.collection("events").doc(eventId).get();
        if (eventDoc.exists) {
            const d = eventDoc.data();
            if ((d === null || d === void 0 ? void 0 : d.hostId) === userId || (d === null || d === void 0 ? void 0 : d.venueId) === userId || (d === null || d === void 0 ? void 0 : d.creatorId) === userId)
                return true;
        }
        return false;
    }
    catch (error) {
        console.error("[Chat] Entitlement check failed:", error);
        return false;
    }
}
/**
 * 2. Send Message Cloud Function
 * Handles Group Chat messages with entitlement checks and rate-limiting.
 */
const postChatMessageInternal = async (data, context) => {
    var _a, _b;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Login required');
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
    const lastMessageSnap = await firebase_1.db.collection("eventGroupMessages")
        .where("senderId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
    if (!lastMessageSnap.empty) {
        const lastMessage = lastMessageSnap.docs[0].data();
        const lastTime = ((_b = (_a = lastMessage.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(lastMessage.createdAt);
        const diffMs = Date.now() - lastTime.getTime();
        if (diffMs < 1000) { // 1 second cooldown
            throw new functions.https.HttpsError('resource-exhausted', 'Please slow down');
        }
    }
    // 3. Fetch User Profile for Denormalization
    const userSnap = await firebase_1.db.collection("users").doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    // 4. Construct Message Payload
    const messagePayload = {
        eventId,
        senderId: userId,
        senderName: (userData === null || userData === void 0 ? void 0 : userData.displayName) || "C1RCLE Member",
        senderAvatar: (userData === null || userData === void 0 ? void 0 : userData.photoURL) || null,
        senderBadge: (userData === null || userData === void 0 ? void 0 : userData.role) === 'host' ? 'host' : undefined,
        content: content.substring(0, 1000),
        type,
        isAnonymous: !!isAnonymous,
        isDeleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // 5. Commit to DB
    const res = await firebase_1.db.collection("eventGroupMessages").add(messagePayload);
    // 6. Update Event Chat Metadata (Last Message info)
    // Done out-of-band to prevent slowing down the client
    firebase_1.db.collection("events").doc(eventId).update({
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageContent: isAnonymous ? "Anonymous message" : content.substring(0, 50)
    }).catch(e => console.error("[Chat] Metadata update failed", e));
    return { success: true, messageId: res.id };
};
exports.postChatMessageInternal = postChatMessageInternal;
//# sourceMappingURL=chat.js.map