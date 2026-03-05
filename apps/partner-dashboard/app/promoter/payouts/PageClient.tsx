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
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

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

const STATUS_STYLES = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-50 text-slate-500 border-slate-200"
};

const STATUS_ICONS = {
    pending: Clock,
    processing: ArrowRight,
    completed: CheckCircle2,
    failed: XCircle,
    cancelled: XCircle
};

export default function PayoutsPage() {
    const { profile } = useDashboardAuth();
    const [balance, setBalance] = useState<PayoutBalance | null>(null);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);

    const promoterId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (promoterId) {
            fetchPayoutData();
        }
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

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-end justify-between border-b border-slate-200 pb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Earnings & Payouts</h1>
                    <p className="text-slate-500 text-sm mt-1">Track your commissions and request payouts.</p>
                </div>
                <button
                    onClick={() => setShowRequestModal(true)}
                    disabled={!balance || balance.available < 100}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Wallet className="w-4 h-4" />
                    Request Payout
                </button>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <BalanceCard
                    label="Total Earned"
                    amount={balance?.totalEarned || 0}
                    icon={TrendingUp}
                    color="indigo"
                    loading={loading}
                />
                <BalanceCard
                    label="Available"
                    amount={balance?.available || 0}
                    icon={Wallet}
                    color="emerald"
                    loading={loading}
                    highlight
                />
                <BalanceCard
                    label="Pending Payout"
                    amount={balance?.pending || 0}
                    icon={Clock}
                    color="amber"
                    loading={loading}
                />
                <BalanceCard
                    label="Total Paid"
                    amount={balance?.totalPaid || 0}
                    icon={CheckCircle2}
                    color="slate"
                    loading={loading}
                />
            </div>

            {/* Minimum Info */}
            {balance && balance.available < 100 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">Minimum payout: ₹100</p>
                        <p className="text-sm text-amber-700">
                            Earn {formatAmount(100 - balance.available)} more to request a payout.
                        </p>
                    </div>
                </div>
            )}

            {/* Payout History */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="font-bold text-slate-900">Payout History</h2>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-pulse text-slate-400">Loading payouts...</div>
                    </div>
                ) : payouts.length === 0 ? (
                    <div className="p-12 text-center">
                        <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No payouts yet</h3>
                        <p className="text-slate-500 text-sm">
                            Your payout history will appear here once you request your first payout.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {payouts.map(payout => {
                            const StatusIcon = STATUS_ICONS[payout.status as keyof typeof STATUS_ICONS] || Clock;
                            return (
                                <div key={payout.id} className="px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                                            <IndianRupee className="w-5 h-5 text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-slate-900">
                                                {formatAmount(payout.amount)}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {payout.paymentMethod.toUpperCase()} • {formatDate(payout.requestedAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border flex items-center gap-1.5 ${STATUS_STYLES[payout.status as keyof typeof STATUS_STYLES]}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {payout.status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Request Modal */}
            {showRequestModal && (
                <PayoutRequestModal
                    availableBalance={balance?.available || 0}
                    promoterId={promoterId}
                    onClose={() => setShowRequestModal(false)}
                    onSuccess={() => {
                        setShowRequestModal(false);
                        fetchPayoutData();
                    }}
                />
            )}
        </div>
    );
}

function BalanceCard({
    label,
    amount,
    icon: Icon,
    color,
    loading,
    highlight = false
}: {
    label: string;
    amount: number;
    icon: any;
    color: string;
    loading: boolean;
    highlight?: boolean;
}) {
    const formatAmount = (amt: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }).format(amt);
    };

    const colorClasses = {
        indigo: "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        amber: "bg-amber-50 text-amber-600",
        slate: "bg-slate-100 text-slate-600"
    };

    return (
        <div className={`p-5 rounded-2xl border ${highlight ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-xl ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
            </div>
            {loading ? (
                <div className="h-8 bg-slate-100 rounded animate-pulse" />
            ) : (
                <p className={`text-2xl font-bold ${highlight ? "text-emerald-700" : "text-slate-900"}`}>
                    {formatAmount(amount)}
                </p>
            )}
        </div>
    );
}

function PayoutRequestModal({
    availableBalance,
    promoterId,
    onClose,
    onSuccess
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
            const paymentDetails: any = {};
            if (paymentMethod === "upi") {
                paymentDetails.upiId = upiId;
            } else if (paymentMethod === "bank_transfer") {
                paymentDetails.accountNumber = accountNumber;
                paymentDetails.ifscCode = ifscCode;
                paymentDetails.accountName = accountName;
            }

            const res = await fetch("/api/promoter/payouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    promoterId,
                    amount,
                    paymentMethod,
                    paymentDetails
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to request payout");
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const formatAmount = (amt: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }).format(amt);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Request Payout</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Math.min(Number(e.target.value), availableBalance))}
                                min={100}
                                max={availableBalance}
                                required
                                className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Available: {formatAmount(availableBalance)} • Min: ₹100
                        </p>
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("upi")}
                                className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${paymentMethod === "upi"
                                        ? "border-emerald-500 bg-emerald-50"
                                        : "border-slate-200 hover:border-slate-300"
                                    }`}
                            >
                                <Smartphone className={`w-5 h-5 ${paymentMethod === "upi" ? "text-emerald-600" : "text-slate-400"}`} />
                                <span className={`font-medium ${paymentMethod === "upi" ? "text-emerald-700" : "text-slate-700"}`}>UPI</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("bank_transfer")}
                                className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${paymentMethod === "bank_transfer"
                                        ? "border-emerald-500 bg-emerald-50"
                                        : "border-slate-200 hover:border-slate-300"
                                    }`}
                            >
                                <Building2 className={`w-5 h-5 ${paymentMethod === "bank_transfer" ? "text-emerald-600" : "text-slate-400"}`} />
                                <span className={`font-medium ${paymentMethod === "bank_transfer" ? "text-emerald-700" : "text-slate-700"}`}>Bank</span>
                            </button>
                        </div>
                    </div>

                    {/* UPI Details */}
                    {paymentMethod === "upi" && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">UPI ID</label>
                            <input
                                type="text"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder="name@upi"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    )}

                    {/* Bank Details */}
                    {paymentMethod === "bank_transfer" && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Account Holder Name</label>
                                <input
                                    type="text"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                                <input
                                    type="text"
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label>
                                <input
                                    type="text"
                                    value={ifscCode}
                                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || amount < 100}
                            className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {submitting ? "Submitting..." : `Request ${formatAmount(amount)}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
