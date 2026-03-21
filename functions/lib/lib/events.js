"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvent = void 0;
const firebase_1 = require("./firebase");
const EVENT_COLLECTION = "events";
async function getEvent(identifier) {
    if (!identifier)
        return null;
    const directDoc = await firebase_1.db.collection(EVENT_COLLECTION).doc(identifier).get();
    if (directDoc.exists) {
        return Object.assign({ id: directDoc.id }, directDoc.data());
    }
    const slugSnapshot = await firebase_1.db
        .collection(EVENT_COLLECTION)
        .where("slug", "==", identifier)
        .limit(1)
        .get();
    if (!slugSnapshot.empty) {
        return Object.assign({ id: slugSnapshot.docs[0].id }, slugSnapshot.docs[0].data());
    }
    return null;
}
exports.getEvent = getEvent;
//# sourceMappingURL=events.js.map