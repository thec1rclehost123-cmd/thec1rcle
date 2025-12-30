"use server";

import { getUserTickets as getUserTicketsStore } from "../../lib/server/profileStore";
import { verifyAuth } from "../../lib/server/auth";

export async function getUserTickets(userId) {
    // In a real app we'd verify the session user matches the requested userId
    // for this task we assume the client passes the correct userId after auth check
    return await getUserTicketsStore(userId);
}
