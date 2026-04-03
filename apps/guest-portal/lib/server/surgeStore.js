import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import * as surgeCore from "@c1rcle/core";

export async function recordMetric(eventId, type) {
    if (!isFirebaseConfigured()) return;
    try {
        return await surgeCore.recordSurgeMetric(getAdminDb(), eventId, type);
    } catch (error) {
        console.warn("[SurgeStore] Metric recording skipped:", error.message || error);
        return false;
    }
}

export async function getSurgeStatus(eventId) {
    if (!isFirebaseConfigured()) return { status: "normal" };
    return surgeCore.getSurgeStatus(getAdminDb(), eventId);
}
