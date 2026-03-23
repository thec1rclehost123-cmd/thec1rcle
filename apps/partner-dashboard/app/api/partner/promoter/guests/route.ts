import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const GET = withAuth(async (req: NextRequest) => {
    try {
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

        return ok(mockGuests);
    } catch (error: any) {
        console.error("[Promoter Guests API] GET Error:", error);
        return fail("Failed to load guests");
    }
});
