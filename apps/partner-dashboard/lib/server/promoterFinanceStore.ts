import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

export interface PromoterBalanceSnapshot {
    totalEarned: number;
    available: number;
    pending: number;
    totalPaid: number;
    instantAvailable: number;
}

export interface PromoterCommissionRow {
    id: string;
    eventId: string | null;
    orderId: string | null;
    eventName: string;
    buyerName: string;
    amount: number;
    revenue: number;
    ticketsSold: number;
    commissionRate: number;
    linkCode: string | null;
    status: string;
    date: string | null;
    settledAt?: string | null;
}

export interface PromoterPayoutRow {
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
    requestedAt: string | null;
    completedAt: string | null;
    last4: string | null;
    bankName: string | null;
}

export interface PromoterBankAccountRow {
    id: string;
    last4: string;
    bankName: string;
    isDefault: boolean;
    paymentType: "bank_account" | "debit_card";
}

export interface PromoterFinanceSnapshot {
    balance: PromoterBalanceSnapshot;
    payouts: PromoterPayoutRow[];
    commissionDetails: PromoterCommissionRow[];
    bankAccounts: PromoterBankAccountRow[];
}

function maskName(name: string) {
    if (!name || name.length < 2) return "Guest";
    const parts = name.trim().split(" ");
    return parts.map((part, index) => (index === 0 ? part : `${part[0]}.`)).join(" ");
}

function toIsoDate(value: any): string | null {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return null;
}

function isPaidStatus(status: string) {
    return ["completed", "paid", "cleared"].includes(status);
}

function isPendingPayoutStatus(status: string) {
    return ["pending", "processing", "in_transit"].includes(status);
}

function isCompletedEventStatus(status?: string | null) {
    const normalized = String(status || "").toLowerCase();
    return ["completed", "ended", "closed", "finished"].includes(normalized);
}

function getTicketCount(order: Record<string, any> | undefined) {
    if (!order) return 1;
    if (Array.isArray(order.tickets) && order.tickets.length > 0) {
        return order.tickets.reduce((sum, ticket) => sum + Number(ticket?.quantity || 1), 0);
    }
    return Number(order.quantity || 1);
}

function normalizeCommissionRate(value: any) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return amount <= 1 ? Math.round(amount * 10000) / 100 : amount;
}

function normalizeCommissionStatus(rawStatus: any, eventData?: Record<string, any> | null) {
    const status = String(rawStatus || "").toLowerCase();
    if (["paid", "completed"].includes(status)) return "paid";
    if (["cleared", "settled", "eligible"].includes(status)) return "cleared";
    if (["processing", "in_transit", "transferring"].includes(status)) return "clearing";
    if (["reversed", "cancelled", "failed"].includes(status)) return "reversed";
    if (eventData && isCompletedEventStatus(eventData.lifecycle || eventData.status || eventData.eventStatus)) {
        return "cleared";
    }
    return "pending";
}

async function getDocsByIds(collectionName: string, ids: string[]) {
    const db = getAdminDb();
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    const docs = await Promise.all(uniqueIds.map((id) => db.collection(collectionName).doc(id).get()));
    return docs.reduce((map, doc) => {
        if (doc.exists) map.set(doc.id, doc.data() || {});
        return map;
    }, new Map<string, Record<string, any>>());
}

async function getPayoutDocs(promoterId: string) {
    const db = getAdminDb();

    const [partnerPayouts, legacyPayouts] = await Promise.all([
        db.collection("payouts").where("partnerId", "==", promoterId).limit(100).get(),
        db.collection("payouts").where("promoterId", "==", promoterId).limit(100).get(),
    ]);

    const deduped = new Map<string, any>();
    [...partnerPayouts.docs, ...legacyPayouts.docs].forEach((doc) => {
        deduped.set(doc.id, doc);
    });

    return Array.from(deduped.values());
}

async function getLedgerCommissionRows(promoterId: string) {
    const db = getAdminDb();
    const ledgerSnap = await db
        .collection("promoter_ledger")
        .where("promoterId", "==", promoterId)
        .limit(200)
        .get();

    if (ledgerSnap.empty) return [];

    const ledgerEntries = ledgerSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) as Array<Record<string, any>>;
    const orderMap = await getDocsByIds("orders", ledgerEntries.map((entry) => String(entry.orderId || "")));
    const eventMap = await getDocsByIds(
        "events",
        ledgerEntries.map((entry) => String(entry.eventId || orderMap.get(String(entry.orderId || ""))?.eventId || ""))
    );

    return ledgerEntries
        .map((entry) => {
            const orderId = String(entry.orderId || "") || null;
            const eventId = String(entry.eventId || orderMap.get(String(entry.orderId || ""))?.eventId || "") || null;
            const order = orderId ? orderMap.get(orderId) : undefined;
            const event = eventId ? eventMap.get(eventId) : undefined;
            const commissionRate = normalizeCommissionRate(entry.commissionRate || order?.promoterAttribution?.commissionRate);
            const amount = Number(entry.commissionAmount || order?.promoterAttribution?.commissionAmount || 0);
            const revenue = Number(entry.orderAmount || order?.totalAmount || order?.amount || 0);
            const status = normalizeCommissionStatus(entry.status, event);

            return {
                id: String(entry.id),
                eventId,
                orderId,
                eventName: String(event?.title || order?.eventTitle || entry.eventName || "Event"),
                buyerName: maskName(String(order?.guestName || order?.buyerName || order?.userName || entry.buyerName || "Guest")),
                amount,
                revenue,
                ticketsSold: getTicketCount(order),
                commissionRate,
                linkCode: String(entry.promoCode || order?.promoterCode || "") || null,
                status,
                date: toIsoDate(entry.createdAt || order?.createdAt),
                settledAt: status === "cleared" || status === "paid"
                    ? toIsoDate(entry.settledAt || entry.updatedAt || event?.updatedAt || event?.endDate)
                    : null,
            } satisfies PromoterCommissionRow;
        })
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}

