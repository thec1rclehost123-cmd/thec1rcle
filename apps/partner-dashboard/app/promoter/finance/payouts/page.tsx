"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Wallet, Clock, CheckCircle2, XCircle, RefreshCw, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { formatINR } from "@/lib/finance/definitions";

type PayoutStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

interface Payout {
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
    updatedAt?: string;
    paymentDetails?: { upiId?: string; accountNumber?: string };
    eventName?: string;
    buyerName?: string;
    date?: string | null;
}

interface Balance {
    totalEarned: number;
    available: number;
    pending: number;
    totalPaid: number;
}

const STATUS_CONFIG: Record<PayoutStatus, { label: string; classes: string }> = {
    pending:    { label: "Pending",    classes: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    processing: { label: "Processing", classes: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    completed:  { label: "Paid",       classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    failed:     { label: "Failed",     classes: "bg-red-500/10 text-red-400 border-red-500/20" },
    cancelled:  { label: "Cancelled",  classes: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

export default function PromoterPayoutsPage() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const promoterId = profile?.activeMembership?.partnerId;

    const [loading, setLoading]       = useState(true);
    const [balance, setBalance]       = useState<Balance | null>(null);
    const [payouts, setPayouts]       = useState<Payout[]>([]);
    const [error, setError]           = useState<string | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [showForm, setShowForm]     = useState(false);

    // Request payout form state
    const [amount, setAmount]         = useState("");
    const [method, setMethod]         = useState("upi");
    const [upiId, setUpiId]           = useState("");
    const [formError, setFormError]   = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState(false);

    const fetchData = useCallback(async () => {
        if (!promoterId) return;
        setLoading(true);
        setError(null);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
            const payoutRes = await fetch(`/api/partners/promoters/payouts?promoterId=${promoterId}`, { headers });
            if (!payoutRes.ok) throw new Error("Failed to load payouts");
            const payoutData = await payoutRes.json();
            setBalance(payoutData.balance || null);
            setPayouts(payoutData.payouts || []);
        } catch (e: any) {
            setError(e.message || "Failed to load payout data");
        } finally {
            setLoading(false);
        }
    }, [promoterId, getIdToken]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRequestPayout = async () => {
        setFormError(null);
        const amt = parseFloat(amount);
        if (!amt || amt < 100) { setFormError("Minimum payout is ₹100"); return; }
        if (method === "upi" && !upiId.trim()) { setFormError("UPI ID is required"); return; }
        if (balance && amt > balance.available) { setFormError("Amount exceeds available balance"); return; }

        setRequesting(true);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const res = await fetch("/api/partners/promoters/payouts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>),
                },
                body: JSON.stringify({
                    promoterId,
                    amount: amt,
                    paymentMethod: method,
                    paymentDetails: method === "upi" ? { upiId } : {},
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Request failed");
            }
            setFormSuccess(true);
            setShowForm(false);
            setAmount("");
            setUpiId("");
            await fetchData();
        } catch (e: any) {
            setFormError(e.message || "Failed to submit payout request");
        } finally {
            setRequesting(false);
        }
    };

    const handleCancel = async (payoutId: string) => {
        if (!confirm("Cancel this payout request?")) return;
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            await fetch(`/api/partners/promoters/payouts?payoutId=${payoutId}`, {
                method: "DELETE",
                headers: (token ? { Authorization: `Bearer ${token}` } : {}) as HeadersInit,
            });
            await fetchData();
        } catch {
            // silent
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 pb-6 border-b border-border-subtle">
                <Link href="/promoter/finance" className="p-2 border border-border-subtle hover:bg-surface-elevated rounded-xl transition-colors text-text-secondary">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Payouts</h1>
                    <p className="text-sm text-text-secondary mt-0.5">Manage your payout requests and withdrawal history.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2.5 border border-border-subtle hover:bg-surface-elevated rounded-xl transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 text-text-secondary ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => { setShowForm(true); setFormError(null); setFormSuccess(false); }}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Request Payout
                    </button>
                </div>
            </div>

            {/* Balance KPIs */}
            {!loading && balance && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Available",   value: formatINR(balance.available),   icon: Wallet,        highlight: true },
                        { label: "Pending",     value: formatINR(balance.pending),     icon: Clock,         highlight: false },
                        { label: "Total Earned",value: formatINR(balance.totalEarned), icon: CheckCircle2,  highlight: false },
                        { label: "Total Paid",  value: formatINR(balance.totalPaid),   icon: CheckCircle2,  highlight: false },
                    ].map((s) => {
                        const Icon = s.icon;
                        return (
                            <div
                                key={s.label}
                                className={`flex flex-col p-5 rounded-2xl border ${s.highlight ? "border-emerald-500/20 bg-emerald-500/5" : "border-border-subtle bg-surface-elevated"}`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`h-4 w-4 ${s.highlight ? "text-emerald-400" : "text-text-muted"}`} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{s.label}</span>
                                </div>
                                <p className={`text-2xl font-bold tabular-nums ${s.highlight ? "text-emerald-400" : "text-text-primary"}`}>{s.value}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Payout request form */}
            {showForm && (
                <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="font-bold text-text-primary">New Payout Request</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Amount (₹)</label>
                            <input
                                type="number"
                                min="100"
                                max={balance?.available}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={`Max: ${balance ? formatINR(balance.available) : "—"}`}
                                className="bg-surface-base border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Method</label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="bg-surface-base border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                            >
                                <option value="upi">UPI</option>
                                <option value="bank_transfer">Bank Transfer</option>
                            </select>
                        </div>
                    </div>
                    {method === "upi" && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">UPI ID</label>
                            <input
                                type="text"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder="yourname@upi"
                                className="bg-surface-base border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>
                    )}
                    {formError && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {formError}
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={handleRequestPayout}
                            disabled={requesting}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                        >
                            {requesting ? "Submitting…" : "Submit Request"}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="border border-border-subtle hover:bg-surface-hover px-5 py-2.5 rounded-xl font-semibold text-sm text-text-secondary transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {formSuccess && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Payout request submitted. It will be processed in 1–3 business days.
                </div>
            )}

            {/* Payouts table */}
            {loading ? (
                <div className="w-full animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-surface-elevated rounded-2xl border border-border-subtle" />
                    ))}
                </div>
            ) : error ? (
                <div className="flex items-center gap-3 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-400">
                    <XCircle className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-semibold">Failed to load payouts</p>
                        <p className="text-sm opacity-80">{error}</p>
                    </div>
                    <button onClick={fetchData} className="ml-auto text-sm underline">Retry</button>
                </div>
            ) : (
                <div className="bg-surface-elevated rounded-2xl border border-border-subtle overflow-hidden">
                    <div className="p-5 border-b border-border-subtle bg-surface-base/50">
                        <h3 className="font-bold text-text-primary">Income History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                                <tr className="border-b border-border-subtle bg-surface-base/30">
                                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Source</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {payouts.map((p) => {
                                    const normalizedStatus = (p.status === "cleared" ? "completed" : p.status) as PayoutStatus;
                                    const sc = STATUS_CONFIG[normalizedStatus] ?? STATUS_CONFIG.pending;
                                    return (
                                        <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors">
                                            <td className="px-6 py-4 text-sm text-text-secondary">
                                                {(p.date || p.createdAt) ? new Date(p.date || p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Pending settlement"}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-text-primary font-medium capitalize">
                                                {p.eventName || p.paymentMethod?.replace("_", " ") || "—"}
                                                {p.buyerName && <span className="text-text-muted text-xs ml-2">({p.buyerName})</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${sc.classes}`}>
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold tabular-nums text-emerald-400">
                                                {formatINR(p.amount)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {normalizedStatus === "pending" && p.paymentMethod && (
                                                    <button
                                                        onClick={() => handleCancel(p.id)}
                                                        className="text-xs text-text-muted hover:text-red-400 transition-colors font-medium"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {payouts.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                                            No income yet. Ticket sales from your links will appear here.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
