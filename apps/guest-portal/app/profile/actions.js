"use server";

import { getUserEvents as getUserEventsStore, getUserProfile } from "../../lib/server/profileStore";

export async function getUserEvents(profileUserId, viewerUserId) {
    return await getUserEventsStore(profileUserId, viewerUserId);
}

export async function fetchProfile(userId) {
    return await getUserProfile(userId);
}
