"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState, useMemo } from "react";
import { IndianRupee, CreditCard, ArrowDownLeft, ShieldCheck, TrendingUp, RotateCcw, ShieldAlert, User, Calendar, X, Loader2, ChevronRight } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { ActionDrawer } from "@/components/ui/ActionDrawer";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminPayments() {
    const { user } = useAuth();
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [modalConfig, setModalConfig] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

    const filtered = useMemo(() => {
        return txns;
    }, [txns]);

    const columns = [
        { 
            key: 'createdAt', 
            label: 'Timeline', 
            sortable: true,
            render: (val) => {
                const date = new Date(val?._seconds * 1000 || val);
                return (
                    <div>
                        <p className="text-sm font-semibold text-white truncate">{date.toLocaleDateString()}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tighter mt-0.5">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                );
            }
        },
        { 
            key: 'customerName', 
            label: 'Customer', 
            sortable: true,
            render: (val, row) => (
                <div>
                    <p className="text-sm font-semibold text-white truncate">{val || 'Anonymous'}</p>
                    <p className="text-[10px] text-zinc-500 font-medium truncate uppercase tracking-tighter mt-0.5">{row.customerEmail}</p>
                </div>
            )
        },
        { 
            key: 'id', 
            label: 'Transaction', 
            sortable: true,
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-black/20 border border-white/5 flex items-center justify-center">
                        <ArrowDownLeft className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 truncate">{row.eventTitle || 'Event Entry'}</p>
                        <p className="text-[9px] text-zinc-600 font-medium truncate mt-0.5">#{val.slice(0, 8)}</p>
                    </div>
                </div>
            )
        },
        { 
            key: 'amount', 
            label: 'Amount', 
            sortable: true,
            render: (val) => (
                <div>
                    <p className="text-sm font-bold text-white tracking-tight">₹{val}</p>
                    <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Final Value</p>
                </div>
            )
        },
        { 
            key: 'status', 
            label: 'Status', 
            sortable: true,
            render: (val) => (
                <div className="flex items-center justify-end gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${val === 'captured' || val === 'paid' ? 'bg-emerald-500' : val === 'refunded' ? 'bg-iris' : 'bg-amber-500'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${val === 'captured' || val === 'paid' ? 'text-emerald-500' : val === 'refunded' ? 'text-iris' : 'text-amber-500'}`}>
                        {val || 'pending'}
                    </span>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-12 pb-24">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
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
            </header>

            <DataTable 
                columns={columns}
                data={filtered}
                searchPlaceholder="Search by Reference, Customer or Payment ID..."
                onRowClick={(txn) => {
                    setSelectedTxn(txn);
                    setIsDrawerOpen(true);
                }}
            />

            <ActionDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={`Transaction Details`}
                subtitle={`Ref: #${selectedTxn?.id}`}
                footer={
                    <div className="pt-6 border-t border-[#ffffff05]">
                         <div className="flex items-center gap-2 px-1 text-iris mb-4">
                            <ShieldAlert className="h-4 w-4" strokeWidth={1.5} />
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em]">Cash Reversal</p>
                        </div>

                        <button
                            disabled={selectedTxn?.status === 'refunded'}
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
                }
            >
                <div className="space-y-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-white shadow-inner">
                            <IndianRupee className="h-10 w-10 text-emerald-500/50" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-bold tracking-tight text-white mb-1.5">₹{selectedTxn?.amount}</h3>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${selectedTxn?.status === 'refunded' ? 'bg-iris/10 text-iris border border-iris/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                {selectedTxn?.status}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Customer</p>
                            <p className="text-sm font-semibold text-white truncate">{selectedTxn?.customerName || 'Anonymous'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Timestamp</p>
                            <p className="text-sm font-semibold text-white">{selectedTxn ? new Date(selectedTxn.createdAt?._seconds * 1000 || selectedTxn.createdAt).toLocaleString() : 'N/A'}</p>
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
                </div>
            </ActionDrawer>

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
