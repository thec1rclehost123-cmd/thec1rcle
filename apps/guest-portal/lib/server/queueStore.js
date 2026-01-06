import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import * as surgeCore from "@c1rcle/core";

export async function joinQueue(eventId, userId, deviceId) {
    if (!isFirebaseConfigured()) {
        return { id: "mock-queue-id", position: 1, status: "admitted", token: "mock-token" };
    }
    return surgeCore.joinQueue(getAdminDb(), eventId, userId, deviceId);
}

export async function getQueueStatus(queueId) {
    if (!isFirebaseConfigured()) {
        return { status: "admitted", position: 0, token: "mock-token" };
    }
    return surgeCore.getQueueStatus(getAdminDb(), queueId);
}

export async function admitUsers(eventId, count = 10) {
    if (!isFirebaseConfigured()) return 0;
    return surgeCore.admitUsers(getAdminDb(), eventId, count);
}

export async function validateAdmission(eventId, userId, token) {
    if (!isFirebaseConfigured()) return true;
    return surgeCore.validateAdmission(getAdminDb(), eventId, userId, token);
}

export async function consumeAdmission(queueId) {
    if (!isFirebaseConfigured()) return;
    return surgeCore.consumeAdmission(getAdminDb(), queueId);
}
