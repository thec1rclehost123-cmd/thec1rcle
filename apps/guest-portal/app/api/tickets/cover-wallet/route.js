import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

export async function GET(request) {
    try {
        const user = await verifyAuth();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get("orderId");
        if (!orderId) {
            return NextResponse.json({ error: "orderId is required" }, { status: 400 });
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ wallets: [] });
        }

        const db = getAdminDb();

        // Verify the order belongs to this user
        const orderDoc = await db.collection("orders").doc(orderId).get();
        if (!orderDoc.exists || orderDoc.data().userId !== user.uid) {
            // Also check rsvp_orders
            const rsvpDoc = await db.collection("rsvp_orders").doc(orderId).get();
            if (!rsvpDoc.exists || rsvpDoc.data().userId !== user.uid) {
                return NextResponse.json({ error: "Order not found" }, { status: 404 });
            }
        }

        // Fetch wallets for this order
        const snap = await db.collection("cover_wallets")
            .where("orderId", "==", orderId)
            .get();

        const wallets = snap.docs.map(d => {
            const w = d.data();
            return {
                id: d.id,
                state: w.state,
                openingBalancePaise: w.openingBalancePaise,
                currentBalancePaise: w.currentBalancePaise,
                totalDebitedPaise: w.totalDebitedPaise || 0,
                terminationTime: w.rules?.terminationTime || null,
                showBalance: w.rules?.showBalanceToGuest !== false,
                showHistory: w.rules?.showTransactionHistory !== false,
                eventId: w.eventId,
            };
        });

        return NextResponse.json({ wallets });
    } catch (error) {
        console.error("GET /api/tickets/cover-wallet error", error);
        return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 });
    }
}
