import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import * as surgeCore from "@c1rcle/core";

export async function recordMetric(eventId, type) {
    if (!isFirebaseConfigured()) return;
    return surgeCore.recordSurgeMetric(getAdminDb(), eventId, type);
}

export async function getSurgeStatus(eventId) {
    if (!isFirebaseConfigured()) return { status: "normal" };
    return surgeCore.getSurgeStatus(getAdminDb(), eventId);
}