async function getAssignmentFallbackRows(promoterId: string) {
    const db = getAdminDb();
    const assignmentSnap = await db.collection("promoter_assignments")
        .where("promoterId", "==", promoterId)
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();

    return assignmentSnap.docs.map((doc: any) => {
        const data = doc.data();
        const amount = Number(data.totalCommission || data.commissionEarned || 0);
        const status = normalizeCommissionStatus(data.commissionStatus || data.status, data);

        return {
            id: doc.id,
            eventId: data.eventId || null,
            orderId: null,
            eventName: data.eventName || data.eventTitle || "Event",
            buyerName: maskName(data.buyerName || data.guestName || "Guest"),
            amount,
            revenue: Number(data.totalRevenue || data.revenue || 0),
            ticketsSold: Number(data.totalSales || data.ticketsSold || 0),
            commissionRate: normalizeCommissionRate(data.commissionRate || 0),
            linkCode: data.linkCode || data.code || null,
            status,
            date: toIsoDate(data.createdAt),
            settledAt: status === "cleared" || status === "paid" ? toIsoDate(data.settledAt || data.updatedAt) : null,
        } satisfies PromoterCommissionRow;
    });
}

export async function getPromoterFinanceSnapshot(promoterId: string): Promise<PromoterFinanceSnapshot> {
    if (!promoterId || !isFirebaseConfigured()) {
        return {
            balance: {
                totalEarned: 0,
                available: 0,
                pending: 0,
                totalPaid: 0,
                instantAvailable: 0,
            },
            payouts: [],
            commissionDetails: [],
            bankAccounts: [],
        };
    }

    const db = getAdminDb();
    const [payoutDocs, ledgerRows, fallbackAssignmentRows] = await Promise.all([
        getPayoutDocs(promoterId),
        getLedgerCommissionRows(promoterId),
        getAssignmentFallbackRows(promoterId),
    ]);

    const payouts: PromoterPayoutRow[] = payoutDocs
        .map((doc: any) => {
            const data = doc.data();
            const paymentMethod = data.paymentMethod || data.method || "bank_transfer";
            return {
                id: doc.id,
                amount: Number(data.amount || 0),
                status: String(data.status || "pending").toLowerCase(),
                paymentMethod,
                requestedAt: toIsoDate(data.requestedAt || data.createdAt || data.timestamp),
                completedAt: toIsoDate(data.completedAt || data.updatedAt || data.timestamp),
                last4: data.last4 || data.accountLast4 || null,
                bankName: data.bankName || null,
            };
        })
        .sort((a, b) => new Date(b.requestedAt || b.completedAt || 0).getTime() - new Date(a.requestedAt || a.completedAt || 0).getTime());

    const commissionDetails = (ledgerRows.length > 0 ? ledgerRows : fallbackAssignmentRows).slice(0, 200);

    const totals = commissionDetails.reduce((acc: any, row: any) => {
        acc.totalEarned += row.amount;
        if (row.status === "pending" || row.status === "clearing") {
            acc.pending += row.amount;
        }
        if (row.status === "cleared" || row.status === "paid") {
            acc.clearedGross += row.amount;
        }
        return acc;
    }, { totalEarned: 0, pending: 0, clearedGross: 0 });

    const totalPaid = payouts
        .filter((payout) => isPaidStatus(payout.status))
        .reduce((sum, payout) => sum + Math.abs(payout.amount), 0);

    const pendingPayouts = payouts
        .filter((payout) => isPendingPayoutStatus(payout.status))
        .reduce((sum, payout) => sum + Math.abs(payout.amount), 0);

    const available = Math.max(0, totals.clearedGross - totalPaid - pendingPayouts);

    const bankAccounts = payouts
        .filter((payout) => payout.last4 || payout.bankName)
        .reduce((accounts: PromoterBankAccountRow[], payout) => {
            const exists = accounts.find((account) => account.last4 === (payout.last4 || "****") && account.bankName === (payout.bankName || payout.paymentMethod));
            if (exists) return accounts;

            accounts.push({
                id: `ba_${payout.id}`,
                last4: payout.last4 || "****",
                bankName: payout.bankName || payout.paymentMethod || "Bank",
                isDefault: accounts.length === 0,
                paymentType: "bank_account",
            });
            return accounts;
        }, []);

    return {
        balance: {
            totalEarned: totals.totalEarned,
            available,
            pending: totals.pending,
            totalPaid,
            instantAvailable: 0,
        },
        payouts,
        commissionDetails: commissionDetails.slice(0, 50),
        bankAccounts,
    };
}
