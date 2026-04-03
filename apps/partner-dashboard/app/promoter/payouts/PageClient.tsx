"use client";

import { useState, useEffect } from "react";
import {
    Wallet,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowRight,
    IndianRupee,
    AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { StatTrendCard } from "@/components/promoter/PlaceholderCharts";
import { formatINR, formatDate } from "@/lib/utils/format";
import { PayoutRequestModal } from "@/components/promoter/PayoutRequestModal";

interface PayoutBalance {
    totalEarned: number;
    totalPaid: number;
    available: number;
    pending: number;
}

interface Payout {
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
    requestedAt: string;
    completedAt?: string;
    eventName?: string;
    buyerName?: string;
    date?: string;
}

const STATUS_STYLES: Record<string, string> = {
    pending:    "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    processing: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    completed:  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    failed:     "bg-red-500/10 text-red-400 border border-red-500/20",
    cancelled:  "bg-surface-secondary text-text-tertiary border border-border-subtle",
};

const STATUS_ICONS: Record<string, any> = {
    pending:    Clock,
    processing: ArrowRight,
    completed:  CheckCircle2,
    failed:     XCircle,
    cancelled:  XCircle,
};


const mp = (delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function PayoutsPage() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const [balance, setBalance] = useState<PayoutBalance | null>(null);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);

    const promoterId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (promoterId) fetchPayoutData();
    }, [promoterId]);

    const fetchPayoutData = async () => {
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payoutRes = await fetch(`/api/promoter/payouts?promoterId=${promoterId}`, { headers });
            const payoutData = await payoutRes.json();
            setBalance(payoutData.balance || null);
            setPayouts(payoutData.payouts || []);
        } catch (err) {
            console.error("Failed to fetch payout data:", err);
        } finally {
            setLoading(false);
        }
    };

    const canRequest = balance && balance.available >= 100;

    return (
        <VenuePageShell
            title="Earnings & Payouts"
            actions={
                <VenueActionButton
                    variant="primary"
                    icon={Wallet}
                    onClick={() => setShowRequestModal(true)}
                    disabled={!canRequest}
                >
                    Request Payout
                </VenueActionButton>
            }
        >
            {/* Hero band */}
            <motion.div
                {...mp(0)}
                className="relative overflow-hidden rounded-[32px] p-8"
                style={{ background: "linear-gradient(135deg, #150d2e 0%, #0d0920 50%, #080810 100%)" }}
            >
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(124,58,237,0.12)" }} />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-2">Total Earned</p>
                        <p className="text-5xl font-black tracking-tighter tabular-nums text-white leading-none">
                            {loading ? "—" : formatINR(balance?.totalEarned || 0)}
                        </p>
                        <p className="text-sm text-white/40 font-medium mt-2">
                            {formatINR(balance?.available || 0)} available · {formatINR(balance?.pending || 0)} pending
                        </p>
                    </div>
                    {balance && balance.available < 100 && (
                        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                            <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-300">Minimum payout ₹100</p>
                                <p className="text-xs text-amber-400/70 mt-0.5">
                                    Earn {formatINR(100 - balance.available)} more to withdraw
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* KPI row */}
            <motion.div {...mp(0.08)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTrendCard
                    label="Total Earned"
                    value={loading ? "—" : formatINR(balance?.totalEarned || 0)}
                    color="#7c3aed"
                    icon={<TrendingUp className="w-4 h-4" />}
                    trendUp
                    trend="+12%"
                />
                <StatTrendCard
                    label="Available"
                    value={loading ? "—" : formatINR(balance?.available || 0)}
                    color="#10b981"
                    icon={<Wallet className="w-4 h-4" />}
                    trendUp
                />
                <StatTrendCard
                    label="Pending"
                    value={loading ? "—" : formatINR(balance?.pending || 0)}
                    color="#f59e0b"
                    icon={<Clock className="w-4 h-4" />}
                />
                <StatTrendCard
                    label="Total Paid Out"
                    value={loading ? "—" : formatINR(balance?.totalPaid || 0)}
                    color="#6366f1"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                />
            </motion.div>

            {/* Payout History */}
            <motion.div {...mp(0.16)} className="rounded-[32px] bg-surface-elevated border border-border-default overflow-hidden">
                <div className="px-6 py-5 border-b border-border-default flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Payout History</p>
                        <p className="text-lg font-bold text-text-primary mt-0.5">Payout Requests</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-surface-tertiary text-xs font-bold text-text-tertiary">
                        {payouts.length} total
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
                    </div>
                ) : payouts.length === 0 ? (
                    <div className="p-16 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-3xl bg-surface-tertiary flex items-center justify-center mb-5">
                            <Wallet className="w-7 h-7 text-text-placeholder" />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary mb-2">No payouts yet</h3>
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle">
                        {payouts.map((payout, i) => {
                            const normalizedStatus = payout.status === "cleared" ? "completed" : payout.status;
                            const StatusIcon = STATUS_ICONS[normalizedStatus] || Clock;
                            return (
                                <motion.div
                                    key={payout.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="px-6 py-4 flex items-center justify-between hover:bg-surface-secondary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-2xl bg-surface-tertiary flex items-center justify-center">
                                            <IndianRupee className="w-4 h-4 text-text-tertiary" />
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-text-primary tabular-nums">
                                                {formatINR(payout.amount)}
                                            </p>
                                            <p className="text-xs text-text-tertiary font-medium mt-0.5">
                                                {(payout.paymentMethod || "Payout request").replace(/_/g, " ")} · {formatIncomeDate(payout.completedAt || payout.requestedAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${STATUS_STYLES[normalizedStatus] || STATUS_STYLES.cancelled}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {normalizedStatus === "completed" ? "paid" : normalizedStatus}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* Request Modal */}
            {showRequestModal && (
                <PayoutRequestModal
                    availableBalance={balance?.available || 0}
                    promoterId={promoterId!}
                    onClose={() => setShowRequestModal(false)}
                    onSuccess={() => {
                        setShowRequestModal(false);
                        fetchPayoutData();
                    }}
                />
            )}
        </VenuePageShell>
    );
}

function formatIncomeDate(value?: string) {
    return value ? formatDate(value) : "Awaiting processing";
}
