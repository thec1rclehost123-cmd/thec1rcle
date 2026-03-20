"use client";

import { useState, useEffect } from "react";
import {
    Wallet,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowRight,
    CreditCard,
    IndianRupee,
    AlertCircle,
    Plus,
    X,
    Smartphone,
    Building2
} from "lucide-react";
import { motion } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { StatTrendCard } from "@/components/promoter/PlaceholderCharts";
import { formatINR, formatDate } from "@/lib/utils/format";

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
    const { profile } = useDashboardAuth();
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
            const res = await fetch(`/api/promoter/payouts?promoterId=${promoterId}`);
            const data = await res.json();
            setBalance(data.balance);
            setPayouts(data.payouts || []);
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
            subtitle="Your commission balance, payout history, and withdrawal requests"
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
                        <p className="text-lg font-bold text-text-primary mt-0.5">All Withdrawals</p>
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
                        <p className="text-sm text-text-tertiary max-w-xs leading-relaxed">
                            Once you reach ₹100 in available balance, you can request your first payout here.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle">
                        {payouts.map((payout, i) => {
                            const StatusIcon = STATUS_ICONS[payout.status] || Clock;
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
                                                {payout.paymentMethod.toUpperCase()} · {formatDate(payout.requestedAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${STATUS_STYLES[payout.status] || STATUS_STYLES.cancelled}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {payout.status}
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

function PayoutRequestModal({
    availableBalance,
    promoterId,
    onClose,
    onSuccess,
}: {
    availableBalance: number;
    promoterId: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [amount, setAmount] = useState(availableBalance);
    const [paymentMethod, setPaymentMethod] = useState("upi");
    const [upiId, setUpiId] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [ifscCode, setIfscCode] = useState("");
    const [accountName, setAccountName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            if (amount < 100) throw new Error("Minimum payout amount is ₹100");
            if (amount > availableBalance) throw new Error("Amount exceeds available balance");
            if (paymentMethod === "upi") {
                const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
                if (!upiRegex.test(upiId.trim())) throw new Error("Invalid UPI ID format. Expected: name@bankhandle");
            }
            if (paymentMethod === "bank_transfer") {
                const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
                if (!ifscRegex.test(ifscCode.trim().toUpperCase())) throw new Error("Invalid IFSC code");
                if (!accountNumber.trim() || accountNumber.trim().length < 9) throw new Error("Account number must be at least 9 digits");
                if (!accountName.trim() || accountName.trim().length < 3) throw new Error("Account holder name is required");
            }
            const paymentDetails: any = {};
            if (paymentMethod === "upi") paymentDetails.upiId = upiId.trim();
            else if (paymentMethod === "bank_transfer") {
                paymentDetails.accountNumber = accountNumber.trim();
                paymentDetails.ifscCode = ifscCode.trim().toUpperCase();
                paymentDetails.accountName = accountName.trim();
            }
            const res = await fetch("/api/promoter/payouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promoterId, amount, paymentMethod, paymentDetails }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to request payout");
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-[32px] bg-surface-elevated border border-border-default max-w-md w-full p-8 shadow-2xl"
            >
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Withdrawal</p>
                        <h3 className="text-xl font-black text-text-primary">Request Payout</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-tertiary rounded-xl transition-colors">
                        <X className="w-5 h-5 text-text-tertiary" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm font-bold">₹</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Math.min(Number(e.target.value), availableBalance))}
                                min={100}
                                max={availableBalance}
                                required
                                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-border-default bg-surface-secondary text-text-primary font-bold focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                            />
                        </div>
                        <p className="text-[11px] text-text-placeholder mt-1.5">
                            Available: {formatINR(availableBalance)} · Min: ₹100
                        </p>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">Payment Method</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: "upi", icon: Smartphone, label: "UPI" },
                                { id: "bank_transfer", icon: Building2, label: "Bank Transfer" },
                            ].map(({ id, icon: Icon, label }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setPaymentMethod(id)}
                                    className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${paymentMethod === id
                                        ? "border-violet-500/50 bg-violet-500/10 text-violet-400"
                                        : "border-border-default hover:border-border-strong text-text-secondary"
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-bold text-sm">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {paymentMethod === "upi" && (
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">UPI ID</label>
                            <input
                                type="text"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder="name@upi"
                                required
                                className="w-full px-4 py-3 rounded-2xl border border-border-default bg-surface-secondary text-text-primary font-medium focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                            />
                        </div>
                    )}

                    {paymentMethod === "bank_transfer" && (
                        <div className="space-y-3">
                            {[
                                { label: "Account Holder Name", value: accountName, setter: setAccountName, placeholder: "Full name" },
                                { label: "Account Number", value: accountNumber, setter: setAccountNumber, placeholder: "9+ digits" },
                                { label: "IFSC Code", value: ifscCode, setter: (v: string) => setIfscCode(v.toUpperCase()), placeholder: "ABCD0123456" },
                            ].map(({ label, value, setter, placeholder }) => (
                                <div key={label}>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">{label}</label>
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => setter(e.target.value)}
                                        placeholder={placeholder}
                                        required
                                        className="w-full px-4 py-3 rounded-2xl border border-border-default bg-surface-secondary text-text-primary font-medium focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400 font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-border-default text-text-secondary font-bold rounded-2xl hover:bg-surface-tertiary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || amount < 100}
                            className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl disabled:opacity-40 transition-colors"
                        >
                            {submitting ? "Submitting…" : `Request ${formatINR(amount)}`}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
