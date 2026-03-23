/**
 * GET /api/partner/promoter/finance
 *
 * Real finance data for the authenticated promoter.
 * Reads from: payouts, promoter_assignments, promoter_links, promoter_ledger
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

function maskName(name: string): string {
    if (!name || name.length < 2) return "Guest";
    const parts = name.trim().split(" ");
    return parts.map((p, i) => (i === 0 ? p : p[0] + ".")).join(" ");
}

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) {
        return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { promoterId } = ctx;
    const db = getAdminDb();

    try {
        // 1. Payouts — settled and pending
        const payoutsSnap = await db
            .collection("payouts")
            .where("promoterId", "==", promoterId)
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const payouts = payoutsSnap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                amount: data.amount || 0,
                status: data.status || "pending",
                date: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? null,
                method: data.method || data.payoutMethod || "bank",
                last4: data.last4 || data.accountLast4 || null,
                bankName: data.bankName || null,
            };
        });

        // 2. Assignments for commission ledger and balance computation
        const asgnSnap = await db
            .collection("promoter_assignments")
            .where("promoterId", "==", promoterId)
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();

        let lifetimeEarnings  = 0;
        let pendingClearance  = 0;
        let availableBalance  = 0;

        const commissionDetails: any[] = [];

        for (const doc of asgnSnap.docs) {
            const d = doc.data();
            const commission = d.totalCommission || d.commissionEarned || 0;
            const status     = (d.commissionStatus || d.status || "pending").toLowerCase();

            lifetimeEarnings += commission;

            if (status === "pending" || status === "clearing") {
                pendingClearance += commission;
            } else if (status === "cleared" || status === "active" || status === "completed") {
                availableBalance += commission;
            }

            commissionDetails.push({
                id: doc.id,
                eventName: d.eventName || d.eventTitle || "Event",
                ticketType: d.ticketType || "Ticket",
                buyerName: maskName(d.buyerName || d.guestName || "Guest"),
                amount: commission,
                status: status === "completed" || status === "cleared" ? "cleared" : "pending",
                date: d.createdAt?.toDate?.()?.toISOString() ?? null,
            });
        }

        // Subtract already-paid payouts from available
        const totalPaid = payouts
            .filter((p) => p.status === "completed" || p.status === "paid")
            .reduce((sum, p) => sum + Math.abs(p.amount), 0);
        availableBalance = Math.max(0, availableBalance - totalPaid);

        // 3. Build transaction ledger (commissions + payouts merged, sorted by date desc)
        const commissionLedger: any[] = asgnSnap.docs.slice(0, 20).map((doc) => {
            const d = doc.data();
            const commission = d.totalCommission || d.commissionEarned || 0;
            return {
                id: "comm_" + doc.id,
                type: "commission",
                amount: commission,
                status: (d.commissionStatus || d.status || "pending").toLowerCase() === "cleared" ? "cleared" : "pending",
                date: d.createdAt?.toDate?.()?.toISOString() ?? null,
                description: `${d.eventName || "Event"} — ${d.totalSales || 0} ticket(s)`,
            };
        });

        const payoutLedger: any[] = payouts.slice(0, 20).map((p) => ({
            id: "payout_" + p.id,
            type: "payout",
            amount: -Math.abs(p.amount),
            status: p.status === "completed" || p.status === "paid" ? "completed" : p.status,
            date: p.date,
            description: `Payout — ${p.bankName || p.method || "Bank Transfer"}${p.last4 ? ` ••••${p.last4}` : ""}`,
        }));

        const ledger = [...commissionLedger, ...payoutLedger]
            .filter((tx) => tx.date)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 30);

        // 4. Bank accounts from payouts metadata
        const bankAccounts = payouts
            .filter((p) => p.last4 || p.bankName)
            .reduce((acc: any[], p) => {
                const key = p.last4 || p.method;
                if (!acc.find((a) => a.last4 === p.last4)) {
                    acc.push({
                        id: "ba_" + p.id,
                        last4: p.last4 || "****",
                        bankName: p.bankName || p.method || "Bank",
                        isDefault: acc.length === 0,
                        status: "verified",
                    });
                }
                return acc;
            }, []);

        // 5. Next payout date — next 1st or 15th of month
        const now = new Date();
        const nextPayoutDate = now.getDate() < 15
            ? new Date(now.getFullYear(), now.getMonth(), 15).toISOString()
            : new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

        return NextResponse.json({
            overview: {
                availableBalance,
                pendingClearance,
                lifetimeEarnings,
                nextPayoutDate,
            },
            ledger,
            bankAccounts,
            commissionDetails: commissionDetails.slice(0, 30),
        });

    } catch (err: any) {
        console.error("[partner/promoter/finance] Error:", err.message);
        return NextResponse.json({ error: "Failed to load promoter finance" }, { status: 500 });
    }
}
