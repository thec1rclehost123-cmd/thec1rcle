"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, RefreshCw, ArrowUpRight, Landmark, ShieldCheck, Wallet2, X } from "lucide-react";
import { WalletPopover } from "@/components/wallet/WalletPopover";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenueActionButton, VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { PartnerFinanceSurface, type FinanceBankAccount, type FinancePayoutRow, type FinanceRow, type FinanceSettingRow } from "@/components/finance/PartnerFinanceSurface";
import { ConnectPayoutMethodModal } from "@/components/finance/ConnectPayoutMethodModal";
import { TransferConfirmationModal } from "@/components/finance/TransferConfirmationModal";
import { formatINR } from "@/lib/finance/definitions";

interface PromoterBalance {
    totalEarned?: number;
    available?: number;
    pending?: number;
    totalPaid?: number;
    instantAvailable?: number;
}

interface PromoterPayout {
    id: string;
    amount: number;
    status: string;
    paymentMethod?: string;
    requestedAt?: string;
    completedAt?: string;
}

interface PromoterAccount {
    id: string;
    bankName: string;
    last4: string;
    isDefault?: boolean;
    paymentType?: "bank_account" | "debit_card";
}

interface PromoterFinanceResponse {
    balance?: {
        totalEarned?: number;
        available?: number;
        pending?: number;
        totalPaid?: number;
        instantAvailable?: number;
    };
    bankAccounts?: Array<{
        id: string;
        last4?: string;
        bankName?: string;
        isDefault?: boolean;
        paymentType?: "bank_account" | "debit_card";
    }>;
    payouts?: PromoterPayout[];
    commissionDetails?: Array<{
        id: string;
        eventName?: string;
        buyerName?: string;
        amount?: number;
        status?: string;
        date?: string | null;
    }>;
}

