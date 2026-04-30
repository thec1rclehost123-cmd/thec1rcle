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
    const { profile, getIdToken } = useDashboardAuth() as any;
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
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

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
                    onConfirm={() => {
                        setShowTransferModal(false);
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
                        return {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        };
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

function TransferConfirmationModal({
    available,
    pending,
    instantAvailable,
    payoutAccount,
    onClose,
    onConfirm,
    onAddPayoutMethod,
}: {
    available: number;
    pending: number;
    instantAvailable: number;
    payoutAccount: PromoterAccount | null;
    onClose: () => void;
    onConfirm: () => void;
    onAddPayoutMethod: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative w-full max-w-[540px] overflow-hidden rounded-[30px]"
                style={{
                    background: "linear-gradient(180deg, rgba(20,22,31,0.96) 0%, rgba(15,16,22,0.98) 100%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 28px 80px rgba(0,0,0,0.5)",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: "radial-gradient(circle at 18% 0%, rgba(94,194,255,0.24) 0%, transparent 28%), radial-gradient(circle at 100% 0%, rgba(47,99,255,0.22) 0%, transparent 35%)",
                    }}
                />

                <div className="relative p-6 sm:p-7">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                                Confirm Transfer
                            </p>
                            <h2 className="mt-2 text-[28px] font-black tracking-[-0.03em] text-white">
                                Review wallet details
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-full"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div
                        className="mt-6 overflow-hidden rounded-[26px] p-5"
                        style={{
                            background: "linear-gradient(145deg, rgba(94,194,255,0.34) 0%, rgba(47,99,255,0.3) 52%, rgba(21,50,184,0.28) 100%)",
                            border: "1px solid rgba(255,255,255,0.16)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/14 text-white">
                                <Wallet2 size={18} />
                            </div>
                            <span className="rounded-full border border-white/20 bg-black/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                                Available
                            </span>
                        </div>
                        <div className="mt-6">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/62">
                                Ready to transfer
                            </p>
                            <div className="mt-2 text-[40px] font-black tracking-[-0.04em] text-white tabular-nums">
                                {formatINR(available)}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                        <div
                            className="rounded-[22px] p-4"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#93c5fd" }}>
                                    <Landmark size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                                        Payout destination
                                    </p>
                                    {payoutAccount ? (
                                        <>
                                            <p className="mt-2 text-[16px] font-semibold text-white">
                                                {payoutAccount.bankName}
                                            </p>
                                            <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,0.56)" }}>
                                                {payoutAccount.paymentType === "debit_card" ? "Debit Card" : "Bank Account"} ending in {payoutAccount.last4}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="mt-2 text-[16px] font-semibold text-white">
                                                No payout method connected
                                            </p>
                                            <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,0.56)" }}>
                                                Add a bank account or debit card before requesting a transfer.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-[20px] p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                                    Pending
                                </p>
                                <p className="mt-2 text-[22px] font-bold tabular-nums text-white">
                                    {formatINR(pending)}
                                </p>
                            </div>
                            <div className="rounded-[20px] p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                                    Instant
                                </p>
                                <p className="mt-2 text-[22px] font-bold tabular-nums text-white">
                                    {formatINR(instantAvailable)}
                                </p>
                            </div>
                        </div>

                        <div
                            className="flex items-start gap-3 rounded-[20px] p-4"
                            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.16)" }}
                        >
                            <ShieldCheck size={18} style={{ color: "#86efac", flexShrink: 0, marginTop: 2 }} />
                            <p className="text-[13px] leading-6" style={{ color: "rgba(255,255,255,0.72)" }}>
                                Transfers are confirmed on the payouts page, where you can review the exact amount, destination, and request status before submission.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {payoutAccount ? (
                            <button
                                type="button"
                                onClick={onConfirm}
                                className="flex h-13 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[15px] font-bold"
                                style={{
                                    background: "linear-gradient(145deg, #4aa7ff 0%, #2f63ff 58%, #1b3fe6 100%)",
                                    border: "1px solid rgba(101,170,255,0.45)",
                                    color: "#fff",
                                    boxShadow: "0 16px 32px rgba(47,99,255,0.24)",
                                }}
                            >
                                Continue to Transfer
                                <ArrowUpRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={onAddPayoutMethod}
                                className="flex h-13 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[15px] font-bold"
                                style={{
                                    background: "linear-gradient(145deg, #4aa7ff 0%, #2f63ff 58%, #1b3fe6 100%)",
                                    border: "1px solid rgba(101,170,255,0.45)",
                                    color: "#fff",
                                    boxShadow: "0 16px 32px rgba(47,99,255,0.24)",
                                }}
                            >
                                Add Payout Method
                                <ArrowUpRight size={16} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-13 items-center justify-center rounded-[18px] px-4 py-3 text-[15px] font-bold"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.88)" }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
