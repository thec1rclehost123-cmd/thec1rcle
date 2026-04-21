"use server";

import { fetchGuestProfile } from "../../lib/server/gp5GatewayBridge.js";

export async function getUserEvents(profileUserId, viewerUserId) {
    const result = await fetchGuestProfile(profileUserId);
    return result.events;
}

export async function fetchProfile(userId) {
    const result = await fetchGuestProfile(userId);
    return result.profile;
}