export default function PromoterFinancePageClient() {
    const { profile, getIdToken } = useDashboardAuth();
    const router = useRouter();
    const promoterId = profile?.activeMembership?.partnerId;

    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState<PromoterBalance | null>(null);
    const [payouts, setPayouts] = useState<PromoterPayout[]>([]);
    const [accounts, setAccounts] = useState<PromoterAccount[]>([]);
    const [incomeItems, setIncomeItems] = useState<NonNullable<PromoterFinanceResponse["commissionDetails"]>>([]);
    const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
    const [showAddBankModal, setShowAddBankModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);

    const fetchData = useCallback(async () => {
        if (!promoterId) return;

        setLoading(true);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

            const [financeRes, accountsRes] = await Promise.all([
                fetch(`/api/partners/promoters/finance`, { headers }),
                fetch("/api/partners/promoters/finance/bank-accounts", { headers }),
            ]);

            if (financeRes.ok) {
                const financeData = (await financeRes.json()) as PromoterFinanceResponse;
                setBalance(financeData.balance ?? null);
                setPayouts(financeData.payouts ?? []);
                setIncomeItems(financeData.commissionDetails ?? []);
            } else {
                setBalance(null);
                setPayouts([]);
                setIncomeItems([]);
            }

            if (accountsRes.ok) {
                const accountsData = await accountsRes.json();
                setAccounts((accountsData.accounts ?? []).map((account: any) => ({
                    id: account.id,
                    bankName: account.bankName || "Bank Account",
                    last4: account.last4 || "0000",
                    isDefault: account.isDefault ?? false,
                    paymentType: account.paymentType || "bank_account",
                })));
            } else {
                setAccounts([]);
            }
        } finally {
            setLoading(false);
            setRefreshedAt(new Date());
        }
    }, [getIdToken, promoterId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const balanceRows: FinanceRow[] = [
        { label: "Available", value: loading ? "..." : formatINR(balance?.available || 0) },
        { label: "Pending", value: loading ? "..." : formatINR(balance?.pending || 0), helpLabel: "Commissions clear after event settlement." },
        { label: "Instant Available", value: loading ? "..." : formatINR(balance?.instantAvailable || 0), helpLabel: "Instant transfers are not enabled for promoters yet." },
    ];

    const settingsRows: FinanceSettingRow[] = [
        { label: "Country", value: "India" },
        { label: "Currency", value: "INR" },
        { label: "Statement Descriptor", value: "C1RCLE" },
        {
            label: "Payout Schedule",
            value: (
                <span
                    className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                    Weekly <ChevronDown size={14} />
                </span>
            ),
        },
    ];

    const bankAccounts: FinanceBankAccount[] = accounts.map((account) => ({
        id: account.id,
        name: account.paymentType === "debit_card" ? `${account.bankName} Debit Card` : account.bankName,
        detail: `${account.paymentType === "debit_card" ? "Card" : "Account"} •••• ${account.last4}`,
        badge: account.isDefault ? "Default" : undefined,
    }));

    const payoutRows: FinancePayoutRow[] = incomeItems.map((item: any) => ({
        id: item.id,
        date: formatPayoutDate(item.date || null),
        amount: formatINR(Math.abs(item.amount || 0)),
        userName: item.buyerName || "Guest",
        headline: `You received ${formatINR(Math.abs(item.amount || 0))}`,
        subtitle: item.buyerName
            ? `${item.buyerName} purchased through your promoter link${item.eventName ? ` for ${item.eventName}` : ""}`
            : (item.eventName || "Promoter income"),
        avatar: item.buyerAvatar || undefined,
        status: payoutStatusLabel(item.status),
        statusTone: payoutStatusTone(item.status),
    }));

    return (
        <VenuePageShell
            title="Finance"
            actions={
                <div className="flex items-center gap-3">
                    <WalletPopover />
                    <VenueActionButton variant="secondary" onClick={fetchData}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </VenueActionButton>
                    <Link href="/promoter/payouts">
                        <VenueActionButton variant="primary">Request Payout</VenueActionButton>
                    </Link>
                </div>
            }
        >
            <PartnerFinanceSurface
                balanceRows={balanceRows}
                settingsRows={settingsRows}
                bankAccounts={bankAccounts}
                payouts={payoutRows}
                balanceVariant="wallet"
                payoutsVariant="pill"
                balanceActionLabel="Transfer"
                onBalanceAction={() => setShowTransferModal(true)}
                onRefresh={fetchData}
                refreshing={loading}
                lastUpdatedLabel={refreshedAt ? `Last updated ${refreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : null}
                payoutsLoading={loading}
                payoutsEmptyTitle="No earnings yet."
                payoutsEmptyDescription="Commission rows will appear here once tickets are sold through your promoter links."
                bankEmptyLabel="+ Add Bank Account"
                onAddBank={() => setShowAddBankModal(true)}
                leftFooter={
                    !accounts.length ? (
                        <p className="px-2 text-[12px]" style={{ color: "rgba(255,255,255,0.36)" }}>
                            Link a payout destination from the payouts page when you are ready to withdraw.
                        </p>
                    ) : null
                }
            />

            {showTransferModal ? (
                <TransferConfirmationModal
                    available={balance?.available || 0}
                    pending={balance?.pending || 0}
                    instantAvailable={balance?.instantAvailable || 0}
                    payoutAccount={accounts.find((account) => account.isDefault) || accounts[0] || null}
                    onClose={() => setShowTransferModal(false)}
                    onSubmit={async (amount, accountId) => {
                        const token = typeof getIdToken === "function" ? await getIdToken() : "";
                        const headers: Record<string, string> = { "Content-Type": "application/json" };
                        if (token) headers["Authorization"] = `Bearer ${token}`;

                        const amountPaise = Math.round(amount * 100);

                        const res = await fetch("/api/partners/promoters/payouts", {
                            method: "POST",
                            headers,
                            body: JSON.stringify({ amountPaise, bankAccountId: accountId }),
                        });

                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to process transfer.");
                        
                        setShowTransferModal(false);
                        fetchData();
                        router.push("/promoter/payouts");
                    }}
                    onAddPayoutMethod={() => {
                        setShowTransferModal(false);
                        setShowAddBankModal(true);
                    }}
                />
            ) : null}

            {showAddBankModal ? (
                <ConnectPayoutMethodModal
                    title="Connect Payout Method"
                    endpoint="/api/partners/promoters/finance/bank-accounts"
                    getHeaders={async () => {
                        const token = typeof getIdToken === "function" ? await getIdToken() : "";
                        const headers: Record<string, string> = { "Content-Type": "application/json" };
                        if (token) headers["Authorization"] = `Bearer ${token}`;
                        return headers;
                    }}
                    onClose={() => setShowAddBankModal(false)}
                    onAdded={fetchData}
                />
            ) : null}
        </VenuePageShell>
    );
}

function formatPayoutDate(value: string | null) {
    if (!value) return "Upcoming payout";
    return new Date(value).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function payoutStatusLabel(status?: string) {
    switch ((status || "").toLowerCase()) {
        case "cleared":
        case "completed":
        case "paid":
            return "Paid";
        case "processing":
        case "in_transit":
            return "In Transit";
        case "failed":
        case "cancelled":
            return "Failed";
        default:
            return "Pending";
    }
}

function payoutStatusTone(status?: string): FinancePayoutRow["statusTone"] {
    switch ((status || "").toLowerCase()) {
        case "cleared":
        case "completed":
        case "paid":
            return "success";
        case "processing":
        case "in_transit":
            return "info";
        case "failed":
        case "cancelled":
            return "danger";
        default:
            return "warning";
    }
}
