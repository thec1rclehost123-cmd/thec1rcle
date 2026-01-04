"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, IndianRupee, CreditCard, ArrowDownLeft, Clock, CheckCircle2, ShieldCheck, TrendingUp, RotateCcw, ShieldAlert, User, Calendar, ExternalLink, ChevronRight } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminPayments() {
    const { user } = useAuth();
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTxn, setSelectedTxn] = useState(null);
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

    useEffect(() => {
        if (user) fetchTxns();
    }, [user]);

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

    return (
        <div className="space-y-12 pb-20">
            {/* Executive Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <IndianRupee className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Capital Management</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Financial Oversight</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Observational transparency into platform-wide capital flow, transaction density, and settlement status. <span className="text-slate-900">Audit ledgers, authorize reversals, and monitor liquidity.</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-6 py-3 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center gap-3 shadow-sm">
                        <ShieldCheck className="h-4 w-4 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Tier 3 Audit Active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                {/* Ledger Area */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filter registry by Order ID, Razorpay ID or User Hash..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Temporal Pulse</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Inbound Identity</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Asset Allocation</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Volume</th>
                                        <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Settlement</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        [...Array(10)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={5} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : txns.filter(t =>
                                        t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        t.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        t.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        t.razorpay_payment_id?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length > 0 ? txns.filter(t =>
                                        t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        t.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        t.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        t.razorpay_payment_id?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).map((txn) => (
                                        <tr
                                            key={txn.id}
                                            onClick={() => setSelectedTxn(txn)}
                                            className={`hover:bg-slate-50 transition-all cursor-pointer group ${selectedTxn?.id === txn.id ? 'bg-indigo-50/50' : ''}`}
                                        >
                                            <td className="px-10 py-8">
                                                <p className="text-xs font-black text-slate-900 leading-none">{new Date(txn.createdAt?._seconds * 1000 || txn.createdAt).toLocaleDateString()}</p>
                                                <p className="text-[10px] text-slate-400 font-bold tracking-tighter mt-1.5">{new Date(txn.createdAt?._seconds * 1000 || txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </td>
                                            <td className="px-10 py-8">
                                                <p className="text-base font-black tracking-tight text-slate-900 leading-none">{txn.customerName || 'Anonymous Identity'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-1.5 italic tracking-tighter truncate max-w-[150px]">ID: {txn.id}</p>
                                            </td>
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-inner">
                                                        <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                                                    </div>
                                                    <div className="max-w-[150px]">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Yield Source</p>
                                                        <p className="text-[10px] text-slate-900 font-black mt-1 truncate">{txn.eventTitle || 'ASSET_TRANSFER'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8 whitespace-nowrap">
                                                <p className="text-base font-black text-slate-900 tracking-tighter">₹{txn.amount}</p>
                                                <p className="text-[10px] text-slate-400 font-bold italic mt-1">Gateway: Razorpay</p>
                                            </td>
                                            <td className="px-10 py-8 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className={`h-2.5 w-1.5 rounded-full ring-4 ${txn.status === 'captured' || txn.status === 'paid' ? 'bg-emerald-500 ring-emerald-50' : txn.status === 'refunded' ? 'bg-indigo-500 ring-indigo-50' : 'bg-amber-500 ring-amber-50'}`}></span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${txn.status === 'captured' || txn.status === 'paid' ? 'text-emerald-600' : txn.status === 'refunded' ? 'text-indigo-600' : 'text-amber-600'}`}>
                                                        {txn.status || 'pending'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="px-10 py-24 text-center text-sm text-slate-400 font-black uppercase tracking-widest italic bg-slate-50/30">Universal financial ledger is clear.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Inspect Column */}
                <aside className="lg:col-span-1">
                    {selectedTxn ? (
                        <div className="sticky top-24 p-12 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction Object</p>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedTxn.status === 'refunded' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                        {selectedTxn.paymentStatus || selectedTxn.status}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-5xl font-black tracking-tighter text-slate-900">₹{selectedTxn.amount}</h3>
                                    <p className="text-[10px] text-slate-400 font-black mt-2 break-all uppercase tracking-widest">REF: {selectedTxn.id}</p>
                                </div>
                            </div>

                            <div className="space-y-6 pt-10 border-t border-slate-100">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                        <User className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Originator</p>
                                        <p className="text-sm text-slate-900 font-bold truncate leading-tight mt-1">{selectedTxn.customerName || 'Anonymous Identity'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-5">
                                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                        <Calendar className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorization Date</p>
                                        <p className="text-sm text-slate-900 font-bold leading-tight mt-1">{new Date(selectedTxn.createdAt?._seconds * 1000 || selectedTxn.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tier 3 Authority Enclosure */}
                            <div className="pt-10 border-t border-slate-100 space-y-6">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="h-5 w-5 text-red-600" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Critical Authority — Tier 3</p>
                                </div>

                                <button
                                    disabled={selectedTxn.status === 'refunded' || selectedTxn.paymentStatus === 'refunded'}
                                    onClick={() => setModalConfig({
                                        action: 'FINANCIAL_REFUND',
                                        title: 'Financial Reversal Authority',
                                        message: 'Confirm total reversal of captured funds. This action triggers a refund via the payment gateway.',
                                        label: 'Authorize Refund',
                                        type: 'danger',
                                        isTier3: true
                                    })}
                                    className="w-full flex items-center justify-between p-6 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl shadow-red-200 group disabled:opacity-30 disabled:grayscale"
                                >
                                    <div className="flex items-center gap-4">
                                        <RotateCcw className="h-6 w-6" />
                                        <div className="text-left">
                                            <span className="block text-sm font-black uppercase tracking-widest">Reverse Capital Flow</span>
                                            <span className="block text-[9px] opacity-70 mt-1 font-bold">Gateway Resolution</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                </button>

                                <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed text-center px-4">
                                    Reversals require dual-signature authorization.<br />120m cooling protocol applies.
                                </p>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <CreditCard className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a transaction<br />from the ledger<br />for audit inspection.</p>
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
