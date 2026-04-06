import { NextResponse } from "next/server";
import { verifyAuth } from "../../../lib/server/auth";
import { getUserTickets } from "../../../lib/server/profileStore";

/**
 * GET /api/tickets
 *
 * Returns the authenticated user's grouped tickets.
 * Replaces the "getUserTickets" Server Action — GET is correct here
 * because this is a pure read with no side effects.
 *
 * Auth: reads from __session cookie (set by /api/auth/session on login)
 * or Authorization: Bearer <token> header.
 */
export async function GET(request) {
    try {
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await getUserTickets(decodedToken.uid);
        return NextResponse.json(data);
    } catch (error) {
        console.error("[GET /api/tickets]", error);
        return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
    }
}
