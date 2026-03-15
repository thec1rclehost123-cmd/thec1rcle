import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Mock global guest data
        const mockGuests = {
            totalAllowance: 150,
            totalUsed: 115,
            guests: [
                { id: "g_101", name: "Alice Smith", event: "Neon Nights", tickets: 2, status: "attending", dateAdded: "2024-03-12T10:00:00Z" },
                { id: "g_102", name: "Bob Johnson", event: "Neon Nights", tickets: 2, status: "checked_in", dateAdded: "2024-03-11T14:30:00Z" },
                { id: "g_103", name: "Charlie Davis", event: "Deep Tech", tickets: 4, status: "attending", dateAdded: "2024-03-09T09:00:00Z" },
                { id: "g_104", name: "Diana Prince", event: "Sunset Sessions", tickets: 1, status: "canceled", dateAdded: "2024-03-05T22:15:00Z" },
                { id: "g_105", name: "Evan Wright", event: "Deep Tech", tickets: 3, status: "attending", dateAdded: "2024-03-10T11:00:00Z" }
            ]
        };

        return NextResponse.json(mockGuests);
    } catch (error: any) {
        console.error("[Promoter Guests API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
