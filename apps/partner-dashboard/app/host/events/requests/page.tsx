"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    MessageSquare,
    ChevronRight,
    Building2,
    RefreshCw,
    Eye,
    Edit3,
    Loader2,
    ArrowLeft
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";

interface SlotRequest {
    id: string;
    eventId: string;
    venueId: string;
    venueName: string;
    requestedDate: string;
    requestedStartTime: string;
    requestedEndTime: string;
    status: "pending" | "approved" | "rejected" | "counter_proposed" | "needs_changes";
    notes?: string;
    clubResponse?: string;
    alternativeDate?: string;
    alternativeStartTime?: string;
    alternativeEndTime?: string;
    createdAt: string;
    respondedAt?: string;
    event?: {
        id: string;
        title: string;
        poster?: string;
        lifecycle: string;
    };
}

export default function HostSlotRequestsPage() {
    const { profile } = useDashboardAuth();
    const [requests, setRequests] = useState<SlotRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
    const [selectedRequest, setSelectedRequest] = useState<SlotRequest | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const hostId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (hostId) {
            fetchRequests();
        }
    }, [hostId, activeTab]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const statusFilter = activeTab !== "all" ? `&status=${activeTab}` : "";
            const res = await fetch(`/api/slots?hostId=${hostId}${statusFilter}`);
            const data = await res.json();

            // Enrich with event details
            const enrichedRequests = await Promise.all(
                (data.requests || []).map(async (req: SlotRequest) => {
                    try {
                        const eventRes = await fetch(`/api/events/${req.eventId}`);
                        const eventData = await eventRes.json();
                        return { ...req, event: eventData.event };
                    } catch {
                        return req;
                    }
                })
            );

            setRequests(enrichedRequests);
        } catch (err) {
            console.error("Failed to fetch slot requests:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchRequests();
        setRefreshing(false);
    };

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { bg: string; text: string; icon: any; label: string }> = {
            pending: {
                bg: "bg-amber-50",
                text: "text-amber-600",
                icon: Clock,
                label: "Pending Review"
            },
            approved: {
                bg: "bg-emerald-50",
                text: "text-emerald-600",
                icon: CheckCircle2,
                label: "Approved"
            },
            rejected: {
                bg: "bg-rose-50",
                text: "text-rose-600",
                icon: XCircle,
                label: "Rejected"
            },
            counter_proposed: {
                bg: "bg-blue-50",
                text: "text-blue-600",
                icon: MessageSquare,
                label: "Counter Proposal"
            },
            needs_changes: {
                bg: "bg-orange-50",
                text: "text-orange-600",
                icon: Edit3,
                label: "Changes Requested"
            }
        };
        return configs[status] || configs.pending;
    };

    const pendingCount = requests.filter(r => r.status === "pending").length;
    const approvedCount = requests.filter(r => r.status === "approved").length;
    const rejectedCount = requests.filter(r => ["rejected", "needs_changes"].includes(r.status)).length;

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <Link
                        href="/host/partnerships"
                        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Venues
                    </Link>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Slot Requests</h1>
                    <p className="text-slate-500 text-base font-medium mt-2">
                        Track your event slot requests across all partner venues
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold rounded-xl transition-all"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                            <p className="text-3xl font-black text-amber-600 mt-1">{pendingCount}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-amber-500" />
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Approved</p>
                            <p className="text-3xl font-black text-emerald-600 mt-1">{approvedCount}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Needs Action</p>
                            <p className="text-3xl font-black text-rose-600 mt-1">{rejectedCount}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-rose-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto max-w-full scrollbar-hide">
                {[
                    { id: "pending", label: "Pending" },
                    { id: "approved", label: "Approved" },
                    { id: "rejected", label: "Rejected" },
                    { id: "all", label: "All" }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No {activeTab !== "all" ? activeTab : ""} requests</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                        {activeTab === "pending"
                            ? "You don't have any pending slot requests."
                            : activeTab === "approved"
                                ? "No approved requests yet. Keep submitting!"
                                : activeTab === "rejected"
                                    ? "No rejected requests. Great news!"
                                    : "Start by requesting a slot at one of your partner venues."}
                    </p>
                    <Link
                        href="/host/partnerships"
                        className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                        <Building2 className="w-4 h-4" />
                        View Partner Venues
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map(request => {
                        const statusConfig = getStatusConfig(request.status);
                        const StatusIcon = statusConfig.icon;

                        return (
                            <motion.div
                                key={request.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:shadow-slate-100 transition-all"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Event Poster */}
                                    <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                                        {request.event?.poster ? (
                                            <img
                                                src={request.event.poster}
                                                alt={request.event?.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Calendar className="w-8 h-8 text-slate-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Request Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">
                                                    {request.event?.title || "Untitled Event"}
                                                </h3>
                                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    {request.venueName}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text}`}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        {/* Date/Time */}
                                        <div className="flex items-center gap-6 mt-3 text-sm text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                {new Date(request.requestedDate).toLocaleDateString("en-IN", {
                                                    weekday: "short",
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric"
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                {request.requestedStartTime} - {request.requestedEndTime}
                                            </div>
                                        </div>

                                        {/* Venue Response */}
                                        {request.clubResponse && (
                                            <div className="mt-4 p-3 rounded-xl bg-slate-50 border-l-4 border-slate-300">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Venue Response</p>
                                                <p className="text-sm text-slate-600">{request.clubResponse}</p>
                                            </div>
                                        )}

                                        {/* Counter Proposal */}
                                        {request.status === "counter_proposed" && request.alternativeDate && (
                                            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">
                                                    Alternative Slot Proposed
                                                </p>
                                                <div className="flex items-center gap-4 text-sm text-blue-700">
                                                    <span>{request.alternativeDate}</span>
                                                    <span>{request.alternativeStartTime} - {request.alternativeEndTime}</span>
                                                </div>
                                                <div className="flex gap-2 mt-3">
                                                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">
                                                        Accept Alternative
                                                    </button>
                                                    <button className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors">
                                                        Decline
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2">
                                        <Link
                                            href={`/host/events/${request.eventId}`}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            View Event
                                        </Link>
                                        {(request.status === "rejected" || request.status === "needs_changes") && (
                                            <Link
                                                href={`/host/create?id=${request.eventId}`}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                Edit & Resubmit
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Timeline Footer */}
                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                    <span>
                                        Submitted {new Date(request.createdAt).toLocaleDateString("en-IN", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </span>
                                    {request.respondedAt && (
                                        <span>
                                            Responded {new Date(request.respondedAt).toLocaleDateString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
