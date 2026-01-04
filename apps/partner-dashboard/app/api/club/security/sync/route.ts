import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { syncCode } = await req.json();

        // 1. Validate Input
        if (!syncCode) {
            return NextResponse.json({ error: "Sync code required" }, { status: 400 });
        }

        console.log("Sync request received for:", syncCode);

        // 2. Mock Logic for "000-000" or any 6 digit code for now
        // In real app, query `events` collection where `securityCode === syncCode`

        let event = null;

        if (syncCode === "000-000" || syncCode.replace('-', '') === "123456") {
            event = {
                id: "evt_test_123",
                name: "Test Event: Techno Bunker",
                venue: "Tryst Mumbai",
                date: new Date().toISOString(),
                settings: {
                    allowExitReEntry: true
                }
            };
        }

        if (!event) {
            // Simulate DB lookup failing
            return NextResponse.json({ error: "Invalid sync code" }, { status: 401 });
        }

        // 3. Fetch Tickets (Mock)
        // In real app, fetch `tickets` where `eventId === event.id`
        const tickets = [
            { id: "TKT-001", status: "valid", type: "VIP", holder: "Rahul S.", guestCount: 2 },
            { id: "TKT-002", status: "used", type: "VVIP", holder: "Anjali M.", guestCount: 4 },
            { id: "TKT-003", status: "valid", type: "GA", holder: "Karan Johar", guestCount: 1 },
        ];

        return NextResponse.json({
            success: true,
            event,
            tickets
        });

    } catch (e: any) {
        console.error("Sync API Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
