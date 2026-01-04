
import { NextResponse } from "next/server";
import { joinWaitlist, verifyWaitlistAccess } from "../../../lib/server/waitlistStore";
import { verifyAuth } from "../../../lib/server/auth";

import { joinWaitlistSchema, validateBody } from "../../../lib/server/validators";
import { withRateLimit } from "../../../lib/server/rateLimit";

async function handler(request) {
    try {
        const { data: payload, error } = await validateBody(request, joinWaitlistSchema);
        if (error) {
            return NextResponse.json({ error }, { status: 400 });
        }

        const { eventId, ticketId, email, phone } = payload;

        // Optional: Verify auth if user is logged in
        const decodedToken = await verifyAuth(request);
        const userId = decodedToken?.uid || null;
        const userEmail = decodedToken?.email || email;



        const entry = await joinWaitlist({
            eventId,
            ticketId,
            userId,
            email: userEmail,
            phone
        });

        return NextResponse.json({
            success: true,
            message: "Added to waitlist",
            entry
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const POST = withRateLimit(handler, 10);

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const email = searchParams.get("email");

    if (!eventId || !email) {
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const access = await verifyWaitlistAccess(eventId, email);

    return NextResponse.json({
        hasAccess: !!access,
        accessDetails: access
    });
}
