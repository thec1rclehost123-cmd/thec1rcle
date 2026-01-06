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
    Loader2
} from "lucide-react";

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
    const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchRefundRequests();
    }, [filter]);

    const fetchRefundRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/refunds?status=${filter}`);
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
            const res = await fetch(`/api/admin/refunds/${refundId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
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
            const res = await fetch(`/api/admin/refunds/${refundId}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    const getStatusBadge = (request: RefundRequest) => {
        const badges = {
            pending: { color: 'bg-amber-100 text-amber-700', label: 'Pending' },
            approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
            processing: { color: 'bg-blue-100 text-blue-700', label: 'Processing' },
            completed: { color: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
            failed: { color: 'bg-red-100 text-red-700', label: 'Failed' },
            rejected: { color: 'bg-gray-100 text-gray-700', label: 'Rejected' }
        };

        return badges[request.status] || badges.pending;
    };

    const getApprovalBadge = (type: string) => {
        if (type === 'dual') {
            return (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                    <Shield className="w-3 h-3" />
                    DUAL APPROVAL
                </span>
            );
        }
        return null;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-[#f5f5f7] p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-[28px] font-bold text-[#1d1d1f]">
                            Refund Requests
                        </h1>
                        <p className="text-[15px] text-[#86868b]">
                            Review and approve customer refund requests
                        </p>
                    </div>

                    <button
                        onClick={fetchRefundRequests}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[rgba(0,0,0,0.08)] text-[14px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    {(['pending', 'all'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all ${filter === f
                                ? 'bg-[#1d1d1f] text-white'
                                : 'bg-white text-[#1d1d1f] hover:bg-[#e8e8ed]'
                                }`}
                        >
                            {f === 'pending' ? 'Pending Approval' : 'All Requests'}
                        </button>
                    ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-5 rounded-2xl bg-white border border-[rgba(0,0,0,0.06)]">
                        <p className="text-[13px] text-[#86868b] mb-1">Pending</p>
                        <p className="text-[28px] font-bold text-amber-600">
                            {refundRequests.filter(r => r.status === 'pending').length}
                        </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-[rgba(0,0,0,0.06)]">
                        <p className="text-[13px] text-[#86868b] mb-1">Dual Approval Required</p>
                        <p className="text-[28px] font-bold text-purple-600">
                            {refundRequests.filter(r => r.approvalType === 'dual' && r.status === 'pending').length}
                        </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-[rgba(0,0,0,0.06)]">
                        <p className="text-[13px] text-[#86868b] mb-1">Total Value</p>
                        <p className="text-[28px] font-bold text-[#1d1d1f]">
                            ₹{refundRequests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Refund List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-[#86868b] animate-spin" />
                    </div>
                ) : refundRequests.length === 0 ? (
                    <div className="text-center py-20 rounded-2xl bg-white border border-[rgba(0,0,0,0.06)]">
                        <Check className="w-12 h-12 text-[#34c759] mx-auto mb-4" />
                        <p className="text-[17px] font-semibold text-[#1d1d1f]">All caught up!</p>
                        <p className="text-[14px] text-[#86868b]">No pending refund requests</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {refundRequests.map((request) => {
                                const statusBadge = getStatusBadge(request);
                                const isExpanded = expandedId === request.id;
                                const pendingApprovals = request.approversRequired - request.approvers.length;

                                return (
                                    <motion.div
                                        key={request.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="rounded-2xl bg-white border border-[rgba(0,0,0,0.06)] overflow-hidden"
                                    >
                                        {/* Main Row */}
                                        <div className="p-5 flex items-center gap-4">
                                            {/* Amount */}
                                            <div className="w-24 text-center">
                                                <p className="text-[24px] font-bold text-[#1d1d1f]">
                                                    ₹{request.amount.toLocaleString()}
                                                </p>
                                                {request.isPartial && (
                                                    <p className="text-[10px] text-amber-600 font-medium">PARTIAL</p>
                                                )}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-[15px] font-semibold text-[#1d1d1f] truncate">
                                                        {request.customerName || request.customerEmail}
                                                    </p>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge.color}`}>
                                                        {statusBadge.label}
                                                    </span>
                                                    {getApprovalBadge(request.approvalType)}
                                                </div>
                                                <p className="text-[13px] text-[#86868b] truncate">
                                                    {request.eventName} • Order {request.orderId}
                                                </p>
                                                <p className="text-[12px] text-[#86868b] mt-1 line-clamp-1">
                                                    "{request.reason}"
                                                </p>
                                            </div>

                                            {/* Approval Progress */}
                                            {request.status === 'pending' && request.approvalType === 'dual' && (
                                                <div className="text-center px-4">
                                                    <div className="flex gap-1 mb-1">
                                                        {[...Array(request.approversRequired)].map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className={`w-6 h-6 rounded-full flex items-center justify-center ${i < request.approvers.length
                                                                    ? 'bg-[#34c759] text-white'
                                                                    : 'bg-[#e5e5ea] text-[#86868b]'
                                                                    }`}
                                                            >
                                                                {i < request.approvers.length ? (
                                                                    <Check className="w-3 h-3" />
                                                                ) : (
                                                                    <User className="w-3 h-3" />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-[#86868b]">
                                                        {pendingApprovals} more needed
                                                    </p>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            {request.status === 'pending' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleApprove(request.id)}
                                                        disabled={processing === request.id}
                                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#34c759] text-white text-[13px] font-semibold hover:bg-[#2db84a] transition-colors disabled:opacity-50"
                                                    >
                                                        {processing === request.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Check className="w-4 h-4" />
                                                        )}
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(request.id, 'Rejected by admin')}
                                                        disabled={processing === request.id}
                                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#ff3b30] text-[#ff3b30] text-[13px] font-semibold hover:bg-[#ff3b30]/5 transition-colors disabled:opacity-50"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Reject
                                                    </button>
                                                </div>
                                            )}

                                            {/* Expand Toggle */}
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : request.id)}
                                                className="w-8 h-8 rounded-full hover:bg-[#f5f5f7] flex items-center justify-center"
                                            >
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-[#86868b]" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-[#86868b]" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Expanded Details */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-[rgba(0,0,0,0.06)]"
                                                >
                                                    <div className="p-5 grid grid-cols-3 gap-6">
                                                        <div>
                                                            <p className="text-[11px] text-[#86868b] uppercase tracking-wide mb-2">Customer</p>
                                                            <p className="text-[14px] font-medium text-[#1d1d1f]">{request.customerName}</p>
                                                            <p className="text-[13px] text-[#86868b]">{request.customerEmail}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] text-[#86868b] uppercase tracking-wide mb-2">Request Details</p>
                                                            <p className="text-[14px] text-[#1d1d1f]">{request.reason}</p>
                                                            <p className="text-[12px] text-[#86868b] mt-1">
                                                                Requested: {formatDate(request.createdAt)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] text-[#86868b] uppercase tracking-wide mb-2">Approval History</p>
                                                            {request.approvers.length === 0 ? (
                                                                <p className="text-[13px] text-[#86868b]">No approvals yet</p>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    {request.approvers.map((approver, i) => (
                                                                        <p key={i} className="text-[13px] text-[#1d1d1f]">
                                                                            ✓ {approver.name} • {formatDate(approver.at)}
                                                                        </p>
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
        </div>
    );
}
