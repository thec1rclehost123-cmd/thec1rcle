"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, IndianRupee, CreditCard, ArrowDownLeft, Clock, CheckCircle2, ShieldCheck, TrendingUp, RotateCcw, ShieldAlert, User, Calendar, ExternalLink, ChevronRight, Loader2, X } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminPayments() {
    const { user } = useAuth();
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchTxns = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=orders&limit=50', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setTxns(json.data || []);
        } catch (err) {
            console.error("Failed to fetch payments", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLedger = async (orderId) => {
        setLoadingLedger(true);
        setLedgerEntries([]);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/ledger?entityId=${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setLedgerEntries(json.data || []);
        } catch (err) {
            console.error("Failed to fetch ledger", err);
        } finally {
            setLoadingLedger(false);
        }
    };

    useEffect(() => {
        if (user) fetchTxns();
    }, [user]);

    useEffect(() => {
        if (selectedTxn) fetchLedger(selectedTxn.id);
    }, [selectedTxn]);

    const handleAction = async (reason, targetId, inputValue, evidence) => {
        if (!modalConfig) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: modalConfig.action,
                    targetId: selectedTxn.id,
                    reason,
                    evidence
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Action failed");
            }

            const successJson = await res.json();
            if (successJson.message) alert(successJson.message);

            await fetchTxns();
            // Refresh selection
            const updated = txns.find(t => t.id === selectedTxn.id);
            if (updated) setSelectedTxn(updated);

        } catch (err) {
            alert(`Authority Error: ${err.message}`);
            throw err;
        }
    };

    const filtered = txns.filter(t =>
        t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.razorpay_payment_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <IndianRupee className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Financial Stream</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Payment Ledger</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor floor activity, track platform transactions, and manage fund reversals.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-500">
                        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Secure Ledger Active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Table Area */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Search by Reference, Customer or Payment ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-medium placeholder:text-zinc-600 text-white"
                        />
                    </div>

                    <div className="bg-obsidian-surface rounded-xl border border-[#ffffff08] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Timeline</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Customer</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Transaction</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Amount</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ffffff05]">
                                {loading ? (
                                    [...Array(8)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-white/5 rounded-full w-full"></div></td>
                                        </tr>
                                    ))
                                ) : filtered.length > 0 ? filtered.map((txn) => (
                                    <tr
                                        key={txn.id}
                                        onClick={() => setSelectedTxn(txn)}
                                        className={`group cursor-pointer transition-colors ${selectedTxn?.id === txn.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                                    >
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-semibold text-white truncate">{new Date(txn.createdAt?._seconds * 1000 || txn.createdAt).toLocaleDateString()}</p>
                                            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tighter mt-0.5">{new Date(txn.createdAt?._seconds * 1000 || txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-semibold text-white truncate">{txn.customerName || 'Anonymous'}</p>
                                            <p className="text-[10px] text-zinc-500 font-medium truncate uppercase tracking-tighter mt-0.5">{txn.customerEmail}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-black/20 border border-white/5 flex items-center justify-center">
                                                    <ArrowDownLeft className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 truncate">{txn.eventTitle || 'Event Entry'}</p>
                                                    <p className="text-[9px] text-zinc-600 font-medium truncate mt-0.5">#{txn.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-bold text-white tracking-tight">₹{txn.amount}</p>
                                            <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Final Value</p>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className={`h-1.5 w-1.5 rounded-full ${txn.status === 'captured' || txn.status === 'paid' ? 'bg-emerald-500' : txn.status === 'refunded' ? 'bg-iris' : 'bg-amber-500'}`} />
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${txn.status === 'captured' || txn.status === 'paid' ? 'text-emerald-500' : txn.status === 'refunded' ? 'text-iris' : 'text-amber-500'}`}>
                                                    {txn.status || 'pending'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="px-6 py-20 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-700 italic">No transactions detected.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedTxn ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedTxn(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="space-y-6">
                                    <div className="flex flex-col items-center text-center space-y-4">
                                        <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-white shadow-inner">
                                            <IndianRupee className="h-10 w-10 text-emerald-500/50" />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-bold tracking-tight text-white mb-1.5">₹{selectedTxn.amount}</h3>
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${selectedTxn.status === 'refunded' ? 'bg-iris/10 text-iris border border-iris/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                {selectedTxn.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 pt-4">
                                        <div className="p-4 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-1">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Customer</p>
                                            <p className="text-sm font-semibold text-white truncate">{selectedTxn.customerName || 'Anonymous'}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-1">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Timestamp</p>
                                            <p className="text-sm font-semibold text-white">{new Date(selectedTxn.createdAt?._seconds * 1000 || selectedTxn.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* History */}
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between px-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Event History</p>
                                            {loadingLedger && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
                                        </div>
                                        <div className="space-y-2">
                                            {ledgerEntries.length > 0 ? ledgerEntries.map((entry, i) => (
                                                <div key={i} className="p-4 rounded-xl bg-black/20 border border-white/[0.02] flex items-center justify-between group hover:bg-white/[0.02] transition-all">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{entry.state}</p>
                                                        <p className="text-[9px] font-medium text-zinc-500 mt-0.5 truncate pr-4">{entry.description}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className={`text-[11px] font-bold ${entry.amount >= 0 ? 'text-emerald-500' : 'text-iris'}`}>
                                                            {entry.amount >= 0 ? '+' : ''}{entry.amount}
                                                        </p>
                                                        <p className="text-[8px] text-zinc-700 font-bold mt-0.5">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                            )) : !loadingLedger && (
                                                <p className="text-[10px] text-zinc-700 font-bold italic text-center py-6 bg-black/20 rounded-xl border border-white/[0.02]">Audit trace unavailable.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-[#ffffff05] space-y-4">
                                        <div className="flex items-center gap-2 px-1 text-iris">
                                            <ShieldAlert className="h-4 w-4" strokeWidth={1.5} />
                                            <p className="text-[10px] font-bold uppercase tracking-[0.1em]">Cash Reversal</p>
                                        </div>

                                        <button
                                            disabled={selectedTxn.status === 'refunded'}
                                            onClick={() => setModalConfig({
                                                action: 'FINANCIAL_REFUND',
                                                title: 'Issue Refund',
                                                message: 'Verify a full fund reversal. The amount will be sent back to the customer origin.',
                                                label: 'Execute Refund',
                                                type: 'danger',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-5 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all group disabled:opacity-20 disabled:grayscale"
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <RotateCcw className="h-6 w-6 text-iris" strokeWidth={1.5} />
                                                <div>
                                                    <span className="block text-sm font-bold tracking-tight">Manual Refund</span>
                                                    <span className="block text-[9px] text-iris font-bold uppercase tracking-widest mt-0.5 opacity-80">Full Reversal</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-iris group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 text-center">
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic opacity-50">Monitoring immutable cash trails.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <CreditCard className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select a transaction<br />for deep audit inspect.</p>
                        </div>
                    )}
                </aside>
            </div>


            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={handleAction}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type={modalConfig.type}
                    isTier3={modalConfig.isTier3}
                />
            )}
        </div>
    );
}
