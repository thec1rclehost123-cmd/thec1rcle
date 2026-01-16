"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    RefreshCw,
    Check,
    X,
    Clock,
    AlertTriangle,
    DollarSign,
    User,
    Calendar,
    Ticket,
    ChevronDown,
    ChevronUp,
    Shield,
    Loader2,
    Search,
    Filter,
    ArrowRight,
    CircleDashed,
    CreditCard
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface RefundRequest {
    id: string;
    orderId: string;
    eventId: string;
    eventName?: string;
    customerId: string;
    customerName?: string;
    customerEmail?: string;
    amount: number;
    reason: string;
    status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'rejected';
    approvalType: 'auto' | 'single' | 'dual';
    approversRequired: number;
    approvers: Array<{ uid: string; name: string; at: string }>;
    createdAt: string;
    isPartial: boolean;
}

export default function RefundsPage() {
    const { user } = useAuth();
    const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (user) fetchRefundRequests();
    }, [user, filter]);

    const fetchRefundRequests = async () => {
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/refunds?status=${filter}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setRefundRequests(data.refunds || []);
        } catch (error) {
            console.error('Failed to fetch refund requests:', error);
            // Mock data for development
            setRefundRequests([
                {
                    id: '1',
                    orderId: 'ORD-001',
                    eventId: 'evt-1',
                    eventName: 'NYE 2026 Bash',
                    customerId: 'user-1',
                    customerName: 'John Doe',
                    customerEmail: 'john@example.com',
                    amount: 2500,
                    reason: 'Cannot attend due to travel',
                    status: 'pending',
                    approvalType: 'single',
                    approversRequired: 1,
                    approvers: [],
                    createdAt: new Date().toISOString(),
                    isPartial: false
                },
                {
                    id: '2',
                    orderId: 'ORD-002',
                    eventId: 'evt-2',
                    eventName: 'Tech Conference 2026',
                    customerId: 'user-2',
                    customerName: 'Jane Smith',
                    customerEmail: 'jane@example.com',
                    amount: 8500,
                    reason: 'Event date conflict',
                    status: 'pending',
                    approvalType: 'dual',
                    approversRequired: 2,
                    approvers: [{ uid: 'admin-1', name: 'Admin One', at: new Date().toISOString() }],
                    createdAt: new Date(Date.now() - 3600000).toISOString(),
                    isPartial: false
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (refundId: string) => {
        setProcessing(refundId);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/refunds/${refundId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                fetchRefundRequests();
            }
        } catch (error) {
            console.error('Failed to approve refund:', error);
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (refundId: string, reason: string) => {
        setProcessing(refundId);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/refunds/${refundId}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            });

            if (res.ok) {
                fetchRefundRequests();
            }
        } catch (error) {
            console.error('Failed to reject refund:', error);
        } finally {
            setProcessing(null);
        }
    };

    const getStatusStyle = (status: string) => {
        const styles = {
            pending: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
            approved: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
            processing: 'bg-iris/10 border-iris/20 text-iris',
            completed: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
            failed: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
            rejected: 'bg-zinc-800 border-white/5 text-zinc-500'
        };
        return styles[status] || styles.pending;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-4 w-4 text-iris" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">Financial Operations</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Refund Processing</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Review customer refund requests, authorize payments, and manage financial disputes.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const headers = ["ID", "Order ID", "Event", "Customer", "Email", "Amount", "Status", "Date"];
                            const rows = refundRequests.map(r => [
                                r.id,
                                r.orderId,
                                r.eventName || 'N/A',
                                r.customerName || 'N/A',
                                r.customerEmail || 'N/A',
                                r.amount,
                                r.status,
                                r.createdAt ? new Date(r.createdAt).toISOString() : 'N/A'
                            ]);

                            const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
                            const blob = new Blob([csvContent], { type: "text/csv" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `refund_history_${new Date().toISOString().slice(0, 10)}.csv`;
                            link.click();
                        }}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
                    >
                        <ArrowRight className="w-4 h-4" />
                        Export History
                    </button>
                    <button
                        onClick={fetchRefundRequests}
                        disabled={loading}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Queue
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
                        <Clock className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">Awaiting Review</p>
                        <p className="text-3xl font-light text-white tracking-tight font-mono-numbers">
                            {refundRequests.filter(r => r.status === 'pending').length}
                        </p>
                    </div>
                </div>
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
                        <Shield className="h-5 w-5 text-iris" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">Verification Needed</p>
                        <p className="text-3xl font-light text-white tracking-tight font-mono-numbers text-iris">
                            {refundRequests.filter(r => r.approvalType === 'dual' && r.status === 'pending').length}
                        </p>
                    </div>
                </div>
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
                        <DollarSign className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">Total Payout Value</p>
                        <p className="text-3xl font-light text-white tracking-tight font-mono-numbers">
                            ₹{refundRequests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {(['pending', 'all'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f
                            ? 'bg-white text-black shadow-lg shadow-white/5'
                            : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        {f === 'pending' ? 'Active Requests' : 'Full History'}
                    </button>
                ))}
            </div>

            {/* Refund List */}
            {loading ? (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-28 bg-white/[0.02] animate-pulse rounded-xl border border-white/5" />
                    ))}
                </div>
            ) : refundRequests.length === 0 ? (
                <div className="py-24 text-center rounded-xl border border-[#ffffff08] bg-obsidian-surface/50">
                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                        <Check className="h-8 w-8 text-emerald-500" strokeWidth={1} />
                    </div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Queue Sanitized</h3>
                    <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest">No pending refund requests require attention.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {refundRequests.map((request) => {
                            const isExpanded = expandedId === request.id;
                            const pendingApprovals = request.approversRequired - request.approvers.length;

                            return (
                                <motion.div
                                    key={request.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="rounded-xl bg-obsidian-surface border border-[#ffffff08] overflow-hidden group hover:border-[#ffffff15] transition-all"
                                >
                                    {/* Main Row */}
                                    <div className="p-7 flex items-center gap-8">
                                        <div className="w-32">
                                            <p className="text-3xl font-light text-white tracking-tight font-mono-numbers">
                                                ₹{request.amount.toLocaleString()}
                                            </p>
                                            {request.isPartial && (
                                                <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">Partial Refund</p>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <p className="text-lg font-semibold text-white tracking-tight truncate">
                                                    {request.customerName || request.customerEmail}
                                                </p>
                                                <div className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border ${getStatusStyle(request.status)}`}>
                                                    {request.status}
                                                </div>
                                                {request.approvalType === 'dual' && (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-iris/10 border border-iris/20 text-iris text-[9px] font-bold uppercase tracking-widest">
                                                        <Shield className="w-3 h-3" strokeWidth={2} />
                                                        Requires Dual Verification
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                                                <span>{request.eventName}</span>
                                                <div className="h-1 w-1 bg-zinc-800 rounded-full" />
                                                <span>Ref: {request.orderId}</span>
                                            </div>
                                        </div>

                                        {request.status === 'pending' && request.approvalType === 'dual' && (
                                            <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2 rounded-xl">
                                                <div className="flex -space-x-2">
                                                    {[...Array(request.approversRequired)].map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-8 h-8 rounded-full border-2 border-obsidian-surface flex items-center justify-center transition-colors ${i < request.approvers.length
                                                                ? 'bg-emerald-500 text-white'
                                                                : 'bg-zinc-800 text-zinc-600'
                                                                }`}
                                                        >
                                                            {i < request.approvers.length ? (
                                                                <Check className="w-4 h-4" />
                                                            ) : (
                                                                <User className="w-4 h-4" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 pr-2">
                                                    {pendingApprovals} pending
                                                </p>
                                            </div>
                                        )}

                                        {request.status === 'pending' && (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleApprove(request.id)}
                                                    disabled={processing === request.id}
                                                    className="h-11 px-6 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg shadow-white/5 flex items-center gap-2"
                                                >
                                                    {processing === request.id ? (
                                                        <CircleDashed className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Check className="w-4 h-4" />
                                                    )}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReject(request.id, 'Declined by administration.')}
                                                    disabled={processing === request.id}
                                                    className="h-11 px-6 rounded-xl bg-white/5 border border-white/10 text-zinc-500 text-[11px] font-bold uppercase tracking-widest hover:text-rose-500 hover:border-rose-500/20 hover:bg-rose-500/5 transition-all flex items-center gap-2"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Reject
                                                </button>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : request.id)}
                                            className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${isExpanded ? 'bg-white/10 text-white' : 'text-zinc-700 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Expanded Details */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                className="border-t border-[#ffffff05] bg-white/[0.01]"
                                            >
                                                <div className="p-8 grid grid-cols-3 gap-12">
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Customer Profile</p>
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-semibold text-white">{request.customerName}</p>
                                                            <p className="text-xs text-zinc-500">{request.customerEmail}</p>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Request Context</p>
                                                        <div className="space-y-1">
                                                            <p className="text-sm text-zinc-400 font-medium">"{request.reason}"</p>
                                                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1.5">
                                                                <Clock className="w-3 h-3" /> Received: {formatDate(request.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Approval Status</p>
                                                        {request.approvers.length === 0 ? (
                                                            <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest italic pt-2">No verifications recorded.</p>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {request.approvers.map((approver, i) => (
                                                                    <div key={i} className="flex flex-col">
                                                                        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-500 uppercase tracking-tight">
                                                                            <Check className="w-3.5 h-3.5" /> {approver.name}
                                                                        </div>
                                                                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest ml-5">{formatDate(approver.at)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
